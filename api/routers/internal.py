from fastapi import APIRouter, Depends
from api.dependencies import require_internal

router = APIRouter()

# These routes are blocked at API Gateway level — only reachable from Cloud Run services

@router.get("/maps/place/{place_id}")
def maps_place(place_id: str, _=Depends(require_internal)):
    pass

@router.get("/maps/reviews/{place_id}")
def maps_reviews(place_id: str, _=Depends(require_internal)):
    pass

@router.get("/tripadvisor/reviews/{location_id}")
def tripadvisor_reviews(location_id: str, _=Depends(require_internal)):
    pass
