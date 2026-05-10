"""Internal helpers and proxy routes."""
import json
import logging
from collections import Counter
from typing import Any

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal", tags=["internal"])


def _require_internal(x_internal_secret: str | None):
    """Validate the internal secret header. Configure via SECRET_MANAGER in production."""
    if not x_internal_secret:
        raise HTTPException(status_code=403, detail="Forbidden")


def _row_to_dict(row: Any) -> dict[str, Any]:
    """Normalize aiosqlite.Row, asyncpg.Record, and plain dict rows."""
    return dict(row) if row is not None else {}


def _str_or_none(value: Any) -> str | None:
    return str(value) if value is not None else None


def _json_or_none(value: Any) -> Any:
    if value is None or value == "":
        return None
    if isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return value


@router.get("/maps/place/{place_id}")
def maps_place(place_id: str, x_internal_secret: str | None = Header(None)):
    """Proxy to Google Maps place details. Not yet implemented."""
    _require_internal(x_internal_secret)


@router.get("/maps/reviews/{place_id}")
def maps_reviews(place_id: str, x_internal_secret: str | None = Header(None)):
    """Proxy to Google Maps reviews. Not yet implemented."""
    _require_internal(x_internal_secret)


@router.get("/tripadvisor/reviews/{location_id}")
def tripadvisor_reviews(location_id: str, x_internal_secret: str | None = Header(None)):
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


# User interactions endpoint for AI preferences.

@router.get("/users")
async def list_users(x_internal_secret: str | None = Header(None)):
    """Return all user profiles."""
    _require_internal(x_internal_secret)
    async with get_db() as db:
        cursor = await db.execute(
            """
            SELECT CAST(id AS TEXT) AS id,
                   firebase_uid,
                   display_name,
                   role,
                   reputation_score,
                   reports_count,
                   created_at
            FROM profiles
            ORDER BY created_at DESC
            """
        )
        rows = await cursor.fetchall()

    users = [_row_to_dict(row) for row in rows]
    return {"users": users, "total": len(users)}


