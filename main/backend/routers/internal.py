"""Internal helpers and proxy routes."""
import json
import logging
from collections import Counter

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

from database import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/internal", tags=["internal"])


def _require_internal(x_internal_secret: str | None):
    """Validate the internal secret header. Configure via SECRET_MANAGER in production."""
    if not x_internal_secret:
        raise HTTPException(status_code=403, detail="Forbidden")


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


# ── User Interactions endpoint (for AI preferences algorithm) ─────────────────

@router.get("/users/{firebase_uid}/interactions")
async def get_user_interactions(
    firebase_uid: str,
    x_internal_secret: str | None = Header(None),
):
    """
    Return all recorded interactions for a given user.

    Used by the AI team to build preference / recommendation models.
    Reproducible across dev-data, dev-ia and main environments.

    Requires header:  X-Internal-Secret: <any non-empty value>

    Response shape:
    {
      "firebase_uid": "...",
      "profile": { id, display_name, role, reputation_score, ... },
      "interactions": {
        "votes":          [{ item_id, item_type, vote, created_at }],
        "saved_items":    [{ item_id, item_type, title, category_id, lat, lng, created_at }],
        "search_history": [{ query, category, lat, lng, result_count, created_at }]
      },
      "summary": {
        "total_votes": N, "upvotes": N, "downvotes": N,
        "total_saved": N, "total_searches": N,
        "top_voted_categories": [...],
        "top_saved_categories": [...]
      }
    }
    """
    _require_internal(x_internal_secret)

    async with get_db() as db:
        # 1. Fetch profile
        cursor = await db.execute(
            """
            SELECT id::text AS id, firebase_uid, display_name, role,
                   reputation_score, reports_count, created_at
            FROM profiles
            WHERE firebase_uid = ?
            """,
            (firebase_uid,),
        )
        profile_row = await cursor.fetchone()
        if not profile_row:
            raise HTTPException(status_code=404, detail=f"User '{firebase_uid}' not found")

        profile_id = profile_row["id"]

        # 2. Votes  (voter_id = "{profile_uuid}::{item_id}")
        cursor = await db.execute(
            """
            SELECT iv.item_id, iv.vote, iv.created_at,
                   p.category_id AS item_type
            FROM item_votes iv
            LEFT JOIN places p ON p.id::text = iv.item_id
            WHERE iv.voter_id LIKE ? || '::%'
            ORDER BY iv.created_at DESC
            """,
            (profile_id,),
        )
        votes_rows = await cursor.fetchall()

        # 3. Saved items  (user_id = profile.id UUID)
        cursor = await db.execute(
            """
            SELECT item_id, item_type, title, category_id,
                   lat, lng, created_at
            FROM saved_items
            WHERE user_id::text = ?
            ORDER BY created_at DESC
            """,
            (profile_id,),
        )
        saved_rows = await cursor.fetchall()

        # 4. Search history  (user_id = profile.id UUID)
        cursor = await db.execute(
            """
            SELECT query, category, lat, lng, result_count, created_at
            FROM search_history
            WHERE user_id::text = ?
            ORDER BY created_at DESC
            """,
            (profile_id,),
        )
        search_rows = await cursor.fetchall()

    # ── Serialize ──────────────────────────────────────────────────────────

    def _str(v):
        return str(v) if v is not None else None

    votes = [
        {
            "item_id": _str(r["item_id"]),
            "item_type": r.get("item_type"),
            "vote": r["vote"],
            "created_at": _str(r["created_at"]),
        }
        for r in votes_rows
    ]

    saved = [
        {
            "item_id": _str(r["item_id"]),
            "item_type": r.get("item_type"),
            "title": r.get("title"),
            "category_id": r.get("category_id"),
            "lat": r.get("lat"),
            "lng": r.get("lng"),
            "created_at": _str(r["created_at"]),
        }
        for r in saved_rows
    ]

    searches = [
        {
            "query": r["query"],
            "category": r.get("category"),
            "lat": r.get("lat"),
            "lng": r.get("lng"),
            "result_count": r.get("result_count", 0),
            "created_at": _str(r["created_at"]),
        }
        for r in search_rows
    ]

    # ── Summary ────────────────────────────────────────────────────────────

    upvotes = sum(1 for v in votes if v["vote"] == 1)
    downvotes = sum(1 for v in votes if v["vote"] == -1)

    top_voted = [
        cat for cat, _ in Counter(
            v["item_type"] for v in votes if v.get("item_type")
        ).most_common(5)
    ]
    top_saved = [
        cat for cat, _ in Counter(
            s["category_id"] for s in saved if s.get("category_id")
        ).most_common(5)
    ]

    return {
        "firebase_uid": firebase_uid,
        "profile": dict(profile_row),
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
        },
    }
