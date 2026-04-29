"""Carta endpoint: Netflix-style restaurant sections."""
from __future__ import annotations

from fastapi import APIRouter, Query

from services.recommendation.carta import get_carta_sections

router = APIRouter(tags=["carta"])


@router.get("/api/carta")
async def carta_recommendations(
    lat: float = Query(..., description="User latitude"),
    lng: float = Query(..., description="User longitude"),
    price_level: int | None = Query(default=None, ge=1, le=3),
    language: str = Query(default="es"),
):
    try:
        return await get_carta_sections(
            lat=lat,
            lng=lng,
            price_level=price_level,
            language=language or "es",
        )
    except Exception:
        # Controlled fallback: never break the app.
        return {"sections": [], "error": "internal_error"}