@router.get("/users/{firebase_uid}/interactions")
async def get_user_interactions(
    firebase_uid: str,
    x_internal_secret: str | None = Header(None),
):
    """
    Return all recorded interactions for a given user.
    Accepts firebase_uid or internal profile id.
    """
    _require_internal(x_internal_secret)

    async with get_db() as db:
        cursor = await db.execute(
            """
            SELECT CAST(id AS TEXT) AS id,
                   firebase_uid,
                   display_name,
                   role,
                   reputation_score,
                   reports_count,
                   created_at
            FROM profiles
            WHERE firebase_uid = ?
            """,
            (firebase_uid,),
        )
        profile_row = await cursor.fetchone()

        if not profile_row:
            cursor = await db.execute(
                """
                SELECT CAST(id AS TEXT) AS id,
                       firebase_uid,
                       display_name,
                       role,
                       reputation_score,
                       reports_count,
                       created_at
                FROM profiles
                WHERE CAST(id AS TEXT) = ?
                """,
                (firebase_uid,),
            )
            profile_row = await cursor.fetchone()

        if not profile_row:
            raise HTTPException(status_code=404, detail=f"User '{firebase_uid}' not found")

        profile = _row_to_dict(profile_row)
        profile_id = profile["id"]

        cursor = await db.execute(
            """
            SELECT CAST(iv.item_id AS TEXT) AS item_id,
                   COALESCE(p.category_id, 'place') AS item_type,
                   p.name AS title,
                   p.category_id,
                   p.subcategory,
                   p.amenity,
                   p.tags,
                   p.metadata,
                   p.rating,
                   p.price_level,
                   p.lat,
                   p.lng,
                   iv.vote,
                   iv.created_at
            FROM item_votes iv
            LEFT JOIN places p ON CAST(p.id AS TEXT) = CAST(iv.item_id AS TEXT)
            WHERE iv.voter_id LIKE ? || '::%'
            ORDER BY iv.created_at DESC
            """,
            (profile_id,),
        )
        votes_rows = await cursor.fetchall()

        cursor = await db.execute(
            """
            SELECT CAST(si.item_id AS TEXT) AS item_id,
                   si.item_type,
                   COALESCE(si.title, p.name) AS title,
                   COALESCE(si.category_id, p.category_id) AS category_id,
                   p.subcategory,
                   p.amenity,
                   p.tags,
                   p.metadata,
                   p.rating,
                   p.price_level,
                   COALESCE(si.lat, p.lat) AS lat,
                   COALESCE(si.lng, p.lng) AS lng,
                   si.created_at
            FROM saved_items si
            LEFT JOIN places p ON CAST(p.id AS TEXT) = CAST(si.item_id AS TEXT)
            WHERE CAST(si.user_id AS TEXT) = ?
            ORDER BY si.created_at DESC
            """,
            (profile_id,),
        )
        saved_rows = await cursor.fetchall()

        try:
            cursor = await db.execute(
                """
                SELECT query, category, lat, lng, result_count, created_at
                FROM search_history
                WHERE CAST(user_id AS TEXT) = ?
                ORDER BY created_at DESC
                """,
                (profile_id,),
            )
            search_rows = await cursor.fetchall()
        except Exception as exc:
            logger.debug("search_history unavailable for internal export: %s", exc)
            search_rows = []

    votes = [
        {
            "item_id": _str_or_none(row["item_id"]),
            "item_type": row["item_type"],
            "title": row.get("title"),
            "category_id": row.get("category_id"),
            "subcategory": row.get("subcategory"),
            "amenity": row.get("amenity"),
            "tags": _json_or_none(row.get("tags")),
            "metadata": _json_or_none(row.get("metadata")),
            "rating": row.get("rating"),
            "price_level": row.get("price_level"),
            "lat": row.get("lat"),
            "lng": row.get("lng"),
            "vote": row["vote"],
            "created_at": _str_or_none(row["created_at"]),
        }
        for row in (_row_to_dict(r) for r in votes_rows)
    ]

    saved = [
        {
            "item_id": _str_or_none(row["item_id"]),
            "item_type": row.get("item_type"),
            "title": row.get("title"),
            "category_id": row.get("category_id"),
            "subcategory": row.get("subcategory"),
            "amenity": row.get("amenity"),
            "tags": _json_or_none(row.get("tags")),
            "metadata": _json_or_none(row.get("metadata")),
            "rating": row.get("rating"),
            "price_level": row.get("price_level"),
            "lat": row.get("lat"),
            "lng": row.get("lng"),
            "created_at": _str_or_none(row["created_at"]),
        }
        for row in (_row_to_dict(r) for r in saved_rows)
    ]

    searches = [
        {
            "query": row["query"],
            "category": row.get("category"),
            "lat": row.get("lat"),
            "lng": row.get("lng"),
            "result_count": row.get("result_count", 0),
            "created_at": _str_or_none(row["created_at"]),
        }
        for row in (_row_to_dict(r) for r in search_rows)
    ]

    upvotes = sum(1 for vote in votes if vote["vote"] == 1)
    downvotes = sum(1 for vote in votes if vote["vote"] == -1)
    top_voted = [
        cat
        for cat, _ in Counter(
            vote["item_type"] for vote in votes if vote.get("item_type")
        ).most_common(5)
    ]
    top_saved = [
        cat
        for cat, _ in Counter(
            item["category_id"] for item in saved if item.get("category_id")
        ).most_common(5)
    ]
    top_voted_subcategories = [
        sub
        for sub, _ in Counter(
            vote["subcategory"] for vote in votes if vote.get("subcategory")
        ).most_common(5)
    ]
    top_saved_subcategories = [
        sub
        for sub, _ in Counter(
            item["subcategory"] for item in saved if item.get("subcategory")
        ).most_common(5)
    ]

    return {
        "firebase_uid": profile.get("firebase_uid") or firebase_uid,
        "profile": profile,
        "interactions": {
            "votes": votes,
            "saved_items": saved,
            "search_history": searches,
        },
        "summary": {
            "total_votes": len(votes),
            "upvotes": upvotes,
            "downvotes": downvotes,
            "total_saved": len(saved),
            "total_searches": len(searches),
            "top_voted_categories": top_voted,
            "top_saved_categories": top_saved,
            "top_voted_subcategories": top_voted_subcategories,
            "top_saved_subcategories": top_saved_subcategories,
        },
    }
