"""Deals — flash table offers for restaurant accounts, with WebSocket broadcast."""
import uuid
from datetime import datetime, timezone, timedelta
from typing import Any, Optional, Set
from fastapi import APIRouter, Body, HTTPException, Request, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
import json

from auth import get_optional_user
from database import get_db, using_postgres
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
    reservation_deadline_at: Optional[datetime] = None
    description: Optional[str] = None
    expires_at: Optional[datetime] = None
    expires_in_minutes: Optional[int] = 120


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
    reason: Optional[str] = None


class DealDeleteRequest(BaseModel):
    reason: Optional[str] = None


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
                    (str(deal["id"]),),
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
                     AND cancelled_at IS NULL
                     AND not_presented_at IS NULL
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

        if body.expires_at is not None:
            expires_at = body.expires_at
        else:
            expires_minutes = body.expires_in_minutes or 120
            expires_at = datetime.now(timezone.utc) + timedelta(minutes=expires_minutes)

        if expires_at <= body.available_at:
            raise HTTPException(status_code=400, detail="La hora limite debe ser posterior a la disponibilidad")

        reservation_deadline_at = body.reservation_deadline_at
        if reservation_deadline_at is not None and reservation_deadline_at > body.available_at:
            raise HTTPException(
                status_code=400,
                detail="La hora maxima para aceptar reserva no puede ser posterior al inicio",
            )

        available_at_value = body.available_at
        expires_at_value = expires_at
        if reservation_deadline_at is None:
            reservation_deadline_value = None
        elif using_postgres():
            reservation_deadline_value = reservation_deadline_at
        else:
            reservation_deadline_value = reservation_deadline_at.isoformat()
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
            "reservation_deadline_at": reservation_deadline_at.isoformat() if reservation_deadline_at else None,
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
                          available_at, reservation_deadline_at, description, expires_at)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
                    reservation_deadline_value,
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
async def delete_deal(deal_id: str, request: Request, body: DealDeleteRequest | None = Body(None)):
    reason = (body.reason if body else "") or ""
    reason = reason.strip()
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
        await db.execute(
            "UPDATE deals SET is_active = FALSE, cancellation_reason = ?, cancelled_at = ? WHERE id = ?",
            (reason, datetime.now(timezone.utc).isoformat(), deal_id),
        )
        await db.commit()
        deal = await _fetch_one(db, "SELECT * FROM deals WHERE id = ?", (deal_id,))
        if deal:
            deal = _serialize_deal(deal)

    firestore_upsert_deal(deal) if deal else None

    await manager.broadcast({"event": "deal_deleted", "deal_id": deal_id})
    return {"success": True}


# ── Reservation endpoints ─────────────────────────────────────────────────────

@router.post("/{deal_id}/reserve")
async def create_reservation(deal_id: str, body: ReservationCreate, request: Request):
    """Reserve a deal. Returns 409 if already taken."""
    async with get_db() as db:
        uid = get_optional_user(request)
        if not uid:
            raise HTTPException(status_code=401, detail="Debes iniciar sesión para reservar")
        if uid:
            profile = await _fetch_one(db, "SELECT role FROM profiles WHERE firebase_uid = ?", (uid,))
            if profile and profile.get("role") == "business":
                raise HTTPException(status_code=403, detail="Las cuentas de restaurante no pueden reservar ofertas")
        deal = await _fetch_one(db, "SELECT * FROM deals WHERE id = ?", (deal_id,))
        if not deal:
            raise HTTPException(status_code=404, detail="Oferta no encontrada")
        existing = await _fetch_one(
            db,
            "SELECT id FROM reservations WHERE deal_id = ? AND status = 'confirmed'",
            (deal_id,),
        )
        if existing:
            raise HTTPException(status_code=409, detail="Esta reserva ya ha sido consumida por otro usuario")
        if not deal.get("is_active"):
            raise HTTPException(status_code=409, detail="Esta reserva ya ha sido consumida por otro usuario")

        profile = await _fetch_one(db, "SELECT id FROM profiles WHERE firebase_uid = ?", (uid,))
        profile_id = str(profile.get("id")) if profile and profile.get("id") is not None else None

        res_id = str(uuid.uuid4())
        try:
            await db.execute(
                "INSERT INTO reservations (id, deal_id, restaurant_id, user_id, customer_name, customer_phone) VALUES (?, ?, ?, ?, ?, ?)",
                (res_id, deal_id, deal["restaurant_id"], profile_id, body.customer_name, body.customer_phone),
            )
            await db.execute(
                "UPDATE deals SET is_active = FALSE WHERE id = ?",
                (deal_id,),
            )
            await db.commit()
        except Exception as exc:
            await db.rollback()
            message = str(exc).lower()
            if "unique" in message or "constraint" in message:
                raise HTTPException(status_code=409, detail="Esta reserva ya ha sido consumida por otro usuario")
            raise
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


@router.get("/my-reservations")
async def my_reservations(request: Request):
    """Get all reservations made by the current user (customer view)."""
    uid = get_optional_user(request)
    if not uid:
        raise HTTPException(status_code=401, detail="Autenticación requerida")
    async with get_db() as db:
        rows = await _fetch_all(
            db,
            """
            SELECT r.id, r.deal_id, r.status, r.status_reason, r.created_at,
                   d.restaurant_name, d.price, d.original_price, d.seats,
                   d.description, d.available_at, d.expires_at,
                   d.reservation_deadline_at, d.restaurant_cuisines,
                   d.cancelled_at, d.not_presented_at
            FROM reservations r
            JOIN deals d ON d.id = r.deal_id
            WHERE r.customer_uid = ?
            ORDER BY d.available_at DESC
            """,
            (uid,),
        )
        serialized = [_serialize_deal(dict(row)) for row in rows]
    return {"reservations": serialized}


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
    reason = (body.reason or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Debes indicar un motivo.")
    async with get_db() as db:
        profile = await _require_business(request, db)
        deal = await _fetch_one(db, "SELECT owner_uid FROM deals WHERE id = ?", (deal_id,))
        if not deal or deal["owner_uid"] != profile["firebase_uid"]:
            raise HTTPException(status_code=403, detail="No autorizado")
        now_ts = datetime.now(timezone.utc).isoformat()
        await db.execute(
            "UPDATE reservations SET status = ?, status_reason = ?, status_updated_at = ? WHERE deal_id = ? AND status = 'confirmed'",
            (body.status, reason, now_ts, deal_id),
        )
        # Mark deal as inactive and save timestamp
        field_name = "not_presented_at" if body.status == "no_show" else "cancelled_at"
        await db.execute(
            f"UPDATE deals SET is_active = FALSE, {field_name} = ? WHERE id = ?",
            (now_ts, deal_id),
        )
        await db.commit()
        deal = await _fetch_one(db, "SELECT * FROM deals WHERE id = ?", (deal_id,))
        if deal:
            deal = _serialize_deal(deal)

    firestore_update_reservation_status(deal_id, body.status, reason)
    firestore_upsert_deal(deal) if deal else None
    return {"success": True}
