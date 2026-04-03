from fastapi import APIRouter, Depends
from pydantic import BaseModel
from datetime import datetime
from api.dependencies import get_current_user

router = APIRouter()

class ReservationBody(BaseModel):
    date: datetime
    party_size: int
    notes: str | None = None

@router.get("/{restaurant_id}/reservations")
def get_slots(restaurant_id: str, user=Depends(get_current_user)):
    pass

@router.post("/{restaurant_id}/reservations")
def book(restaurant_id: str, body: ReservationBody, user=Depends(get_current_user)):
    pass

@router.delete("/{restaurant_id}/reservations/{reservation_id}")
def cancel(restaurant_id: str, reservation_id: str, user=Depends(get_current_user)):
    pass
