"""User preferences endpoints."""
from fastapi import APIRouter, HTTPException, Request

from auth import get_optional_user
from config import DEFAULT_MAP_RADIUS_M
from database import get_supabase
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


def _require_user(request: Request) -> str:
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")
    return user_id


@router.get("/me", response_model=UserPreferencesResponse)
async def get_preferences(request: Request):
    user_id = _require_user(request)
    sb = get_supabase()

    result = (
        sb.table("user_preferences")
        .select(
            "default_radius_m,favorite_cats,map_style,map_minimal,map_preset,gado_overlay_on,notifications_on,language"
        )
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )
    row = (result.data or [{}])[0]
    return UserPreferencesResponse(**{**DEFAULT_PREFERENCES, **row})


@router.put("/me", response_model=UserPreferencesResponse)
async def update_preferences(payload: UserPreferencesUpdate, request: Request):
    user_id = _require_user(request)
    sb = get_supabase()

    data = payload.model_dump(exclude_unset=True)
    if not data:
        current = (
            sb.table("user_preferences")
            .select(
                "default_radius_m,favorite_cats,map_style,map_minimal,map_preset,gado_overlay_on,notifications_on,language"
            )
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        row = (current.data or [{}])[0]
        return UserPreferencesResponse(**{**DEFAULT_PREFERENCES, **row})

    data["user_id"] = user_id
    result = sb.table("user_preferences").upsert(data, on_conflict="user_id").execute()
    row = (result.data or [{}])[0]
    return UserPreferencesResponse(**{**DEFAULT_PREFERENCES, **row})
