"""Table Events — real-time table availability broadcasts via WebSocket."""
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional, Set

from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from auth import get_optional_user
from database import get_db

router = APIRouter(prefix="/table-events", tags=["table-events"])


# ── WebSocket connection manager ──────────────────────────────────────────────

class _ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active_connections.add(ws)

    def disconnect(self, ws: WebSocket):
        self.active_connections.discard(ws)

    async def broadcast(self, data: dict):
        dead = set()
        for ws in self.active_connections:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.add(ws)
        self.active_connections -= dead


manager = _ConnectionManager()


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _fetch_one(db: Any, sql: str, params: tuple = ()) -> Optional[dict]:
    cursor = await db.execute(sql, params)
    row = await cursor.fetchone()
    return dict(row) if row else None


async def _fetch_all(db: Any, sql: str, params: tuple = ()) -> list[dict]:
    cursor = await db.execute(sql, params)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def _require_business(request: Request, db) -> dict:
    uid = get_optional_user(request)
    if not uid:
        raise HTTPException(status_code=401, detail="Autenticación requerida")
    row = await _fetch_one(db, "SELECT * FROM profiles WHERE firebase_uid = ?", (uid,))
    if not row:
        raise HTTPException(status_code=401, detail="Perfil no encontrado")
    if row.get("role") != "business":
        raise HTTPException(status_code=403, detail="Solo cuentas de restaurante pueden gestionar eventos de mesa")
    return row


# ── Schemas ───────────────────────────────────────────────────────────────────

class TableEventCreate(BaseModel):
    price: float
    seats: int
    ends_at: datetime
    description: Optional[str] = None


class TableEventUpdate(BaseModel):
    price: Optional[float] = None
    seats: Optional[int] = None
    is_active: Optional[bool] = None
    description: Optional[str] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.websocket("/ws")
async def table_events_ws(websocket: WebSocket):
    """WebSocket — clients subscribe here to receive live table availability events."""
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping/pong
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.get("")
async def list_table_events(
    request: Request,
    owner: Optional[str] = None,
):
    """List active table events, optionally filtered by owner."""
    async with get_db() as db:
        if owner == "me":
            uid = get_optional_user(request)
            if not uid:
                raise HTTPException(status_code=401, detail="Autenticación requerida")
            events = await _fetch_all(
                db,
                "SELECT * FROM table_events WHERE owner_uid = ? ORDER BY created_at DESC",
                (uid,),
            )
        else:
            now_str = datetime.now(timezone.utc).isoformat()
            events = await _fetch_all(
                db,
                """SELECT * FROM table_events
                   WHERE is_active = 1
                     AND (ends_at IS NULL OR ends_at >= ?)
                   ORDER BY created_at DESC""",
                (now_str,),
            )
    return {"table_events": events}


@router.post("")
async def create_table_event(request: Request, body: TableEventCreate):
    """Create a new table availability event (business accounts only)."""
    async with get_db() as db:
        profile = await _require_business(request, db)
        event_id = str(uuid.uuid4())
        now_str = datetime.now(timezone.utc).isoformat()
        await db.execute(
            """INSERT INTO table_events
               (id, owner_uid, restaurant_name, price, seats, ends_at, description, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)""",
            (
                event_id,
                profile["firebase_uid"],
                profile.get("restaurant_name") or profile.get("display_name", ""),
                body.price,
                body.seats,
                body.ends_at.isoformat(),
                body.description,
                now_str,
            ),
        )
        await db.commit()
        row = await _fetch_one(db, "SELECT * FROM table_events WHERE id = ?", (event_id,))

    await manager.broadcast({"event": "created", "table_event": row})
    return row


@router.patch("/{event_id}")
async def update_table_event(event_id: str, request: Request, body: TableEventUpdate):
    """Update a table event (owner only)."""
    async with get_db() as db:
        profile = await _require_business(request, db)
        row = await _fetch_one(db, "SELECT * FROM table_events WHERE id = ?", (event_id,))
        if not row:
            raise HTTPException(status_code=404, detail="Evento no encontrado")
        if row["owner_uid"] != profile["firebase_uid"]:
            raise HTTPException(status_code=403, detail="No autorizado")

        fields = body.model_dump(exclude_none=True)
        if not fields:
            return row

        set_clause = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [event_id]
        await db.execute(f"UPDATE table_events SET {set_clause} WHERE id = ?", values)
        await db.commit()
        updated = await _fetch_one(db, "SELECT * FROM table_events WHERE id = ?", (event_id,))

    await manager.broadcast({"event": "updated", "table_event": updated})
    return updated


@router.delete("/{event_id}")
async def delete_table_event(event_id: str, request: Request):
    """Delete a table event (owner only)."""
    async with get_db() as db:
        profile = await _require_business(request, db)
        row = await _fetch_one(db, "SELECT * FROM table_events WHERE id = ?", (event_id,))
        if not row:
            raise HTTPException(status_code=404, detail="Evento no encontrado")
        if row["owner_uid"] != profile["firebase_uid"]:
            raise HTTPException(status_code=403, detail="No autorizado")

        await db.execute("DELETE FROM table_events WHERE id = ?", (event_id,))
        await db.commit()

    await manager.broadcast({"event": "deleted", "table_event_id": event_id})
    return {"deleted": True}
