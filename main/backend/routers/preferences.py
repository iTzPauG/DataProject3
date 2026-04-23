"""User Preferences — map style, radius, favorites, etc."""
import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List

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


@router.get("")
async def get_preferences(request: Request):
    firebase_uid = get_optional_user(request)
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Unauthorized")

    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM profiles WHERE firebase_uid=?", (firebase_uid,))
        p_row = await cursor.fetchone()
        if not p_row:
            raise HTTPException(status_code=404, detail="Profile not found")

        cursor = await db.execute("SELECT * FROM user_preferences WHERE user_id=?", (p_row["id"],))
        row = await cursor.fetchone()
        
        if not row:
            # Default preferences
            await db.execute(
                "INSERT INTO user_preferences (user_id) VALUES (?) ON CONFLICT DO NOTHING",
                (p_row["id"],)
            )
            await db.commit()
            cursor = await db.execute("SELECT * FROM user_preferences WHERE user_id=?", (p_row["id"],))
            row = await cursor.fetchone()

    res = dict(row)
    if isinstance(res.get("favorite_cats"), str):
        try:
            res["favorite_cats"] = json.loads(res["favorite_cats"])
        except:
            res["favorite_cats"] = []
    return res


@router.patch("")
async def update_preferences(body: PreferencesUpdate, request: Request):
    firebase_uid = get_optional_user(request)
    if not firebase_uid:
        raise HTTPException(status_code=401, detail="Unauthorized")

    data = body.model_dump(exclude_unset=True)
    if not data:
        return await get_preferences(request)

    if "favorite_cats" in data:
        data["favorite_cats"] = json.dumps(data["favorite_cats"])

    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM profiles WHERE firebase_uid=?", (firebase_uid,))
        p_row = await cursor.fetchone()
        if not p_row:
            raise HTTPException(status_code=404, detail="Profile not found")

        sets = ", ".join(f"{k}=?" for k in data.keys())
        await db.execute(
            f"UPDATE user_preferences SET {sets}, updated_at=CURRENT_TIMESTAMP WHERE user_id=?",
            (*data.values(), p_row["id"]),
        )
        await db.commit()

    return await get_preferences(request)
