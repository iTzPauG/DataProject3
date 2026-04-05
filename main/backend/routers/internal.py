"""Internal proxy routes — only reachable from other Cloud Run services via API Gateway."""
from fastapi import APIRouter, Header, HTTPException

router = APIRouter(prefix="/internal", tags=["internal"])


def _require_internal(x_internal_secret: str = Header(...)):
    """Validate the internal secret header. Configure via SECRET_MANAGER in production."""
    if not x_internal_secret:
        raise HTTPException(status_code=403, detail="Forbidden")


@router.get("/maps/place/{place_id}")
def maps_place(place_id: str, x_internal_secret: str = Header(...)):
    """Proxy to Google Maps place details. Not yet implemented."""
    _require_internal(x_internal_secret)


@router.get("/maps/reviews/{place_id}")
def maps_reviews(place_id: str, x_internal_secret: str = Header(...)):
    """Proxy to Google Maps reviews. Not yet implemented."""
    _require_internal(x_internal_secret)


@router.get("/tripadvisor/reviews/{location_id}")
def tripadvisor_reviews(location_id: str, x_internal_secret: str = Header(...)):
    """Proxy to TripAdvisor reviews. Not yet implemented."""
    _require_internal(x_internal_secret)
