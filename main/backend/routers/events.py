"""Events endpoints — discover and create local events."""
from fastapi import APIRouter, HTTPException, Query, Request

from auth import get_optional_user
from database import get_db
from models.schemas import CreateEventRequest

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/nearby")
async def get_nearby_events(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(default=5000.0),
):
    async with get_db() as db:
        try:
            rows = await db.fetch(
                "SELECT * FROM events WHERE ends_at >= NOW() ORDER BY starts_at LIMIT 50"
            )
            return {"events": [dict(r) for r in rows]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/{event_id}")
async def get_event(event_id: str):
    async with get_db() as db:
        try:
            row = await db.fetchrow("SELECT * FROM events WHERE id=$1", event_id)
            if not row:
                raise HTTPException(status_code=404, detail="Event not found")
            return dict(row)
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=404, detail=f"Event not found: {e}")


@router.post("")
async def create_event(req: CreateEventRequest, request: Request):
    user_id = get_optional_user(request)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    print(f"[EVENTS] Creating event at: {req.lat}, {req.lng} (Title: {req.title})")

    async with get_db() as db:
        try:
            row = await db.fetchrow(
                """INSERT INTO events
                   (created_by, category_id, title, description, lat, lng, location,
                    starts_at, ends_at, photo_url, address, price_info,
                    is_recurring, recurrence, status)
                   VALUES ($1,$2,$3,$4,$5,$6,ST_GeomFromText($7,4326),$8,$9,$10,$11,$12,$13,$14,$15)
                   RETURNING *""",
                user_id, req.category_id, req.title, req.description,
                req.lat, req.lng, f"POINT({req.lng} {req.lat})",
                req.starts_at,
                req.ends_at,
                req.photo_url, req.address, req.price_info,
                req.is_recurring, req.recurrence, req.status,
            )
            return {"event": dict(row)}
        except Exception as e:
            print(f"Error creating event: {e}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
