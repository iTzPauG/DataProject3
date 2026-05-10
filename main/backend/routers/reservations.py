"""Restaurant reservations."""
import uuid
from datetime import datetime
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import get_optional_user
from database import get_db

router = APIRouter(prefix="/restaurants", tags=["reservations"])


class ReservationBody(BaseModel):
    date: datetime
    party_size: int
    notes: str | None = None


def _to_dict(row):
    return dict(row) if row else None


@router.get("/{restaurant_id}/reservations")
def get_slots(restaurant_id: str, request: Request):
    """Get available reservation slots for a restaurant. Not yet implemented."""
    pass


@router.post("/{restaurant_id}/reservations")
async def book(restaurant_id: str, body: ReservationBody, request: Request):
    """Book a reservation (requires auth)."""
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    async with get_db() as db:
        profile_cursor = await db.execute(
            "SELECT id FROM profiles WHERE firebase_uid = ?",
            (user_id,),
        )
        profile = _to_dict(await profile_cursor.fetchone())
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        restaurant_cursor = await db.execute(
            "SELECT id, name FROM places WHERE id = ?",
            (restaurant_id,),
        )
        restaurant = _to_dict(await restaurant_cursor.fetchone())
        if not restaurant:
            raise HTTPException(status_code=404, detail="Restaurant not found")

        reservation_id = str(uuid.uuid4())
        customer_name = profile.get("display_name") or profile.get("firebase_uid") or "Cliente"
        await db.execute(
            """
            INSERT INTO reservations (
                id,
                restaurant_id,
                user_id,
                customer_name,
                customer_phone,
                reservation_date,
                party_size,
                notes,
                created_at,
                updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """,
            (
                reservation_id,
                restaurant["id"],
                profile["id"],
                customer_name,
                "",
                body.date.isoformat(),
                body.party_size,
                body.notes,
            ),
        )
        await db.commit()

    return {
        "status": "ok",
        "reservation": {
            "id": reservation_id,
            "restaurant_id": restaurant["id"],
            "restaurant_name": restaurant["name"],
            "date": body.date.isoformat(),
            "party_size": body.party_size,
            "notes": body.notes,
        },
    }


@router.delete("/{restaurant_id}/reservations/{reservation_id}")
def cancel(restaurant_id: str, reservation_id: str, request: Request):
    """Cancel a reservation (requires auth). Not yet implemented."""
    pass
