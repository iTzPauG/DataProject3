"""Deals / flash offers for restaurants."""
from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Request
from pydantic import BaseModel

from auth import get_optional_user

router = APIRouter(prefix="/deals", tags=["deals"])


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
    """List available deals with optional filters. Not yet implemented."""
    pass


@router.get("/{deal_id}")
def get_deal(deal_id: str):
    """Get a single deal by ID. Not yet implemented."""
    pass


@router.post("")
def create_deal(body: DealBody, request: Request):
    """Create a deal (requires auth). Not yet implemented."""
    pass


@router.patch("/{deal_id}")
def update_deal(deal_id: str, body: DealBody, request: Request):
    """Update a deal (requires auth). Not yet implemented."""
    pass


@router.delete("/{deal_id}")
def delete_deal(deal_id: str, request: Request):
    """Delete a deal (requires auth). Not yet implemented."""
    pass
