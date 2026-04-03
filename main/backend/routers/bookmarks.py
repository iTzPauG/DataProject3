"""Bookmarks endpoints — user-saved items."""
from fastapi import APIRouter, HTTPException, Query, Request
from auth import get_optional_user
from database import get_supabase
from pydantic import BaseModel

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])
VALID_ITEM_TYPES = {"place", "event", "report"}

class BookmarkRequest(BaseModel):
    item_type: str
    item_id: str

@router.get("")
async def get_bookmarks(request: Request):
    """Get all bookmarks for the current user."""
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    sb = get_supabase()
    try:
        # Fetch bookmarks and join with places/events if needed
        # For simplicity, we just return the bookmark list
        result = sb.table("saved_items").select("*").eq("user_id", user_id).execute()
        return {"bookmarks": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("")
async def add_bookmark(req: BookmarkRequest, request: Request):
    """Save an item."""
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    if req.item_type not in VALID_ITEM_TYPES:
        raise HTTPException(status_code=400, detail="Invalid item_type")

    sb = get_supabase()
    try:
        row = {
            "user_id": user_id,
            "item_type": req.item_type,
            "item_id": req.item_id
        }
        result = sb.table("saved_items").insert(row).execute()
        return {"status": "ok", "bookmark": result.data[0] if result.data else row}
    except Exception as e:
        # Handle unique constraint violation (already bookmarked)
        if "unique_violation" in str(e).lower() or "already exists" in str(e).lower():
             return {"status": "ok", "message": "Already bookmarked"}
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{item_id}/check")
async def check_bookmark(item_id: str, request: Request, item_type: str | None = Query(default=None)):
    """Check whether a single item is bookmarked by the current user."""
    user_id = get_optional_user(request)
    if not user_id:
        return {"bookmarked": False}

    sb = get_supabase()
    try:
        query = (
            sb.table("saved_items")
            .select("id")
            .eq("user_id", user_id)
            .eq("item_id", item_id)
            .limit(1)
        )
        if item_type:
            query = query.eq("item_type", item_type)
        result = query.execute()
        return {"bookmarked": bool(result.data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{item_id}")
async def remove_bookmark(item_id: str, request: Request, item_type: str | None = Query(default=None)):
    """Remove a bookmark."""
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    sb = get_supabase()
    try:
        query = sb.table("saved_items").delete().eq("user_id", user_id).eq("item_id", item_id)
        if item_type:
            query = query.eq("item_type", item_type)
        query.execute()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
