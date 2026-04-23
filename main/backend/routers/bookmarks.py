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
        
        cursor = await db.execute("SELECT * FROM saved_items WHERE user_id=?", (profile["id"],))
        rows = await cursor.fetchall()
    return {"bookmarks": [dict(r) for r in rows]}

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
                "INSERT INTO saved_items (id, user_id, item_type, item_id) VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING",
                (str(uuid.uuid4()), profile["id"], req.item_type, req.item_id)
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
    
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM profiles WHERE firebase_uid=?", (user_id,))
        profile = await cursor.fetchone()
        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")
            
        await db.execute(
            "DELETE FROM saved_items WHERE user_id=? AND item_id=?",
            (profile["id"], item_id)
        )
        await db.commit()
    return {"status": "ok"}
