"""Compare multiple places side by side."""
from typing import List
from fastapi import APIRouter, Query

router = APIRouter(prefix="/compare", tags=["compare"])


@router.get("")
def compare(ids: List[str] = Query(..., min_length=2, max_length=4)):
    """Compare 2–4 places by their IDs. Not yet implemented."""
    pass
