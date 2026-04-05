"""Bookmarks endpoints — user-saved items."""
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from auth import get_optional_user
from database import get_db

router = APIRouter(prefix="/bookmarks", tags=["bookmarks"])
VALID_ITEM_TYPES = {"place", "event", "report"}


class BookmarkRequest(BaseModel):
    item_type: str
    item_id: str


@router.get("")
async def get_bookmarks(request: Request):
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    async with get_db() as db:
        try:
            rows = await db.fetch("SELECT * FROM saved_items WHERE user_id=$1", user_id)
            return {"bookmarks": [dict(r) for r in rows]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.post("")
async def add_bookmark(req: BookmarkRequest, request: Request):
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    if req.item_type not in VALID_ITEM_TYPES:
        raise HTTPException(status_code=400, detail="Invalid item_type")

    async with get_db() as db:
        try:
            row = await db.fetchrow(
                """INSERT INTO saved_items (user_id, item_type, item_id)
                   VALUES ($1, $2, $3)
                   ON CONFLICT DO NOTHING
                   RETURNING *""",
                user_id, req.item_type, req.item_id,
            )
            if row is None:
                return {"status": "ok", "message": "Already bookmarked"}
            return {"status": "ok", "bookmark": dict(row)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/{item_id}/check")
async def check_bookmark(item_id: str, request: Request, item_type: str | None = Query(default=None)):
    user_id = get_optional_user(request)
    if not user_id:
        return {"bookmarked": False}

    async with get_db() as db:
        try:
            if item_type:
                row = await db.fetchrow(
                    "SELECT id FROM saved_items WHERE user_id=$1 AND item_id=$2 AND item_type=$3 LIMIT 1",
                    user_id, item_id, item_type,
                )
            else:
                row = await db.fetchrow(
                    "SELECT id FROM saved_items WHERE user_id=$1 AND item_id=$2 LIMIT 1",
                    user_id, item_id,
                )
            return {"bookmarked": row is not None}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{item_id}")
async def remove_bookmark(item_id: str, request: Request, item_type: str | None = Query(default=None)):
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    async with get_db() as db:
        try:
            if item_type:
                await db.execute(
                    "DELETE FROM saved_items WHERE user_id=$1 AND item_id=$2 AND item_type=$3",
                    user_id, item_id, item_type,
                )
            else:
                await db.execute(
                    "DELETE FROM saved_items WHERE user_id=$1 AND item_id=$2",
                    user_id, item_id,
                )
            return {"status": "ok"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
