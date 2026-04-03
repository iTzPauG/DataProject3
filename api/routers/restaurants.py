from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional
from api.dependencies import get_current_user

router = APIRouter()

class RestaurantBody(BaseModel):
    name: str
    cuisine: str
    price_range: int  # 1-3
    lat: float
    lng: float
    is_franchise: bool = False
    phone: str | None = None
    website: str | None = None
    booking_url: str | None = None

@router.get("")
def list_restaurants(
    cuisine: Optional[str] = None,
    price_range: Optional[int] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[int] = 2000,
    is_franchise: Optional[bool] = None,
    sort: Optional[str] = Query(default="popular", pattern="^(popular|recommended|rating|price)$"),
    page: int = 1,
    limit: int = 20,
):
    pass

@router.get("/{restaurant_id}")
def get_restaurant(restaurant_id: str):
    pass

@router.post("")
def create_restaurant(body: RestaurantBody, user=Depends(get_current_user)):
    pass

@router.patch("/{restaurant_id}")
def update_restaurant(restaurant_id: str, body: RestaurantBody, user=Depends(get_current_user)):
    pass

@router.delete("/{restaurant_id}")
def delete_restaurant(restaurant_id: str, user=Depends(get_current_user)):
    pass

@router.get("/{restaurant_id}/contact")
def get_contact(restaurant_id: str):
    pass

@router.get("/{restaurant_id}/stats")
def get_stats(restaurant_id: str):
    pass
