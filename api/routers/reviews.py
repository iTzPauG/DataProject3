from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.dependencies import get_current_user

router = APIRouter()

class ReviewBody(BaseModel):
    rating: int  # 1-5
    comment: str

@router.get("/{restaurant_id}/reviews")
def get_reviews(restaurant_id: str):
    pass

@router.get("/{restaurant_id}/reviews/summary")
def get_reviews_summary(restaurant_id: str):
    pass

@router.post("/{restaurant_id}/reviews")
def post_review(restaurant_id: str, body: ReviewBody, user=Depends(get_current_user)):
    pass

@router.delete("/{restaurant_id}/reviews/{review_id}")
def delete_review(restaurant_id: str, review_id: str, user=Depends(get_current_user)):
    pass
