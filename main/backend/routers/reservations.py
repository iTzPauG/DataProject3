"""Restaurant reservations."""
from datetime import datetime
from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter(prefix="/restaurants", tags=["reservations"])


class ReservationBody(BaseModel):
    date: datetime
    party_size: int
    notes: str | None = None


@router.get("/{restaurant_id}/reservations")
def get_slots(restaurant_id: str, request: Request):
    """Get available reservation slots for a restaurant. Not yet implemented."""
    pass


@router.post("/{restaurant_id}/reservations")
def book(restaurant_id: str, body: ReservationBody, request: Request):
    """Book a reservation (requires auth). Not yet implemented."""
    pass


@router.delete("/{restaurant_id}/reservations/{reservation_id}")
def cancel(restaurant_id: str, reservation_id: str, request: Request):
    """Cancel a reservation (requires auth). Not yet implemented."""
    pass
