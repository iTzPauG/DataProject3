"""Reports endpoints — community-driven incident reports."""
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header

from auth import get_optional_user, get_voter_id
from config import DEFAULT_REPORT_DURATION_HOURS, ADMIN_API_KEY
from database import get_supabase
from models.schemas import (
    ConfirmReportRequest,
    CreateReportRequest,
    ReportTypeUpsert,
    ReportTypeUpdate,
)

router = APIRouter(prefix="/reports", tags=["reports"])


def _actor_context(request: Request) -> tuple[str, str | None, str | None]:
    user_id = get_optional_user(request)
    if user_id:
        return f"user:{user_id}", user_id, None
    anon_fingerprint = get_voter_id(request)
    return f"anon:{anon_fingerprint}", None, anon_fingerprint


def _load_viewer_votes(sb: Any, actor_key: str, report_ids: list[str]) -> dict[str, int]:
    if not report_ids:
        return {}
    result = (
        sb.table("report_confirmations")
        .select("report_id,vote")
        .eq("actor_key", actor_key)
        .in_("report_id", report_ids)
        .execute()
    )
    return {row["report_id"]: row["vote"] for row in (result.data or [])}


def _with_viewer_vote(report: dict[str, Any], viewer_vote: int) -> dict[str, Any]:
    return {**report, "viewer_vote": viewer_vote}


def _ensure_report_type_exists(sb: Any, report_type: str) -> None:
    result = (
        sb.table("report_types")
        .select("id")
        .eq("id", report_type)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=400, detail="Invalid report type")


def require_admin(x_admin_key: str | None = Header(default=None, alias="X-Admin-Key")):
    if not ADMIN_API_KEY or ADMIN_API_KEY.strip().lower() == "mock":
        raise HTTPException(status_code=403, detail="Admin API key not configured")
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")


@router.get("/nearby")
async def get_nearby_reports(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
    radius: float = Query(default=5000.0, description="Search radius in metres"),
    category: str | None = Query(default=None, description="Category filter"),
):
    """Get active reports near a location."""
    sb = get_supabase()

    try:
        print(f"[REPORTS] Fetching nearby reports for: {lat}, {lng} (Radius: {radius}m, Category: {category})")
        # Use the RPC function defined in 000_full_reset.sql
        result = sb.rpc(
            "nearby_items",
            {
                "user_lat": lat,
                "user_lng": lng,
                "radius_m": int(radius),
                "category_filter": category,
                "item_types": ["report"]
            }
        ).execute()
        
        count = len(result.data) if result.data else 0
        print(f"[REPORTS] Found {count} reports")
        
        if hasattr(result, 'error') and result.error:
            raise Exception(result.error.message if hasattr(result.error, 'message') else str(result.error))
            
        return {"reports": result.data or []}
    except Exception as e:
        print(f"Error fetching nearby items: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/me")
