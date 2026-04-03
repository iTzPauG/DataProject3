"""Like / unlike interactions for restaurants."""
from fastapi import APIRouter, Request

router = APIRouter(prefix="/restaurants", tags=["interactions"])


@router.post("/{restaurant_id}/like")
def like(restaurant_id: str, request: Request):
    """Like a restaurant (requires auth). Not yet implemented."""
    pass


@router.delete("/{restaurant_id}/like")
def unlike(restaurant_id: str, request: Request):
    """Unlike a restaurant (requires auth). Not yet implemented."""
    pass
