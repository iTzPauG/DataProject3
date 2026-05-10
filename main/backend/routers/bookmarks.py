"""Bookmarks / Saved Items endpoints."""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
import uuid

from auth import get_optional_user
from database import get_db

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])

class BookmarkRequest(BaseModel):
    item_type: str
    item_id: str
    title: str = ""
    lat: float = 0.0
    lng: float = 0.0
    photo_url: str = ""
    category_id: str = ""

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
            SELECT id as saved_id, item_type, item_id, created_at,
                   title, lat, lng, photo_url, category_id
            FROM saved_items
            WHERE user_id::text = ?
        """
        cursor = await db.execute(query, (str(profile["id"]),))
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
                "category_id": d["category_id"] or "place",
                "created_at": d["created_at"],
                "metadata": {
                    "photo_url": d["photo_url"],
                }
            })
            
    return {"bookmarks": bookmarks}

@router.post("")
async def add_bookmark(req: BookmarkRequest, request: Request):
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM profiles WHERE firebase_uid=?", (user_id,))
        profile = await cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
            
        try:
            await db.execute(
                "INSERT INTO saved_items (id, user_id, item_type, item_id, title, lat, lng, photo_url, category_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
                (str(uuid.uuid4()), str(profile["id"]), req.item_type, req.item_id,
                 req.title or None, req.lat or None, req.lng or None, req.photo_url or None, req.category_id or None)
            )
            await db.commit()
            return {"status": "ok"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/{item_id}/check")
async def check_bookmark(item_id: str, request: Request):
    user_id = get_optional_user(request)
    if not user_id:
        return {"bookmarked": False}

    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM profiles WHERE firebase_uid=?", (user_id,))
        profile = await cursor.fetchone()
        if not profile:
            return {"bookmarked": False}

        cursor = await db.execute(
            "SELECT 1 FROM saved_items WHERE user_id::text=? AND item_id=?",
            (str(profile["id"]), item_id)
        )
        row = await cursor.fetchone()
    return {"bookmarked": row is not None}


@router.delete("/{item_id}")
async def remove_bookmark(item_id: str, request: Request):
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM profiles WHERE firebase_uid=?", (user_id,))
        profile = await cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
            
        await db.execute(
            "DELETE FROM saved_items WHERE user_id::text=? AND item_id=?",
            (str(profile["id"]), item_id)
        )
        await db.commit()
    return {"status": "ok"}
