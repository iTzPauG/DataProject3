from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import Optional, Literal
from api.dependencies import get_current_user

router = APIRouter()

class FeedbackBody(BaseModel):
    restaurant_id: str
    signal: Literal["like", "dislike", "visit", "skip"]

@router.get("")
def get_recommendations(
    cuisine: Optional[str] = None,
    price_range: Optional[int] = None,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius: Optional[int] = 3000,
    user=Depends(get_current_user),
):
    pass

@router.get("/discovery")
def discovery(user=Depends(get_current_user)):
    pass

@router.post("/feedback")
def feedback(body: FeedbackBody, user=Depends(get_current_user)):
    pass
