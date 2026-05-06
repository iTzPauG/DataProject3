"""Internal helpers and proxy routes."""
import json
import logging

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)

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


class ClientLogPayload(BaseModel):
    timestamp: str | None = None
    level: str
    message: str
    data: dict | list | str | int | float | bool | None = None
    source: str = "frontend"
    href: str | None = None
    user_agent: str | None = None


@router.post("/client-log", include_in_schema=False)
async def client_log(payload: ClientLogPayload):
    """Mirror client-side logs into backend stdout for easier debugging."""
    prefix = f"[CLIENT:{payload.source}:{payload.level.upper()}]"
    parts = [prefix, payload.message]

    if payload.href:
        parts.append(f"url={payload.href}")

    if payload.timestamp:
        parts.append(f"ts={payload.timestamp}")

    line = " ".join(parts)

    if payload.data is not None:
        try:
            serialized = json.dumps(payload.data, ensure_ascii=True, default=str)
        except TypeError:
            serialized = str(payload.data)
        line = f"{line} data={serialized}"

    if payload.level.upper() == "ERROR":
        logger.error(line)
    elif payload.level.upper() == "WARN":
        logger.warning(line)
    else:
        logger.info(line)

    return {"ok": True}
