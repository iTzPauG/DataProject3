"""Categories endpoint — list active categories and guided flow metadata."""
from fastapi import APIRouter, HTTPException

from database import get_db
from services.recommendation.category_flow import build_flow_payload, merge_category_row

router = APIRouter(tags=["categories"])


@router.get("/categories")
async def list_categories():
    async with get_db() as db:
        try:
            rows = await db.fetch(
                "SELECT * FROM categories WHERE is_active=TRUE ORDER BY sort_order"
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    filtered = [dict(r) for r in rows if r["id"] != "transport"]
    return {"categories": [merge_category_row(row, row.get("id", "")) for row in filtered]}


@router.get("/categories/flow/{category_id}")
async def get_category_flow(category_id: str):
    async with get_db() as db:
        try:
            category_row = await db.fetchrow(
                "SELECT * FROM categories WHERE id=$1", category_id
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        if not category_row:
            raise HTTPException(status_code=404, detail="Category not found")

        category_row = dict(category_row)

        try:
            sub_rows = await db.fetch(
                """SELECT id, label, icon, metadata, sort_order, is_active
                   FROM category_subcategories
                   WHERE category_id=$1 AND is_active=TRUE ORDER BY sort_order""",
                category_id,
            )
            subcategories = [
                {
                    "id": r["id"], "label": r["label"], "emoji": r["icon"],
                    "description": (r["metadata"] or {}).get("description"),
                    "sort_order": r["sort_order"], "is_active": r["is_active"],
                }
                for r in sub_rows
            ]
        except Exception:
            subcategories = None

        try:
            mood_rows = await db.fetch(
                """SELECT id, label, icon, metadata, sort_order, is_active
                   FROM category_moods
                   WHERE category_id=$1 AND is_active=TRUE ORDER BY sort_order""",
                category_id,
            )
            moods = [
                {
                    "id": r["id"], "label": r["label"], "emoji": r["icon"],
                    "description": (r["metadata"] or {}).get("description"),
                    "sort_order": r["sort_order"], "is_active": r["is_active"],
                }
                for r in mood_rows
            ]
        except Exception:
            moods = None

    return build_flow_payload(category_row, subcategories=subcategories, moods=moods)
