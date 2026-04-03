from fastapi import APIRouter, Query
from typing import List

router = APIRouter()

@router.get("")
def compare(ids: List[str] = Query(..., min_length=2, max_length=4)):
    pass
