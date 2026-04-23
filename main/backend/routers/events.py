"""Events endpoints — temporary and recurring local events."""
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from database import get_db

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/nearby")
async def get_nearby_events(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(default=5000.0),
    category: str | None = Query(default=None),
):
    # Simple bounding box for SQLite
    delta = radius / 111000.0
    min_lat, max_lat = lat - delta, lat + delta
    min_lng, max_lng = lng - delta, lng + delta
    now_iso = datetime.now(timezone.utc).isoformat()

    async with get_db() as db:
        try:
            sql = "SELECT * FROM events WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? AND status='active' AND ends_at >= ?"
            params = [min_lat, max_lat, min_lng, max_lng, now_iso]
            if category:
                sql += " AND category_id=?"
                params.append(category)
            
            cursor = await db.execute(sql, params)
            rows = await cursor.fetchall()
            return {"events": [dict(r) for r in rows]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/{event_id}")
async def get_event(event_id: str):
    async with get_db() as db:
        try:
            cursor = await db.execute("SELECT * FROM events WHERE id=?", (event_id,))
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Event not found")
            return dict(row)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
