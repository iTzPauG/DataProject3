from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.dependencies import get_current_user

router = APIRouter()

class UpdateUserBody(BaseModel):
    display_name: str | None = None
    avatar_url: str | None = None

@router.get("/{user_id}")
def get_user(user_id: str):
    pass

@router.patch("/{user_id}")
def update_user(user_id: str, body: UpdateUserBody, user=Depends(get_current_user)):
    pass

@router.delete("/{user_id}")
def delete_user(user_id: str, user=Depends(get_current_user)):
    pass

@router.get("/{user_id}/preferences")
def get_preferences(user_id: str, user=Depends(get_current_user)):
    pass

@router.get("/{user_id}/history")
def get_history(user_id: str, user=Depends(get_current_user)):
    pass

@router.get("/{user_id}/reservations")
def get_user_reservations(user_id: str, user=Depends(get_current_user)):
    pass
