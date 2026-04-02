"""Photo proxy endpoint — serves Google Places photos without exposing API key."""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from services.google_places_service import get_photo_bytes

router = APIRouter(tags=["photos"])


@router.get("/photos/google/{photo_name:path}")
async def google_photo_proxy(photo_name: str, maxWidth: int = 800):
    """Proxy Google Places photo to avoid exposing API key to the frontend."""
    photo = await get_photo_bytes(photo_name, max_width=maxWidth)
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    return Response(
        content=photo,
        media_type="image/jpeg",
        headers={"Cache-Control": "public, max-age=86400"},
    )
