"""Deals — flash table offers for restaurant accounts, with WebSocket broadcast."""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional, Set
from fastapi import APIRouter, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import json

from auth import get_optional_user
from database import get_db
from services.firestore_sync import (
    create_reservation as firestore_create_reservation,
    delete_deal as firestore_delete_deal,
    update_reservation_status as firestore_update_reservation_status,
    upsert_deal as firestore_upsert_deal,
)

router = APIRouter(prefix="/deals", tags=["deals"])

# ── WebSocket connection manager ──────────────────────────────────────────────

class _ConnectionManager:
    def __init__(self):
        self._clients: Set[WebSocket] = set()

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._clients.add(ws)

    def disconnect(self, ws: WebSocket):
        self._clients.discard(ws)

    async def broadcast(self, data: dict):
        dead = set()
        for ws in self._clients:
            try:
                await ws.send_text(json.dumps(data))
            except Exception:
                dead.add(ws)
        self._clients -= dead

manager = _ConnectionManager()


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _fetch_one(db: Any, sql: str, params: tuple[Any, ...] = ()) -> Optional[dict]:
    cursor = await db.execute(sql, params)
    row = await cursor.fetchone()
    return dict(row) if row else None


async def _fetch_all(db: Any, sql: str, params: tuple[Any, ...] = ()) -> list[dict]:
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
        raise HTTPException(status_code=403, detail="Solo cuentas de restaurante pueden gestionar ofertas")
    return row


def _parse_cuisines(raw_value: object) -> list[str]:
    if isinstance(raw_value, list):
        return [str(v).strip() for v in raw_value if str(v).strip()]
    if isinstance(raw_value, str) and raw_value.strip():
        try:
            loaded = json.loads(raw_value)
            if isinstance(loaded, list):
                return [str(v).strip() for v in loaded if str(v).strip()]
        except json.JSONDecodeError:
            return [chunk.strip() for chunk in raw_value.split(",") if chunk.strip()]
    return []


def _serialize_deal(row: dict) -> dict:
    payload = dict(row)
    payload["restaurant_cuisines"] = _parse_cuisines(payload.get("restaurant_cuisines"))
    return payload


# ── Schemas ───────────────────────────────────────────────────────────────────

class DealCreate(BaseModel):
    price: float
    original_price: Optional[float] = None
    seats: int
    available_at: datetime
    description: Optional[str] = None
    expires_in_minutes: int = 120


class DealUpdate(BaseModel):
    price: Optional[float] = None
    seats: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ReservationCreate(BaseModel):
    customer_name: str
    customer_phone: str


class ReservationStatusUpdate(BaseModel):
    status: str  # no_show | cancelled


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.websocket("/ws")
async def deals_ws(websocket: WebSocket):
    """WebSocket — clients subscribe here to receive live deal events."""
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()  # keep-alive ping/pong
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@router.get("")
async def list_deals(
    request: Request,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_m: int = 5000,
    owner: Optional[str] = None,
):
    """List active deals, optionally filtered by proximity or owner."""
    async with get_db() as db:
        if owner == "me":
            uid = get_optional_user(request)
            if not uid:
                raise HTTPException(status_code=401, detail="Autenticación requerida")
            deals = await _fetch_all(
                db,
                "SELECT * FROM deals WHERE owner_uid = ? ORDER BY created_at DESC",
                (uid,),
            )
            # Attach reservation info to each deal
            for index, deal in enumerate(deals):
                res = await _fetch_one(
                    db,
                    "SELECT * FROM reservations WHERE deal_id = ? AND status = 'confirmed'",
                    (deal["id"],),
                )
                normalized = _serialize_deal(deal)
                normalized["reservation"] = res
                deals[index] = normalized
        else:
            now = datetime.now(timezone.utc)
            now_param = now
            deals = await _fetch_all(
                db,
                """SELECT * FROM deals
                   WHERE is_active = TRUE
                     AND available_at <= ?
                     AND (expires_at IS NULL OR expires_at >= ?)
                   ORDER BY created_at DESC""",
                (now_param, now_param),
            )
            deals = [_serialize_deal(d) for d in deals]

    if owner != "me" and lat is not None and lng is not None:
        def dist(d):
            dlat = (d["lat"] - lat) * 111000
            dlng = (d["lng"] - lng) * 111000 * 0.7
            return (dlat**2 + dlng**2) ** 0.5
        deals = [d for d in deals if dist(d) <= radius_m]

    return {"deals": deals}


