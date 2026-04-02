from datetime import datetime, timezone
"""Map / Places endpoints — nearby items and place details."""
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Query

from database import get_supabase
from services.recommendation.category_flow import get_flow_definition
from services.recommendation.tools import (
    search_generic_category_places,
    get_place_details,
)
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
        # 1. Search places using tools
        # tools.search_generic_category_places handles the radius and category filtering
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

        # 2. Get community reports from Supabase
        # We also need reports from the community_reports table
        sb = get_supabase()
        reports = []
        if "report" in item_types:
            reports_res = (
                sb.table("community_reports")
                .select("*")
                .filter("lat", "gte", lat - 0.05)
                .filter("lat", "lte", lat + 0.05)
                .filter("lng", "gte", lng - 0.05)
                .filter("lng", "lte", lng + 0.05)
                .gte("expires_at", datetime.now(timezone.utc).isoformat())
                .execute()
            )
            reports = reports_res.data or []

        # 3. Get active events
        events = []
        if "event" in item_types:
            events_res = (
                sb.table("events")
                .select("*")
                .filter("lat", "gte", lat - 0.05)
                .filter("lat", "lte", lat + 0.05)
                .filter("lng", "gte", lng - 0.05)
                .filter("lng", "lte", lng + 0.05)
                .gte("ends_at", datetime.now(timezone.utc).isoformat())
                .execute()
            )
            events = events_res.data or []

        # 4. Merge results into a common MapItem format
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
                }
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
                }
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
                }
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
    """Fetch live data (prices, duty status) for a specific place."""
    try:
        # If lat/lng missing, try to resolve from place search
        if lat is None or lng is None:
            # We don't have place details here, but live_data service handles it
            pass

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
