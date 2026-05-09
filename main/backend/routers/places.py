"""Map / Places endpoints — nearby items and place details."""
import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

from auth import get_optional_user, get_voter_id
from database import get_db
from models.schemas import PlaceResult
from .report_helpers import insert_community_report, report_row_to_dict
from services.brain_service import ask_brain
from services.cache_service import cache_get, cache_set
from services.recommendation.tools import search_generic_category_places
from services.recommendation.tools import _normalize_google_price_level
from services.overpass_service import search_overpass
from services.recommendation.pipeline import enrich_place_result
from services.live_data_service import get_live_data

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/places", tags=["places"])


def _normalize_query_price_level(raw_price_level: object) -> int | None:
    return _normalize_google_price_level(raw_price_level)


def _coerce_optional_int(raw_value: object) -> int | None:
    if raw_value is None:
        return None
    text = str(raw_value).strip()
    if not text:
        return None
    try:
        return int(text)
    except ValueError:
        return None


@router.get("/nearby")
async def nearby_items(
    lat: float,
    lng: float,
    radius: float = 2000.0,
    categories: Optional[str] = None,
    subcategory: Optional[str] = None,
    language: str = "es",
    item_types: list[str] = Query(["place", "event", "report"]),
):
    try:
        places = []
        if "place" in item_types:
            # Query Google Places and OSM in parallel for maximum coverage
            raw = await asyncio.gather(
                search_generic_category_places(
                    parent_category=categories or "food",
                    subcategory=subcategory,
                    mood=None,
                    lat=lat,
                    lng=lng,
                    price_level=None,
                    language=language,
                ),
                search_overpass(
                    lat=lat,
                    lng=lng,
                    radius_m=int(radius),
                    category=categories or "food",
                    limit=40,
                ),
                return_exceptions=True,
            )
            google_results = raw[0] if not isinstance(raw[0], Exception) else []
            osm_results = raw[1] if not isinstance(raw[1], Exception) else []

            places = list(google_results)

            # Merge OSM results that aren't already covered by Google
            google_names = {p.get("name", "").lower() for p in places}
            for osm in osm_results:
                name = osm.get("name", "")
                if not name or name.lower() in google_names:
                    continue
                places.append({
                    "place_id": f"osm_{osm['osm_id']}",
                    "name": name,
                    "lat": osm["lat"],
                    "lng": osm["lng"],
                    "address": osm.get("address", ""),
                    "rating": 0,
                    "price_level": None,
                    "photo_url": "",
                    "distance_m": 0,
                    "category_id": categories or "food",
                    "subcategory": osm.get("amenity") or subcategory or "",
                    "google_reviews": [],
                    "review_summary": "",
                })

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
                reports = [report_row_to_dict(r) for r in rows]

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
    price_level: Optional[str] = None,
    user_rating_count: Optional[str] = None,
):
    try:
        normalized_price_level = _normalize_query_price_level(price_level)
        normalized_user_rating_count = _coerce_optional_int(user_rating_count)
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
            price_level=normalized_price_level,
            user_rating_count=normalized_user_rating_count,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ─── Per-place live comments ────────────────────────────────────────────────

class PlaceCommentCreate(BaseModel):
    place_id: str
    place_name: Optional[str] = None
    lat: float
    lng: float
    title: Optional[str] = Field(default=None, max_length=140)
    description: Optional[str] = None
    report_type: str = "comment"
    duration_hours: int = 6

_REPORT_TYPE_FALLBACK_TITLES: dict[str, str] = {
    "comment": "Comentario",
    "queue": "Cola larga",
    "noise": "Ruidoso",
    "live_music": "Musica en vivo",
    "free_stuff": "Gratis",
    "food_truck": "Food truck",
    "popup_market": "Mercadillo",
    "street_show": "Espectaculo",
    "other": "Otro",
}


def _normalize_report_title(report_type: str, raw_title: Optional[str]) -> str:
    normalized_type = (report_type or "comment").strip().lower() or "comment"
    title = (raw_title or "").strip()

    # Custom comments require user-provided text.
    if normalized_type == "comment":
        if len(title) < 2:
            raise HTTPException(
                status_code=422,
                detail="El titular es obligatorio para la opcion comentario.",
            )
        return title

    # Quick presets can be sent without title; we synthesize one from the type.
    if title:
        return title

    fallback = _REPORT_TYPE_FALLBACK_TITLES.get(normalized_type)
    if fallback:
        return fallback
    humanized = normalized_type.replace("_", " ").strip()
    return humanized.title() if humanized else "Aviso"

def _bbox_for(lat: float, lng: float, radius_m: float) -> tuple[float, float, float, float]:
    delta = radius_m / 111000.0
    return lat - delta, lat + delta, lng - delta, lng + delta

def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    from math import asin, cos, radians, sin, sqrt
    r = 6371000.0
    dlat = radians(lat2 - lat1)
    dlng = radians(lng2 - lng1)
    a = sin(dlat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng / 2) ** 2
    return 2 * r * asin(sqrt(a))

