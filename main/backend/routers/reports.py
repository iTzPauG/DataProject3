"""Reports endpoints — community-driven incident reports."""
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header

from auth import get_optional_user, get_voter_id
from config import DEFAULT_REPORT_DURATION_HOURS, ADMIN_API_KEY
from database import get_db
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


async def _load_viewer_votes(db: Any, actor_key: str, report_ids: list[str]) -> dict[str, int]:
    if not report_ids:
        return {}
    rows = await db.fetch(
        "SELECT report_id, vote FROM report_confirmations WHERE actor_key=$1 AND report_id=ANY($2)",
        actor_key, report_ids,
    )
    return {row["report_id"]: row["vote"] for row in rows}


def _with_viewer_vote(report: dict[str, Any], viewer_vote: int) -> dict[str, Any]:
    return {**report, "viewer_vote": viewer_vote}


async def _ensure_report_type_exists(db: Any, report_type: str) -> None:
    row = await db.fetchrow(
        "SELECT id FROM report_types WHERE id=$1 AND is_active=TRUE LIMIT 1", report_type
    )
    if not row:
        raise HTTPException(status_code=400, detail="Invalid report type")


def require_admin(x_admin_key: str | None = Header(default=None, alias="X-Admin-Key")):
    if not ADMIN_API_KEY or ADMIN_API_KEY.strip().lower() == "mock":
        raise HTTPException(status_code=403, detail="Admin API key not configured")
    if x_admin_key != ADMIN_API_KEY:
        raise HTTPException(status_code=403, detail="Invalid admin key")


@router.get("/nearby")
async def get_nearby_reports(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(default=5000.0),
    category: str | None = Query(default=None),
):
    print(f"[REPORTS] Fetching nearby reports for: {lat}, {lng} (Radius: {radius}m, Category: {category})")
    async with get_db() as db:
        try:
            rows = await db.fetch(
                "SELECT * FROM nearby_items($1,$2,$3,$4,$5)",
                lat, lng, int(radius), category, ["report"],
            )
            print(f"[REPORTS] Found {len(rows)} reports")
            return {"reports": [dict(r) for r in rows]}
        except Exception as e:
            print(f"Error fetching nearby items: {e}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/me")
