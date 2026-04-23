"""Auth endpoints — profile sync and retrieval via Firebase JWT."""
from typing import Optional
import uuid
import logging

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import get_optional_user
from database import get_db

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/auth", tags=["auth"])


class SyncProfileBody(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


@router.post("/sync")
async def sync_profile(body: SyncProfileBody, request: Request):
    """Create or update the profile for the authenticated Firebase user."""
    firebase_uid = get_optional_user(request)
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Unauthorized")

    new_id = str(uuid.uuid4())
    async with get_db() as db:
        try:
            # SQLite ON CONFLICT doesn't support RETURNING in all versions/wrappers as easily as pg,
            # so we'll do it in two steps for safety or use a modern syntax.
            await db.execute(
                """
                INSERT INTO profiles (id, firebase_uid, display_name, avatar_url)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (firebase_uid) DO UPDATE
                SET display_name = COALESCE(excluded.display_name, profiles.display_name),
                    avatar_url   = COALESCE(excluded.avatar_url,   profiles.avatar_url),
                    updated_at   = CURRENT_TIMESTAMP
                """,
                (new_id, firebase_uid, body.display_name, body.avatar_url),
            )
            await db.commit()
            
            cursor = await db.execute(
                "SELECT id, firebase_uid, display_name, avatar_url, reputation_score, reports_count FROM profiles WHERE firebase_uid=?",
                (firebase_uid,)
            )
            row = await cursor.fetchone()
            return dict(row)
        except Exception as e:
            logger.error(f"Error syncing profile: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/me")
async def get_me(request: Request):
    """Get the current user's profile."""
    firebase_uid = get_optional_user(request)
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Unauthorized")

    async with get_db() as db:
        cursor = await db.execute(
            """SELECT id, firebase_uid, display_name, avatar_url, reputation_score, reports_count
               FROM profiles WHERE firebase_uid=?""",
            (firebase_uid,),
        )
        row = await cursor.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Profile not found. Call /auth/sync first.")
    return dict(row)


@router.patch("/me")
async def update_profile(body: SyncProfileBody, request: Request):
    """Update display name or avatar."""
    firebase_uid = get_optional_user(request)
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Unauthorized")

    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    async with get_db() as db:
        sets = ", ".join(f"{k}=?" for k in data.keys())
        try:
            await db.execute(
                f"UPDATE profiles SET {sets}, updated_at=CURRENT_TIMESTAMP WHERE firebase_uid=?",
                (*data.values(), firebase_uid),
            )
            await db.commit()
            
            cursor = await db.execute(
                "SELECT id, firebase_uid, display_name, avatar_url, reputation_score, reports_count FROM profiles WHERE firebase_uid=?",
                (firebase_uid,)
            )
            row = await cursor.fetchone()
            return dict(row)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
