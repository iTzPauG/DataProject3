"""User Preferences — map style, radius, favorites, etc."""
import json
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import get_optional_user
from database import get_db

router = APIRouter(prefix="/preferences", tags=["preferences"])


class PreferencesUpdate(BaseModel):
    default_radius_m: Optional[int] = None
    favorite_cats: Optional[List[str]] = None
    map_style: Optional[str] = None
    map_minimal: Optional[bool] = None
    map_preset: Optional[str] = None
    gado_overlay_on: Optional[bool] = None
    notifications_on: Optional[bool] = None
    language: Optional[str] = None
    theme: Optional[str] = None
    show_real_time_events: Optional[bool] = None


async def _get_profile_id(request: Request) -> str:
    firebase_uid = get_optional_user(request)
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Unauthorized")

    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM profiles WHERE firebase_uid=?", (firebase_uid,))
        p_row = await cursor.fetchone()
        if not p_row:
            raise HTTPException(status_code=404, detail="Profile not found")

    return str(p_row["id"])

async def _ensure_preferences_row(user_id: str):
    async with get_db() as db:
        cursor = await db.execute("SELECT * FROM user_preferences WHERE user_id=?", (user_id,))
        row = await cursor.fetchone()

        if not row:
            await db.execute(
                "INSERT INTO user_preferences (user_id) VALUES (?) ON CONFLICT DO NOTHING",
                (user_id,),
            )
            await db.commit()
            cursor = await db.execute("SELECT * FROM user_preferences WHERE user_id=?", (user_id,))
            row = await cursor.fetchone()

    return row


def _serialize_preferences(row) -> dict:
    res = dict(row)
    if isinstance(res.get("favorite_cats"), str):
        try:
            res["favorite_cats"] = json.loads(res["favorite_cats"])
        except Exception:
            res["favorite_cats"] = []
    return res


@router.get("")
async def get_preferences(request: Request):
    user_id = await _get_profile_id(request)
    row = await _ensure_preferences_row(user_id)
    return _serialize_preferences(row)


async def _update_preferences(body: PreferencesUpdate, request: Request):
    data = body.model_dump(exclude_unset=True)
    if not data:
        return await get_preferences(request)

    if "favorite_cats" in data:
        data["favorite_cats"] = json.dumps(data["favorite_cats"])

    user_id = await _get_profile_id(request)
    await _ensure_preferences_row(user_id)

    async with get_db() as db:
        sets = ", ".join(f"{k}=?" for k in data.keys())
        await db.execute(
            f"UPDATE user_preferences SET {sets}, updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
            (*data.values(), user_id),
        )
        await db.commit()

    return await get_preferences(request)


@router.patch("")
async def patch_preferences(body: PreferencesUpdate, request: Request):
    return await _update_preferences(body, request)


@router.put("")
async def put_preferences(body: PreferencesUpdate, request: Request):
    return await _update_preferences(body, request)


@router.get("/me")
async def get_preferences_me(request: Request):
    return await get_preferences(request)


@router.patch("/me")
async def patch_preferences_me(body: PreferencesUpdate, request: Request):
    return await _update_preferences(body, request)


@router.put("/me")
async def put_preferences_me(body: PreferencesUpdate, request: Request):
    return await _update_preferences(body, request)
