from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from api.dependencies import get_current_user

router = APIRouter()

class DealBody(BaseModel):
    restaurant_id: str
    price: float
    cuisine: str
    available_at: datetime
    seats: int
    description: str | None = None

@router.get("")
def list_deals(
    cuisine: Optional[str] = None,
    price_max: Optional[float] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[int] = 1500,
):
    pass

@router.get("/{deal_id}")
def get_deal(deal_id: str):
    pass

@router.post("")
def create_deal(body: DealBody, user=Depends(get_current_user)):
    pass

@router.patch("/{deal_id}")
def update_deal(deal_id: str, body: DealBody, user=Depends(get_current_user)):
    pass

@router.delete("/{deal_id}")
def delete_deal(deal_id: str, user=Depends(get_current_user)):
    pass
