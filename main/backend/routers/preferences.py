"""User preferences endpoints."""
from fastapi import APIRouter, HTTPException, Request

from auth import get_optional_user
from config import DEFAULT_MAP_RADIUS_M
from database import get_db
from models.schemas import UserPreferencesResponse, UserPreferencesUpdate

router = APIRouter(prefix="/preferences", tags=["preferences"])

DEFAULT_PREFERENCES = {
    "default_radius_m": DEFAULT_MAP_RADIUS_M,
    "favorite_cats": [],
    "map_style": "standard",
    "map_minimal": False,
    "map_preset": "classic",
    "gado_overlay_on": True,
    "notifications_on": True,
    "language": "es",
}

_PREF_COLS = "default_radius_m,favorite_cats,map_style,map_minimal,map_preset,gado_overlay_on,notifications_on,language"


def _require_user(request: Request) -> str:
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


@router.get("/me", response_model=UserPreferencesResponse)
async def get_preferences(request: Request):
    user_id = _require_user(request)
    async with get_db() as db:
        row = await db.fetchrow(
            f"SELECT {_PREF_COLS} FROM user_preferences WHERE user_id=$1 LIMIT 1",
            user_id,
        )
    data = dict(row) if row else {}
    return UserPreferencesResponse(**{**DEFAULT_PREFERENCES, **data})


@router.put("/me", response_model=UserPreferencesResponse)
async def update_preferences(payload: UserPreferencesUpdate, request: Request):
    user_id = _require_user(request)
    data = payload.model_dump(exclude_unset=True)

    async with get_db() as db:
        if not data:
            row = await db.fetchrow(
                f"SELECT {_PREF_COLS} FROM user_preferences WHERE user_id=$1 LIMIT 1",
                user_id,
            )
            existing = dict(row) if row else {}
            return UserPreferencesResponse(**{**DEFAULT_PREFERENCES, **existing})

        # Build dynamic upsert
        cols = ["user_id"] + list(data.keys())
        vals = [user_id] + list(data.values())
        placeholders = ", ".join(f"${i+1}" for i in range(len(vals)))
        col_names = ", ".join(cols)
        updates = ", ".join(f"{c}=EXCLUDED.{c}" for c in data.keys())

        row = await db.fetchrow(
            f"""INSERT INTO user_preferences ({col_names}) VALUES ({placeholders})
                ON CONFLICT (user_id) DO UPDATE SET {updates}
                RETURNING {_PREF_COLS}""",
            *vals,
        )

    saved = dict(row) if row else {}
    return UserPreferencesResponse(**{**DEFAULT_PREFERENCES, **saved})
