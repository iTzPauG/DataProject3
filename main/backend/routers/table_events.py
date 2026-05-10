"""Table events — ofertas de mesa de última hora con broadcast WebSocket."""
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional, Set

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from database import get_db

router = APIRouter(prefix="/table-events", tags=["table-events"])


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


async def _fetch_all(db: Any, sql: str, params: tuple = ()) -> list[dict]:
    cursor = await db.execute(sql, params)
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]


async def _fetch_one(db: Any, sql: str, params: tuple = ()) -> Optional[dict]:
    cursor = await db.execute(sql, params)
    row = await cursor.fetchone()
    return dict(row) if row else None


class TableEventCreate(BaseModel):
    restaurant_name: str
    seats: int
    price: float
    description: Optional[str] = None
    minutes_available: int = 60


@router.websocket("/ws")
async def table_events_ws(websocket: WebSocket):
    """WebSocket — los clientes se suscriben aquí para recibir eventos en tiempo real."""
    await manager.connect(websocket)
    try:
        async with get_db() as db:
            now_str = datetime.now(timezone.utc).isoformat()
            events = await _fetch_all(
                db,
                "SELECT * FROM table_events WHERE is_active=1 AND (ends_at IS NULL OR ends_at >= ?) ORDER BY created_at DESC",
                (now_str,),
            )
        await websocket.send_text(json.dumps({"type": "init", "events": events}))
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


@router.get("/history")
async def list_events_history(restaurant_name: Optional[str] = None):
    """Historial completo de eventos (incluidos inactivos) para un restaurante."""
    async with get_db() as db:
        if restaurant_name:
            events = await _fetch_all(
                db,
                "SELECT * FROM table_events WHERE restaurant_name=? ORDER BY created_at DESC LIMIT 200",
                (restaurant_name,),
            )
        else:
            events = await _fetch_all(
                db,
                "SELECT * FROM table_events ORDER BY created_at DESC LIMIT 200",
            )
    return {"events": events}


@router.get("/stats")
async def get_restaurant_stats(restaurant_name: str):
    """Estadísticas agregadas para un restaurante."""
    async with get_db() as db:
        cursor = await db.execute(
            """SELECT
                COUNT(*) as total_offers,
                SUM(CASE WHEN is_active=1 THEN 1 ELSE 0 END) as active_offers,
                SUM(CASE WHEN is_active=0 THEN 1 ELSE 0 END) as cancelled_offers,
                COALESCE(AVG(price), 0) as avg_price,
                COALESCE(MIN(price), 0) as min_price,
                COALESCE(MAX(price), 0) as max_price,
                COALESCE(SUM(seats), 0) as total_seats,
                COALESCE(AVG(seats), 0) as avg_seats,
                MIN(created_at) as first_activity,
                MAX(created_at) as last_activity
            FROM table_events WHERE restaurant_name=?""",
            (restaurant_name,),
        )
        row = await cursor.fetchone()
        stats = dict(row) if row else {}
    if stats:
        stats["avg_price"] = round(float(stats.get("avg_price") or 0), 2)
        stats["min_price"] = round(float(stats.get("min_price") or 0), 2)
        stats["max_price"] = round(float(stats.get("max_price") or 0), 2)
        stats["avg_seats"] = round(float(stats.get("avg_seats") or 0), 1)
    return {"stats": stats, "restaurant_name": restaurant_name}


@router.get("")
async def list_events(restaurant_name: Optional[str] = None):
    """Lista las ofertas de mesa activas, opcionalmente filtradas por restaurante."""
    async with get_db() as db:
        now_str = datetime.now(timezone.utc).isoformat()
        if restaurant_name:
            events = await _fetch_all(
                db,
                "SELECT * FROM table_events WHERE is_active=1 AND restaurant_name=? AND (ends_at IS NULL OR ends_at >= ?) ORDER BY created_at DESC",
                (restaurant_name, now_str),
            )
        else:
            events = await _fetch_all(
                db,
                "SELECT * FROM table_events WHERE is_active=1 AND (ends_at IS NULL OR ends_at >= ?) ORDER BY created_at DESC",
                (now_str,),
            )
    return {"events": events}


@router.post("")
async def create_event(body: TableEventCreate):
    """Publica una nueva oferta de mesa y la difunde por WebSocket."""
    event_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    ends_at = (now + timedelta(minutes=body.minutes_available)).isoformat()
    now_iso = now.isoformat()

    async with get_db() as db:
        await db.execute(
            """INSERT INTO table_events
               (id, owner_uid, restaurant_name, price, seats, ends_at, description, is_active, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)""",
            (
                event_id,
                body.restaurant_name,
                body.restaurant_name,
                body.price,
                body.seats,
                ends_at,
                body.description,
                now_iso,
            ),
        )
        await db.commit()
        event = await _fetch_one(db, "SELECT * FROM table_events WHERE id = ?", (event_id,))

    try:
        from services.firestore_sync import _get_firestore_client, _doc_payload
        client = _get_firestore_client()
        client.collection("table_events").document(event_id).set(_doc_payload(dict(event)))
    except Exception:
        pass

    await manager.broadcast({"type": "new_event", "event": event})
    return {"success": True, "event": event}


@router.delete("/{event_id}")
async def cancel_event(event_id: str):
    """Cancela una oferta de mesa y notifica a todos los clientes WebSocket."""
    async with get_db() as db:
        existing = await _fetch_one(db, "SELECT id FROM table_events WHERE id = ?", (event_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Evento no encontrado")
        await db.execute(
            "UPDATE table_events SET is_active=0 WHERE id = ?",
            (event_id,),
        )
        await db.commit()

    try:
        from services.firestore_sync import _get_firestore_client
        client = _get_firestore_client()
        client.collection("table_events").document(event_id).set(
            {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()},
            merge=True,
        )
    except Exception:
        pass

    await manager.broadcast({"type": "event_cancelled", "event_id": event_id})
    return {"success": True}