async def get_my_reports(request: Request):
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    actor_key, _, _ = _actor_context(request)
    async with get_db() as db:
        try:
            rows = await db.fetch(
                "SELECT * FROM community_reports WHERE created_by=$1 ORDER BY created_at DESC", user_id
            )
            report_list = [dict(r) for r in rows]
            viewer_votes = await _load_viewer_votes(db, actor_key, [r["id"] for r in report_list if r.get("id")])
            return {"reports": [_with_viewer_vote(r, viewer_votes.get(r["id"], 0)) for r in report_list]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/types")
async def get_report_types():
    async with get_db() as db:
        try:
            rows = await db.fetch("SELECT * FROM report_types WHERE is_active=TRUE ORDER BY sort_order")
            return {"types": [dict(r) for r in rows]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.post("/types", dependencies=[Depends(require_admin)])
async def create_report_type(payload: ReportTypeUpsert):
    row = payload.model_dump(exclude_unset=True)
    cols = list(row.keys())
    vals = list(row.values())
    placeholders = ", ".join(f"${i+1}" for i in range(len(cols)))
    updates = ", ".join(f"{c}=EXCLUDED.{c}" for c in cols if c != "id")
    async with get_db() as db:
        try:
            result = await db.fetchrow(
                f"INSERT INTO report_types ({', '.join(cols)}) VALUES ({placeholders}) "
                f"ON CONFLICT (id) DO UPDATE SET {updates} RETURNING *",
                *vals,
            )
            return {"type": dict(result) if result else row}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.put("/types/{type_id}", dependencies=[Depends(require_admin)])
async def update_report_type(type_id: str, payload: ReportTypeUpdate):
    data = payload.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")
    cols = list(data.keys())
    vals = list(data.values())
    set_clause = ", ".join(f"{c}=${i+1}" for i, c in enumerate(cols))
    async with get_db() as db:
        try:
            result = await db.fetchrow(
                f"UPDATE report_types SET {set_clause} WHERE id=${len(cols)+1} RETURNING *",
                *vals, type_id,
            )
            return {"type": dict(result) if result else {"id": type_id, **data}}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.delete("/types/{type_id}", dependencies=[Depends(require_admin)])
async def deactivate_report_type(type_id: str):
    async with get_db() as db:
        try:
            result = await db.fetchrow(
                "UPDATE report_types SET is_active=FALSE WHERE id=$1 RETURNING *", type_id
            )
            return {"status": "ok", "type": dict(result) if result else {"id": type_id}}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/{report_id}")
async def get_report(report_id: str, request: Request):
    actor_key, _, _ = _actor_context(request)
    async with get_db() as db:
        try:
            row = await db.fetchrow("SELECT * FROM community_reports WHERE id=$1", report_id)
            if not row:
                raise HTTPException(status_code=404, detail="Report not found")
            viewer_votes = await _load_viewer_votes(db, actor_key, [report_id])
            return _with_viewer_vote(dict(row), viewer_votes.get(report_id, 0))
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {e}")


@router.post("")
async def create_report(req: CreateReportRequest, request: Request):
    user_id = get_optional_user(request)
    if user_id is None and not req.anon_fingerprint:
        raise HTTPException(status_code=401, detail="Authentication required")

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=req.duration_hours or DEFAULT_REPORT_DURATION_HOURS)

    print(f"[REPORTS] Creating report at: {req.lat}, {req.lng} (Type: {req.report_type})")

    async with get_db() as db:
        try:
            await _ensure_report_type_exists(db, req.report_type)
            row = await db.fetchrow(
                """INSERT INTO community_reports
                   (created_by, anon_fingerprint, report_type, title, description,
                    lat, lng, location, created_at, expires_at)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,ST_GeomFromText($8,4326),$9,$10)
                   RETURNING *""",
                user_id, req.anon_fingerprint, req.report_type, req.title, req.description,
                req.lat, req.lng, f"POINT({req.lng} {req.lat})", now, expires_at,
            )
            return {"report": _with_viewer_vote(dict(row), 0)}
        except HTTPException:
            raise
        except Exception as e:
            print(f"Error creating report: {e}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/{report_id}/confirm")
async def confirm_report(report_id: str, req: ConfirmReportRequest, request: Request):
    actor_key, actor_user_id, actor_anon_fingerprint = _actor_context(request)
    async with get_db() as db:
        exists = await db.fetchval("SELECT id FROM community_reports WHERE id=$1", report_id)
        if not exists:
            raise HTTPException(status_code=404, detail="Report not found")
        try:
            await db.execute(
                """INSERT INTO report_confirmations (report_id, actor_key, user_id, anon_fingerprint, vote)
                   VALUES ($1,$2,$3,$4,$5)
                   ON CONFLICT (report_id, actor_key) DO UPDATE SET vote=EXCLUDED.vote""",
                report_id, actor_key, actor_user_id, actor_anon_fingerprint, req.vote,
            )
            row = await db.fetchrow("SELECT * FROM community_reports WHERE id=$1", report_id)
            return {"status": "ok", "vote": req.vote, "report": _with_viewer_vote(dict(row), req.vote)}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{report_id}")
async def delete_report(report_id: str, request: Request):
    user_id = get_optional_user(request)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    async with get_db() as db:
        row = await db.fetchrow("SELECT created_by FROM community_reports WHERE id=$1", report_id)
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        if row["created_by"] != user_id:
            raise HTTPException(status_code=403, detail="Not the report owner")
        try:
            await db.execute("DELETE FROM community_reports WHERE id=$1", report_id)
            return {"status": "deleted"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