@router.get("/comments")
async def list_place_comments(
    lat: float,
    lng: float,
    radius_m: float = 80.0,
    hours: int = 24,
):
    """Recent reports near a place — used as 'live comments' on the restaurant page."""
    min_lat, max_lat, min_lng, max_lng = _bbox_for(lat, lng, radius_m)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    async with get_db() as db:
        try:
            cursor = await db.execute(
                """SELECT * FROM community_reports
                   WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
                     AND is_active
                     AND created_at >= ?
                   ORDER BY created_at DESC
                   LIMIT 30""",
                (min_lat, max_lat, min_lng, max_lng, cutoff),
            )
            rows = await cursor.fetchall()
        except Exception as exc:
            logger.error("Error listing place comments: %s", exc)
            return {"comments": []}

    comments: list[dict] = []
    for row in rows:
        d = report_row_to_dict(row)
        dist = _haversine_m(lat, lng, d.get("lat", lat), d.get("lng", lng))
        if dist > radius_m:
            continue
        d["distance_m"] = int(dist)
        comments.append(d)
    return {"comments": comments}

def _safe_uuid_or_none(value: Optional[str]) -> Optional[str]:
    """Return value if it parses as a UUID; otherwise None.

    Cloud SQL community_reports.created_by is UUID. The local auth bypass
    returns the literal string 'local-user' which Postgres rejects, so we
    fall back to anonymous mode for any non-UUID identifier.
    """
    if not value:
        return None
    try:
        uuid.UUID(str(value))
        return str(value)
    except (ValueError, AttributeError, TypeError):
        return None


@router.post("/comments")
async def create_place_comment(req: PlaceCommentCreate, request: Request):
    raw_user_id = get_optional_user(request)
    # Postgres needs a real UUID or NULL; treat dev-mode/non-UUID tokens as anon.
    safe_user_id = _safe_uuid_or_none(raw_user_id)
    anon_fp = get_voter_id(request) if safe_user_id is None else None

    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(hours=max(1, req.duration_hours))).isoformat()
    report_id = str(uuid.uuid4())
    report_type = (req.report_type or "comment").strip().lower() or "comment"

    async with get_db() as db:
        try:
            await insert_community_report(
                db,
                report_id=report_id,
                created_by=safe_user_id,
                anon_fingerprint=anon_fp,
                report_type=report_type,
                title=_normalize_report_title(report_type, req.title),
                description=(req.description or "").strip() or None,
                lat=req.lat,
                lng=req.lng,
                address_hint=req.place_name,
                created_at=now.isoformat(),
                expires_at=expires_at,
            )
            await db.commit()
            cursor = await db.execute("SELECT * FROM community_reports WHERE id=?", (report_id,))
            row = await cursor.fetchone()
            return {"comment": report_row_to_dict(row) if row else {"id": report_id}}
        except HTTPException:
            raise
        except Exception as exc:
            logger.error("Error creating place comment: %s", exc)
            raise HTTPException(status_code=500, detail=f"Could not create comment: {str(exc)}")

@router.get("/comments/summary")
async def summarise_place_comments(
    lat: float,
    lng: float,
    place_name: Optional[str] = None,
    hours: int = 24,
    radius_m: float = 80.0,
    language: str = "es",
):
    """LLM-generated summary of recent comments near a place."""
    cache_key = f"place_comments_summary:v1:{lat:.5f}:{lng:.5f}:{int(radius_m)}:{hours}:{language}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    listing = await list_place_comments(lat=lat, lng=lng, radius_m=radius_m, hours=hours)
    comments = listing.get("comments", [])

    if not comments:
        result = {"summary": None, "count": 0, "comments": []}
        return result

    snippets = []
    for c in comments[:15]:
        title = c.get("title") or ""
        desc = c.get("description") or ""
        rt = c.get("report_type") or "comment"
        snippets.append(f"- [{rt}] {title}{(' — ' + desc) if desc else ''}")

    name_part = f" en {place_name}" if place_name else ""
    prompt = (
        f"Resume estos {len(snippets)} comentarios recientes de usuarios{name_part}. "
        f"Devuelve 1-2 frases neutras en {language}, captando el sentimiento general "
        f"y las observaciones repetidas. No inventes datos. Si los comentarios son "
        f"contradictorios, dilo. Comentarios:\n" + "\n".join(snippets)
    )

    summary_text: Optional[str] = None
    try:
        brain = await ask_brain(prompt)
        summary_text = (brain or {}).get("response") if isinstance(brain, dict) else None
        if not summary_text and isinstance(brain, dict):
            summary_text = brain.get("text") or None
    except Exception as exc:
        logger.warning("Comment summary failed: %s", exc)

    result = {
        "summary": summary_text,
        "count": len(comments),
        "comments": comments[:5],
    }
    await cache_set(cache_key, result, ttl=120)
    return result
