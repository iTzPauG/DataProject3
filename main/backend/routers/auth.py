"""Auth endpoints — local profile sync bypass."""
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
    """Create or update the profile for the local test user."""
    firebase_uid = get_optional_user(request)
    
    new_id = str(uuid.uuid4())
    async with get_db() as db:
        try:
            await db.execute(
                """
                INSERT INTO profiles (id, firebase_uid, display_name, avatar_url)
                VALUES (?, ?, ?, ?)
                ON CONFLICT (firebase_uid) DO UPDATE
                SET display_name = COALESCE(excluded.display_name, profiles.display_name),
                    avatar_url   = COALESCE(excluded.avatar_url,   profiles.avatar_url),
                    updated_at   = CURRENT_TIMESTAMP
                """,
                (new_id, firebase_uid, body.display_name or "Local User", body.avatar_url),
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
    """Get the local test user's profile."""
    firebase_uid = get_optional_user(request)

    async with get_db() as db:
        cursor = await db.execute(
            """SELECT id, firebase_uid, display_name, avatar_url, reputation_score, reports_count
               FROM profiles WHERE firebase_uid=?""",
            (firebase_uid,),
        )
        row = await cursor.fetchone()

    if not row:
        # Auto-sync for local dev if not found
        return await sync_profile(SyncProfileBody(), request)
    return dict(row)
