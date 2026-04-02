"""Events endpoints — discover and create local events."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from auth import get_optional_user
from database import get_supabase
from models.schemas import CreateEventRequest

router = APIRouter(prefix="/events", tags=["events"])


@router.get("/nearby")
async def get_nearby_events(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius: float = Query(default=5000.0, description="Search radius in metres"),
):
    """Get events near a location.

    TODO: Implement PostGIS spatial query or Supabase RPC call.
    """
    sb = get_supabase()

    try:
        # TODO: Replace with a proper PostGIS / RPC spatial query.
        # For now, return all upcoming events (placeholder).
        result = (
            sb.table("events")
            .select("*")
            .gte("ends_at", "now()")
            .order("starts_at")
            .limit(50)
            .execute()
        )
        return {"events": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{event_id}")
async def get_event(event_id: str):
    """Get a single event by ID."""
    sb = get_supabase()

    try:
        result = (
            sb.table("events")
            .select("*")
            .eq("id", event_id)
            .single()
            .execute()
        )
        return result.data
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"Event not found: {e}")


@router.post("")
async def create_event(req: CreateEventRequest, request: Request):
    """Create a new event."""
    user_id = get_optional_user(request)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    sb = get_supabase()

    try:
        # Log coordinates to verify current location requirement
        print(f"[EVENTS] Creating event at: {req.lat}, {req.lng} (Title: {req.title})")

        row = {
            "created_by": user_id,
            "category_id": req.category_id,
            "title": req.title,
            "description": req.description,
            "lat": req.lat,
            "lng": req.lng,
            # Use WKT for reliable PostGIS parsing via PostgREST
            "location": f"POINT({req.lng} {req.lat})",
            "starts_at": req.starts_at.isoformat(),
            "ends_at": req.ends_at.isoformat() if req.ends_at else None,
            "photo_url": req.photo_url,
            "address": req.address,
            "price_info": req.price_info,
            "is_recurring": req.is_recurring,
            "recurrence": req.recurrence,
            "status": req.status,
        }
        result = sb.table("events").insert(row).execute()
        
        if hasattr(result, 'error') and result.error:
            raise Exception(result.error.message if hasattr(result.error, 'message') else str(result.error))
            
        if not result.data:
            return {"event": row}
            
        return {"event": result.data[0]}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating event: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
