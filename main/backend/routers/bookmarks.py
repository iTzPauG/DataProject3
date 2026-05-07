"""Bookmarks / Saved Items endpoints."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional
import uuid

from auth import get_optional_user
from database import get_db

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])


def _safe_uuid(value: Optional[str]) -> Optional[str]:
    """Return value if it parses as a UUID, otherwise None.

    Cloud SQL has UUID columns where the frontend may send non-UUID identifiers
    (e.g. Google Place IDs). Pre-validate to avoid asyncpg DataError 500s.
    """
    if not value:
        return None
    try:
        uuid.UUID(str(value))
        return str(value)
    except (ValueError, AttributeError, TypeError):
        return None

class BookmarkRequest(BaseModel):
    item_type: str
    item_id: str

@router.get("")
async def list_bookmarks(request: Request):
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    async with get_db() as db:
        # We need the local profile id, not the firebase uid
        cursor = await db.execute("SELECT id FROM profiles WHERE firebase_uid=?", (user_id,))
        profile = await cursor.fetchone()
        if not profile:
             return {"bookmarks": []}
        
        query = """
            SELECT 
                s.id as saved_id, s.item_type, s.item_id, s.created_at,
                COALESCE(p.name, e.title, r.title) as title,
                COALESCE(p.lat, e.lat, r.lat) as lat,
                COALESCE(p.lng, e.lng, r.lng) as lng,
                COALESCE(p.category_id, e.category_id, 'report') as category_id,
                p.photo_url as place_photo, e.photo_url as event_photo,
                p.rating, p.price_level
            FROM saved_items s
            LEFT JOIN places p ON s.item_type = 'place' AND s.item_id = p.id
            LEFT JOIN events e ON s.item_type = 'event' AND s.item_id = e.id
            LEFT JOIN community_reports r ON s.item_type = 'report' AND s.item_id = r.id
            WHERE s.user_id = ?
        """
        cursor = await db.execute(query, (profile["id"],))
        rows = await cursor.fetchall()
        
        bookmarks = []
        for r in rows:
            d = dict(r)
            bookmarks.append({
                "id": d["saved_id"],
                "item_type": d["item_type"],
                "item_id": d["item_id"],
                "title": d["title"] or "Unknown",
                "lat": d["lat"] or 0.0,
                "lng": d["lng"] or 0.0,
                "category_id": d["category_id"] or "unknown",
                "created_at": d["created_at"],
                "metadata": {
                    "photo_url": d["place_photo"] or d["event_photo"],
                    "rating": d["rating"],
                    "price_level": d["price_level"]
                }
            })
            
    return {"bookmarks": bookmarks}


@router.get("/{item_id}/check")
async def check_bookmark(item_id: str, request: Request):
    user_id = get_optional_user(request)
    if not user_id:
        return {"bookmarked": False}

    # The Postgres saved_items.item_id column is UUID; non-UUID identifiers
    # (e.g. Google Place IDs like "ChIJQTTQ...") will never match a row, so we
    # short-circuit instead of letting asyncpg raise a DataError.
    safe_item = _safe_uuid(item_id)
    if not safe_item:
        return {"bookmarked": False}

    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM profiles WHERE firebase_uid=?", (user_id,))
        profile = await cursor.fetchone()
        if not profile:
            return {"bookmarked": False}

        cursor = await db.execute(
            "SELECT 1 FROM saved_items WHERE user_id=? AND item_id=? LIMIT 1",
            (profile["id"], safe_item),
        )
        row = await cursor.fetchone()
        return {"bookmarked": bool(row)}

@router.post("")
async def add_bookmark(req: BookmarkRequest, request: Request):
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    safe_item = _safe_uuid(req.item_id)
    if not safe_item:
        raise HTTPException(
            status_code=400,
            detail=(
                "item_id must be a UUID. External provider IDs (e.g. Google Place IDs) "
                "are not supported by the current saved_items schema."
            ),
        )

    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM profiles WHERE firebase_uid=?", (user_id,))
        profile = await cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        try:
            await db.execute(
                "INSERT INTO saved_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
                (str(uuid.uuid4()), profile["id"], req.item_type, safe_item)
            )
            await db.commit()
            return {"status": "ok"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{item_id}")
async def remove_bookmark(item_id: str, request: Request):
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")

    safe_item = _safe_uuid(item_id)
    if not safe_item:
        # Nothing to delete — silent idempotent success.
        return {"status": "ok"}

    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM profiles WHERE firebase_uid=?", (user_id,))
        profile = await cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        await db.execute(
            "DELETE FROM saved_items WHERE user_id=? AND item_id=?",
            (profile["id"], safe_item)
        )
        await db.commit()
    return {"status": "ok"}
