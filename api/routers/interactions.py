from fastapi import APIRouter, Depends
from api.dependencies import get_current_user

router = APIRouter()

@router.post("/{restaurant_id}/like")
def like(restaurant_id: str, user=Depends(get_current_user)):
    pass

@router.delete("/{restaurant_id}/like")
def unlike(restaurant_id: str, user=Depends(get_current_user)):
    pass
