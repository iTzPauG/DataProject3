"""Deals / flash offers — only business accounts can create/edit/delete."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import get_optional_user
from database import get_db

def _get_app():
    try:
        import firebase_admin
        if not firebase_admin._apps:
            import os
            cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "")
            if cred_path:
                from firebase_admin import credentials
                firebase_admin.initialize_app(credentials.Certificate(cred_path))
            else:
                firebase_admin.initialize_app()
        return firebase_admin.get_app()
    except Exception:
        return None

router = APIRouter(prefix="/deals", tags=["deals"])


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _require_business(request: Request, db) -> str:
    """Return firebase_uid if the caller is a business account, else raise."""
    uid = get_optional_user(request)
    if not uid:
        raise HTTPException(status_code=401, detail="Autenticación requerida")
    row = await db.fetchrow(
        "SELECT role FROM profiles WHERE firebase_uid=$1", uid
    )
    if not row or row["role"] != "business":
        raise HTTPException(status_code=403, detail="Solo cuentas de restaurante pueden gestionar ofertas")
    return uid


def _firestore_sync(deal_id: str, data: dict):
    """Write/update deal in Firestore for real-time frontend."""
    try:
        _get_app()
        from firebase_admin import firestore as fs
        fs.client().collection("deals").document(deal_id).set(data, merge=True)
    except Exception as e:
        print(f"[deals] Firestore sync error: {e}")


def _firestore_delete(deal_id: str):
    try:
        _get_app()
        from firebase_admin import firestore as fs
        fs.client().collection("deals").document(deal_id).delete()
    except Exception as e:
        print(f"[deals] Firestore delete error: {e}")


# ── Schemas ───────────────────────────────────────────────────────────────────

class DealBody(BaseModel):
    restaurant_id: str
    price: float
    cuisine: str
    available_at: datetime
    seats: int
    description: Optional[str] = None


class DealUpdate(BaseModel):
    price: Optional[float] = None
    cuisine: Optional[str] = None
    available_at: Optional[datetime] = None
    seats: Optional[int] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("")
async def list_deals(
    cuisine: Optional[str] = None,
    price_max: Optional[float] = None,
):
    """List active deals with optional filters."""
    async with get_db() as db:
        conditions = ["is_active = true", "available_at > now()"]
        params: list = []

        if cuisine:
            params.append(cuisine)
            conditions.append(f"cuisine = ${len(params)}")
        if price_max is not None:
            params.append(price_max)
            conditions.append(f"price <= ${len(params)}")

        where = " AND ".join(conditions)
        rows = await db.fetch(
            f"SELECT * FROM deals WHERE {where} ORDER BY available_at ASC",
            *params,
        )
        return {"deals": [dict(r) for r in rows]}


@router.get("/{deal_id}")
async def get_deal(deal_id: str):
    """Get a single deal by ID."""
    async with get_db() as db:
        row = await db.fetchrow("SELECT * FROM deals WHERE id=$1", deal_id)
    if not row:
        raise HTTPException(status_code=404, detail="Oferta no encontrada")
    return dict(row)


@router.post("")
async def create_deal(body: DealBody, request: Request):
    """Create a deal. Requires business account."""
    async with get_db() as db:
        uid = await _require_business(request, db)
        deal_id = str(uuid.uuid4())
        row = await db.fetchrow(
            """INSERT INTO deals (id, restaurant_id, owner_uid, price, cuisine, available_at, seats, description)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *""",
            deal_id, body.restaurant_id, uid, body.price, body.cuisine,
            body.available_at, body.seats, body.description,
        )
        deal = dict(row)

    _firestore_sync(deal_id, {
        **deal,
        "available_at": body.available_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"success": True, "deal": deal}


@router.patch("/{deal_id}")
async def update_deal(deal_id: str, body: DealUpdate, request: Request):
    """Update a deal. Only the owner business account can update."""
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    async with get_db() as db:
        uid = await _require_business(request, db)
        existing = await db.fetchrow("SELECT owner_uid FROM deals WHERE id=$1", deal_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Oferta no encontrada")
        if existing["owner_uid"] != uid:
            raise HTTPException(status_code=403, detail="No eres el propietario de esta oferta")

        cols = list(data.keys())
        vals = list(data.values())
        set_clause = ", ".join(f"{c}=${i+2}" for i, c in enumerate(cols))
        row = await db.fetchrow(
            f"UPDATE deals SET {set_clause}, updated_at=now() WHERE id=$1 RETURNING *",
            deal_id, *vals,
        )
        deal = dict(row)

    _firestore_sync(deal_id, {k: (v.isoformat() if isinstance(v, datetime) else v) for k, v in deal.items()})
    return {"success": True, "deal": deal}


@router.delete("/{deal_id}")
async def delete_deal(deal_id: str, request: Request):
    """Delete a deal. Only the owner business account can delete."""
    async with get_db() as db:
        uid = await _require_business(request, db)
        existing = await db.fetchrow("SELECT owner_uid FROM deals WHERE id=$1", deal_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Oferta no encontrada")
        if existing["owner_uid"] != uid:
            raise HTTPException(status_code=403, detail="No eres el propietario de esta oferta")
        await db.execute("DELETE FROM deals WHERE id=$1", deal_id)

    _firestore_delete(deal_id)
    return {"success": True}
