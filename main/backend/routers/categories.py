"""Categories endpoint — list active categories and guided flow metadata."""
from fastapi import APIRouter, HTTPException

from database import get_supabase
from services.recommendation.category_flow import build_flow_payload, merge_category_row

router = APIRouter(tags=["categories"])


@router.get("/categories")
async def list_categories():
    """Return all active categories."""
    sb = get_supabase()

    try:
        result = (
            sb.table("categories")
            .select("*")
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        rows = result.data or []
        filtered_rows = [row for row in rows if row.get("id") != "transport"]
        return {"categories": [merge_category_row(row, row.get("id", "")) for row in filtered_rows]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/categories/flow/{category_id}")
async def get_category_flow(category_id: str):
    """Return guided flow config for a category, using DB rows when available."""
    sb = get_supabase()

    try:
        category_result = (
            sb.table("categories")
            .select("*")
            .eq("id", category_id)
            .limit(1)
            .execute()
        )
        category_row = (category_result.data or [None])[0]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not category_row:
        raise HTTPException(status_code=404, detail="Category not found")

    subcategories = None
    moods = None

    try:
        sub_result = (
            sb.table("category_subcategories")
            .select("id,label,icon,metadata,sort_order,is_active")
            .eq("category_id", category_id)
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        subcategories = [
            {
                "id": row.get("id"),
                "label": row.get("label"),
                "emoji": row.get("icon"),
                "description": (row.get("metadata") or {}).get("description"),
                "sort_order": row.get("sort_order"),
                "is_active": row.get("is_active"),
            }
            for row in (sub_result.data or [])
        ]
    except Exception:
        subcategories = None

    try:
        mood_result = (
            sb.table("category_moods")
            .select("id,label,icon,metadata,sort_order,is_active")
            .eq("category_id", category_id)
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        moods = [
            {
                "id": row.get("id"),
                "label": row.get("label"),
                "emoji": row.get("icon"),
                "description": (row.get("metadata") or {}).get("description"),
                "sort_order": row.get("sort_order"),
                "is_active": row.get("is_active"),
            }
            for row in (mood_result.data or [])
        ]
    except Exception:
        moods = None

    return build_flow_payload(category_row, subcategories=subcategories, moods=moods)
