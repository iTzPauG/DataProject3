"""Auth endpoints — profile sync and retrieval via Firebase JWT."""
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import get_optional_user
from database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


class SyncProfileBody(BaseModel):
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None


@router.post("/sync")
async def sync_profile(body: SyncProfileBody, request: Request):
    """Create or update the Cloud SQL profile for the authenticated Firebase user.
    Called by the frontend after every login/register.
    Passwords are managed entirely by Firebase — never stored here.
    """
    firebase_uid = get_optional_user(request)
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Unauthorized")

    async with get_db() as db:
        row = await db.fetchrow(
            """
            INSERT INTO profiles (firebase_uid, display_name, avatar_url)
            VALUES ($1, $2, $3)
            ON CONFLICT (firebase_uid) DO UPDATE
            SET display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
                avatar_url   = COALESCE(EXCLUDED.avatar_url,   profiles.avatar_url),
                updated_at   = now()
            RETURNING id, firebase_uid, display_name, avatar_url, reputation_score, reports_count
            """,
            firebase_uid,
            body.display_name,
            body.avatar_url,
        )
    return dict(row)


@router.get("/me")
async def get_me(request: Request):
    """Get the current user's profile from Cloud SQL."""
    firebase_uid = get_optional_user(request)
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Unauthorized")

    async with get_db() as db:
        row = await db.fetchrow(
            """SELECT id, firebase_uid, display_name, avatar_url, reputation_score, reports_count
               FROM profiles WHERE firebase_uid=$1""",
            firebase_uid,
        )

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
        sets = ", ".join(f"{k}=${i+2}" for i, k in enumerate(data.keys()))
        row = await db.fetchrow(
            f"""UPDATE profiles SET {sets}, updated_at=now()
                WHERE firebase_uid=$1
                RETURNING id, firebase_uid, display_name, avatar_url, reputation_score, reports_count""",
            firebase_uid, *data.values(),
        )

    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    return dict(row)
