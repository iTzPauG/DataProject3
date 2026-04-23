"""Categories endpoint — list active categories and guided flow metadata."""
from fastapi import APIRouter, HTTPException
import json

from database import get_db
from services.recommendation.category_flow import build_flow_payload, merge_category_row

router = APIRouter(tags=["categories"])


@router.get("/categories")
async def list_categories():
    async with get_db() as db:
        try:
            cursor = await db.execute(
                "SELECT * FROM categories WHERE is_active=1 ORDER BY sort_order"
            )
            rows = await cursor.fetchall()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    filtered = [dict(r) for r in rows if r["id"] != "transport"]
    return {"categories": [merge_category_row(row, row.get("id", "")) for row in filtered]}


@router.get("/categories/flow/{category_id}")
async def get_category_flow(category_id: str):
    async with get_db() as db:
        try:
            cursor = await db.execute(
                "SELECT * FROM categories WHERE id=?", (category_id,)
            )
            category_row = await cursor.fetchone()
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

        if not category_row:
            raise HTTPException(status_code=404, detail="Category not found")

        category_row = dict(category_row)

        try:
            cursor = await db.execute(
                """SELECT id, label, icon, metadata, sort_order, is_active
                   FROM category_subcategories
                   WHERE category_id=? AND is_active=1 ORDER BY sort_order""",
                (category_id,),
            )
            sub_rows = await cursor.fetchall()
            subcategories = []
            for r in sub_rows:
                meta = {}
                if r["metadata"]:
                    try:
                        meta = json.loads(r["metadata"]) if isinstance(r["metadata"], str) else r["metadata"]
                    except:
                        meta = {}
                subcategories.append({
                    "id": r["id"], "label": r["label"], "emoji": r["icon"],
                    "description": meta.get("description"),
                    "sort_order": r["sort_order"], "is_active": r["is_active"],
                })
        except Exception:
            subcategories = None

        try:
            cursor = await db.execute(
                """SELECT id, label, icon, metadata, sort_order, is_active
                   FROM category_moods
                   WHERE category_id=? AND is_active=1 ORDER BY sort_order""",
                (category_id,),
            )
            mood_rows = await cursor.fetchall()
            moods = []
            for r in mood_rows:
                meta = {}
                if r["metadata"]:
                    try:
                        meta = json.loads(r["metadata"]) if isinstance(r["metadata"], str) else r["metadata"]
                    except:
                        meta = {}
                moods.append({
                    "id": r["id"], "label": r["label"], "emoji": r["icon"],
                    "description": meta.get("description"),
                    "sort_order": r["sort_order"], "is_active": r["is_active"],
                })
        except Exception:
            moods = None

    return build_flow_payload(category_row, subcategories=subcategories, moods=moods)