@router.get("/{deal_id}")
async def get_deal(deal_id: str):
    async with get_db() as db:
        row = await _fetch_one(db, "SELECT * FROM deals WHERE id = ?", (deal_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    return _serialize_deal(row)


@router.post("")
async def create_deal(body: DealCreate, request: Request):
    """Create a deal. Requires business account."""
    firestore_doc: dict[str, Any] | None = None
    deal_id = str(uuid.uuid4())
    async with get_db() as db:
        profile = await _require_business(request, db)
        if profile.get("restaurant_lat") is None or profile.get("restaurant_lng") is None:
            raise HTTPException(status_code=400, detail="Perfil de restaurante sin coordenadas")

        expires_at = datetime.now(timezone.utc) + timedelta(minutes=body.expires_in_minutes)
        available_at_value = body.available_at
        expires_at_value = expires_at
        restaurant_cuisines = _parse_cuisines(profile.get("restaurant_cuisines"))
        primary_cuisine = restaurant_cuisines[0] if restaurant_cuisines else "general"
        restaurant_cuisines_value = json.dumps(restaurant_cuisines)

        firestore_doc = {
            "id": deal_id,
            "owner_uid": profile["firebase_uid"],
            "restaurant_name": profile.get("restaurant_name") or "Restaurante",
            "restaurant_place_id": profile.get("restaurant_place_id"),
            "lat": profile["restaurant_lat"],
            "lng": profile["restaurant_lng"],
            "price": body.price,
            "original_price": body.original_price,
            "seats": body.seats,
            "cuisine": primary_cuisine,
            "restaurant_cuisines": restaurant_cuisines,
            "available_at": body.available_at.isoformat(),
            "description": body.description,
            "expires_at": expires_at.isoformat(),
            "is_active": True,
        }
        firestore_upsert_deal(firestore_doc)

        try:
            await db.execute(
                """INSERT INTO deals
                   (id, owner_uid, restaurant_id, restaurant_name, restaurant_place_id, lat, lng,
                          price, original_price, seats, cuisine, restaurant_cuisines,
                          available_at, description, expires_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    deal_id,
                    profile["firebase_uid"],
                    profile["firebase_uid"],
                    profile.get("restaurant_name") or "Restaurante",
                    profile.get("restaurant_place_id"),
                    profile["restaurant_lat"],
                    profile["restaurant_lng"],
                    body.price,
                    body.original_price,
                    body.seats,
                    primary_cuisine,
                    restaurant_cuisines_value,
                    available_at_value,
                    body.description,
                    expires_at_value,
                ),
            )
            await db.commit()
            deal = await _fetch_one(db, "SELECT * FROM deals WHERE id = ?", (deal_id,))
            if not deal:
                raise HTTPException(status_code=500, detail="No se pudo crear la oferta")
            deal = _serialize_deal(deal)
        except Exception:
            firestore_delete_deal(deal_id)
            raise

    if firestore_doc is not None:
        firestore_upsert_deal(deal)

    # Broadcast to all connected WebSocket clients
    await manager.broadcast({"event": "deal_created", "deal": deal})
    return {"success": True, "deal": deal}


@router.patch("/{deal_id}")
async def update_deal(deal_id: str, body: DealUpdate, request: Request):
    async with get_db() as db:
        profile = await _require_business(request, db)
        existing = await _fetch_one(db, "SELECT owner_uid FROM deals WHERE id = ?", (deal_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Oferta no encontrada")
        if existing["owner_uid"] != profile["firebase_uid"]:
            raise HTTPException(status_code=403, detail="No eres el propietario")

        data = body.model_dump(exclude_unset=True)
        if not data:
            raise HTTPException(status_code=400, detail="Sin campos para actualizar")

        cols = list(data.keys())
        vals = list(data.values())
        set_clause = ", ".join(f"{c} = ?" for c in cols)
        await db.execute(
            f"UPDATE deals SET {set_clause} WHERE id = ?",
            tuple(vals + [deal_id]),
        )
        await db.commit()
        deal = await _fetch_one(db, "SELECT * FROM deals WHERE id = ?", (deal_id,))
        if not deal:
            raise HTTPException(status_code=404, detail="Oferta no encontrada")
        deal = _serialize_deal(deal)

    firestore_upsert_deal(deal)

    await manager.broadcast({"event": "deal_updated", "deal": deal})
    return {"success": True, "deal": deal}


@router.delete("/{deal_id}")
async def delete_deal(deal_id: str, request: Request):
    async with get_db() as db:
        profile = await _require_business(request, db)
        existing = await _fetch_one(db, "SELECT owner_uid FROM deals WHERE id = ?", (deal_id,))
        if not existing:
            raise HTTPException(status_code=404, detail="Oferta no encontrada")
        if existing["owner_uid"] != profile["firebase_uid"]:
            raise HTTPException(status_code=403, detail="No eres el propietario")
        reservation = await _fetch_one(
            db,
            "SELECT id FROM reservations WHERE deal_id = ? AND status = 'confirmed'",
            (deal_id,),
        )
        if reservation:
            raise HTTPException(status_code=409, detail="No puedes retirar una oferta ya reservada")
        await db.execute("UPDATE deals SET is_active = FALSE WHERE id = ?", (deal_id,))
        await db.commit()

    firestore_delete_deal(deal_id)

    await manager.broadcast({"event": "deal_deleted", "deal_id": deal_id})
    return {"success": True}


# ── Reservation endpoints ─────────────────────────────────────────────────────

@router.post("/{deal_id}/reserve")
async def create_reservation(deal_id: str, body: ReservationCreate, request: Request):
    """Reserve a deal. Returns 409 if already taken."""
    async with get_db() as db:
        uid = get_optional_user(request)
        deal = await _fetch_one(db, "SELECT * FROM deals WHERE id = ?", (deal_id,))
        if not deal:
            raise HTTPException(status_code=404, detail="Oferta no encontrada")
        if not deal.get("is_active"):
            raise HTTPException(status_code=400, detail="Esta oferta ya no está disponible")
        existing = await _fetch_one(
            db,
            "SELECT id FROM reservations WHERE deal_id = ? AND status = 'confirmed'",
            (deal_id,),
        )
        if existing:
            raise HTTPException(status_code=409, detail="Esta oferta ya ha sido reservada")

        res_id = str(uuid.uuid4())
        await db.execute(
            "INSERT INTO reservations (id, deal_id, customer_uid, customer_name, customer_phone) VALUES (?, ?, ?, ?, ?)",
            (res_id, deal_id, uid, body.customer_name, body.customer_phone),
        )
        await db.commit()
        reservation = await _fetch_one(db, "SELECT * FROM reservations WHERE id = ?", (res_id,))

    if reservation:
        firestore_create_reservation(deal_id, reservation)

    await manager.broadcast({
        "event": "reservation_created",
        "deal_id": deal_id,
        "owner_uid": deal["owner_uid"],
        "reservation": reservation,
    })
    return {"success": True, "reservation": reservation}


@router.get("/{deal_id}/reservation")
async def get_reservation(deal_id: str, request: Request):
    """Get active reservation for a deal (restaurant only)."""
    async with get_db() as db:
        profile = await _require_business(request, db)
        deal = await _fetch_one(db, "SELECT owner_uid FROM deals WHERE id = ?", (deal_id,))
        if not deal or deal["owner_uid"] != profile["firebase_uid"]:
            raise HTTPException(status_code=403, detail="No autorizado")
        reservation = await _fetch_one(
            db,
            "SELECT * FROM reservations WHERE deal_id = ? AND status = 'confirmed'",
            (deal_id,),
        )
    return {"reservation": reservation}


@router.patch("/{deal_id}/reservation")
async def update_reservation_status(deal_id: str, body: ReservationStatusUpdate, request: Request):
    """Update reservation status (no_show or cancelled). Restaurant only."""
    if body.status not in ("no_show", "cancelled"):
        raise HTTPException(status_code=400, detail="Estado inválido. Usa 'no_show' o 'cancelled'.")
    async with get_db() as db:
        profile = await _require_business(request, db)
        deal = await _fetch_one(db, "SELECT owner_uid FROM deals WHERE id = ?", (deal_id,))
        if not deal or deal["owner_uid"] != profile["firebase_uid"]:
            raise HTTPException(status_code=403, detail="No autorizado")
        await db.execute(
            "UPDATE reservations SET status = ? WHERE deal_id = ? AND status = 'confirmed'",
            (body.status, deal_id),
        )
        await db.commit()

    firestore_update_reservation_status(deal_id, body.status)
    return {"success": True}