async def get_my_reports(request: Request):
    """Get reports created by the current user."""
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    actor_key, _, _ = _actor_context(request)
    sb = get_supabase()
    try:
        result = (
            sb.table("community_reports")
            .select("*")
            .eq("created_by", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        rows = result.data or []
        viewer_votes = _load_viewer_votes(sb, actor_key, [row["id"] for row in rows if row.get("id")])
        reports = [_with_viewer_vote(row, viewer_votes.get(row["id"], 0)) for row in rows]
        return {"reports": reports}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/types")
async def get_report_types():
    """List dynamic report types."""
    sb = get_supabase()
    try:
        result = (
            sb.table("report_types")
            .select("*")
            .eq("is_active", True)
            .order("sort_order")
            .execute()
        )
        return {"types": result.data or []}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/types", dependencies=[Depends(require_admin)])
async def create_report_type(payload: ReportTypeUpsert):
    """Create or upsert a report type (admin only)."""
    sb = get_supabase()
    row = payload.model_dump(exclude_unset=True)
    try:
        result = sb.table("report_types").upsert(row, on_conflict="id").execute()
        return {"type": result.data[0] if result.data else row}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/types/{type_id}", dependencies=[Depends(require_admin)])
async def update_report_type(type_id: str, payload: ReportTypeUpdate):
    """Update a report type (admin only)."""
    sb = get_supabase()
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    try:
        result = sb.table("report_types").update(data).eq("id", type_id).execute()
        return {"type": result.data[0] if result.data else {"id": type_id, **data}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/types/{type_id}", dependencies=[Depends(require_admin)])
async def deactivate_report_type(type_id: str):
    """Deactivate a report type (admin only)."""
    sb = get_supabase()
    try:
        result = (
            sb.table("report_types")
            .update({"is_active": False})
            .eq("id", type_id)
            .execute()
        )
        return {"status": "ok", "type": result.data[0] if result.data else {"id": type_id}}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{report_id}")
async def get_report(report_id: str, request: Request):
    """Get a single report by ID, including live confirmation counts."""
    actor_key, _, _ = _actor_context(request)
    sb = get_supabase()

    try:
        result = (
            sb.table("community_reports")
            .select("*")
            .eq("id", report_id)
            .single()
            .execute()
        )
        if not result.data:
            raise HTTPException(status_code=404, detail="Report not found")
        viewer_votes = _load_viewer_votes(sb, actor_key, [report_id])
        return _with_viewer_vote(result.data, viewer_votes.get(report_id, 0))
    except HTTPException:
        raise
    except Exception as e:
        error_str = str(e).lower()
        if "no rows" in error_str or "pgrst116" in error_str:
            raise HTTPException(status_code=404, detail="Report not found")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@router.post("")
async def create_report(req: CreateReportRequest, request: Request):
    """Create a new incident report."""
    user_id = get_optional_user(request)
    if user_id is None and not req.anon_fingerprint:
        raise HTTPException(status_code=401, detail="Authentication required")

    sb = get_supabase()

    now = datetime.now(timezone.utc)
    duration = req.duration_hours or DEFAULT_REPORT_DURATION_HOURS
    expires_at = now + timedelta(hours=duration)

    try:
        _ensure_report_type_exists(sb, req.report_type)
        # Log coordinates to verify current location requirement
        print(f"[REPORTS] Creating report at: {req.lat}, {req.lng} (Type: {req.report_type})")
        
        row = {
            "created_by": user_id,
            "anon_fingerprint": req.anon_fingerprint,
            "report_type": req.report_type,
            "title": req.title,
            "description": req.description,
            "lat": req.lat,
            "lng": req.lng,
            # Use WKT for reliable PostGIS parsing via PostgREST
            "location": f"POINT({req.lng} {req.lat})",
            "created_at": now.isoformat(),
            "expires_at": expires_at.isoformat(),
        }
        result = sb.table("community_reports").insert(row).execute()
        
        if hasattr(result, 'error') and result.error:
            raise Exception(result.error.message if hasattr(result.error, 'message') else str(result.error))

        if not result.data:
            return {"report": _with_viewer_vote(row, 0)}

        return {"report": _with_viewer_vote(result.data[0], 0)}
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error creating report: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/{report_id}/confirm")
async def confirm_report(
    report_id: str,
    req: ConfirmReportRequest,
    request: Request,
):
    """Confirm or deny a report.

    Each voter can vote once per report.  When a valid JWT is present the
    user_id is used as the voter identifier; otherwise the IP+UA fingerprint
    is used so anonymous users can still participate.
    """
    actor_key, actor_user_id, actor_anon_fingerprint = _actor_context(request)
    sb = get_supabase()

    try:
        # Check if the report exists
        sb.table("community_reports").select("id").eq("id", report_id).single().execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Report not found")

    try:
        # Upsert the confirmation vote
        sb.table("report_confirmations").upsert(
            {
                "report_id": report_id,
                "actor_key": actor_key,
                "user_id": actor_user_id,
                "anon_fingerprint": actor_anon_fingerprint,
                "vote": req.vote,
            },
            on_conflict="report_id,actor_key",
        ).execute()
        report = (
            sb.table("community_reports")
            .select("*")
            .eq("id", report_id)
            .single()
            .execute()
        )
        return {
            "status": "ok",
            "vote": req.vote,
            "report": _with_viewer_vote(report.data, req.vote),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{report_id}")
async def delete_report(report_id: str, request: Request):
    """Delete a report.  Only the authenticated creator may delete their own report."""
    user_id = get_optional_user(request)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    sb = get_supabase()

    # Verify ownership
    try:
        report = (
            sb.table("community_reports")
            .select("created_by")
            .eq("id", report_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Report not found")

    if report.data.get("created_by") != user_id:
        raise HTTPException(status_code=403, detail="Not the report owner")

    try:
        sb.table("community_reports").delete().eq("id", report_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
