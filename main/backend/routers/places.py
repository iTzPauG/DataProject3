"""Map / Places endpoints — nearby items and place details."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from database import get_db
from models.schemas import PlaceResult
from services.recommendation.tools import search_generic_category_places
from services.recommendation.pipeline import enrich_place_result
from services.live_data_service import get_live_data

router = APIRouter(prefix="/places", tags=["places"])


@router.get("/nearby")
async def nearby_items(
    lat: float,
    lng: float,
    radius: float = 2000.0,
    categories: Optional[str] = None,
    language: str = "es",
    item_types: list[str] = Query(["place", "event", "report"]),
):
    try:
        places = []
        if "place" in item_types:
            places = await search_generic_category_places(
                parent_category=categories or "food",
                subcategory=None,
                lat=lat,
                lng=lng,
                price_level=None,
                language=language,
            )

        reports = []
        events = []
        now_iso = datetime.now(timezone.utc).isoformat()

        async with get_db() as db:
            if "report" in item_types:
                cursor = await db.execute(
                    """SELECT * FROM community_reports
                       WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
                         AND expires_at >= ?""",
                    (lat - 0.05, lat + 0.05, lng - 0.05, lng + 0.05, now_iso),
                )
                rows = await cursor.fetchall()
                reports = [dict(r) for r in rows]

            if "event" in item_types:
                cursor = await db.execute(
                    """SELECT * FROM events
                       WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
                         AND ends_at >= ?""",
                    (lat - 0.05, lat + 0.05, lng - 0.05, lng + 0.05, now_iso),
                )
                rows = await cursor.fetchall()
                events = [dict(r) for r in rows]

        map_items = []

        for p in places:
            map_items.append({
                "item_id": p["place_id"],
                "item_type": "place",
                "title": p["name"],
                "category_id": p.get("category_id", "food"),
                "lat": p["lat"],
                "lng": p["lng"],
                "distance_m": p.get("distance_m", 0),
                "metadata": {
                    "photo_url": p.get("photo_url", ""),
                    "rating": p.get("rating", 0),
                    "price_level": p.get("price_level", 2),
                    "address": p.get("address", ""),
                    "subcategory": p.get("subcategory", ""),
                    "google_reviews": p.get("google_reviews", []),
                    "review_summary": p.get("review_summary", ""),
                },
            })

        for r in reports:
            map_items.append({
                "item_id": str(r["id"]),
                "item_type": "report",
                "title": r["title"],
                "category_id": "report",
                "lat": r["lat"],
                "lng": r["lng"],
                "metadata": {
                    "report_type": r["report_type"],
                    "description": r["description"],
                    "confidence": r["confidence"],
                    "confirmations": r["confirmations"],
                    "expires_at": r["expires_at"],
                },
            })

        for e in events:
            map_items.append({
                "item_id": str(e["id"]),
                "item_type": "event",
                "title": e["title"],
                "category_id": e["category_id"],
                "lat": e["lat"],
                "lng": e["lng"],
                "metadata": {
                    "photo_url": e.get("photo_url", ""),
                    "starts_at": e["starts_at"],
                    "ends_at": e["ends_at"],
                    "description": e["description"],
                    "price_info": e["price_info"],
                },
            })

        return {"items": map_items}
    except Exception as e:
        print(f"[NEARBY] Error: {e}")
        return {"items": []}


@router.get("/{place_id}/live-data")
async def place_live_data(
    place_id: str,
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    website: Optional[str] = None,
    name: Optional[str] = None,
    city: Optional[str] = None,
):
    try:
        data = await get_live_data(
            category=category,
            subcategory=subcategory,
            lat=lat,
            lng=lng,
            website=website,
            name=name,
            city=city,
        )
        return data
    except Exception as e:
        print(f"[LIVE_DATA] Error for place {place_id}: {e}")
        return {"type": "none"}


@router.get("/{place_id}/take", response_model=PlaceResult)
async def place_take(
    place_id: str,
    lat: float,
    lng: float,
    category: str = "food",
    subcategory: Optional[str] = None,
    language: str = "es",
    name: str = "",
    address: str = "",
    photo_url: str = "",
    rating: Optional[float] = None,
    price_level: Optional[int] = None,
    user_rating_count: Optional[int] = None,
):
    try:
        return await enrich_place_result(
            place_id=place_id,
            parent_category=category,
            subcategory=subcategory,
            lat=lat,
            lng=lng,
            language=language,
            name=name,
            address=address,
            photo_url=photo_url,
            rating=rating,
            price_level=price_level,
            user_rating_count=user_rating_count,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
