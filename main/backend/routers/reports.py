"""Reports endpoints — community-driven incident reports."""
from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import uuid
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Header

from auth import get_optional_user, get_voter_id
from config import DEFAULT_REPORT_DURATION_HOURS, ADMIN_API_KEY
from database import get_db

logger = logging.getLogger(__name__)
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
    placeholders = ", ".join("?" for _ in report_ids)
    cursor = await db.execute(
        f"SELECT report_id, vote FROM report_confirmations WHERE actor_key=? AND report_id IN ({placeholders})",
        (actor_key, *report_ids),
    )
    rows = await cursor.fetchall()
    return {row["report_id"]: row["vote"] for row in rows}


def _with_viewer_vote(report: dict[str, Any], viewer_vote: int) -> dict[str, Any]:
    return {**report, "viewer_vote": viewer_vote}


async def _ensure_report_type_exists(db: Any, report_type: str) -> None:
    cursor = await db.execute(
        "SELECT id FROM report_types WHERE id=? AND is_active=1 LIMIT 1", (report_type,)
    )
    row = await cursor.fetchone()
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
    # Rough approximation for bounding box
    delta = radius / 111000.0
    min_lat, max_lat = lat - delta, lat + delta
    min_lng, max_lng = lng - delta, lng + delta

    async with get_db() as db:
        try:
            cursor = await db.execute(
                "SELECT * FROM community_reports WHERE lat BETWEEN ? AND ? AND lng BETWEEN ? AND ? AND is_active=1",
                (min_lat, max_lat, min_lng, max_lng),
            )
            rows = await cursor.fetchall()
            return {"reports": [dict(r) for r in rows]}
        except Exception as e:
            logger.error(f"Error fetching nearby reports: {e}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.get("/me")
async def get_my_reports(request: Request):
    user_id = get_optional_user(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Authentication required")

    actor_key, _, _ = _actor_context(request)
    async with get_db() as db:
        try:
            cursor = await db.execute(
                "SELECT * FROM community_reports WHERE created_by=? ORDER BY created_at DESC", (user_id,)
            )
            rows = await cursor.fetchall()
            report_list = [dict(r) for r in rows]
            viewer_votes = await _load_viewer_votes(db, actor_key, [r["id"] for r in report_list if r.get("id")])
            return {"reports": [_with_viewer_vote(r, viewer_votes.get(r["id"], 0)) for r in report_list]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/types")
async def get_report_types():
    async with get_db() as db:
        try:
            cursor = await db.execute("SELECT * FROM report_types WHERE is_active=1 ORDER BY sort_order")
            rows = await cursor.fetchall()
            return {"types": [dict(r) for r in rows]}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))


@router.get("/{report_id}")
async def get_report(report_id: str, request: Request):
    actor_key, _, _ = _actor_context(request)
    async with get_db() as db:
        try:
            cursor = await db.execute("SELECT * FROM community_reports WHERE id=?", (report_id,))
            row = await cursor.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="Report not found")
            viewer_votes = await _load_viewer_votes(db, actor_key, [report_id])
            return _with_viewer_vote(dict(row), viewer_votes.get(report_id, 0))
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Database error: {e}")


@router.post("")
async def create_report(req: Any, request: Request):
    user_id = get_optional_user(request)
    if user_id is None and not getattr(req, "anon_fingerprint", None):
        # We handle Pydantic model implicitly or explicitly
        pass

    now = datetime.now(timezone.utc).isoformat()
    duration = getattr(req, "duration_hours", None) or DEFAULT_REPORT_DURATION_HOURS
    expires_at = (datetime.now(timezone.utc) + timedelta(hours=duration)).isoformat()

    report_id = str(uuid.uuid4())
    async with get_db() as db:
        try:
            await _ensure_report_type_exists(db, req.report_type)
            await db.execute(
                \"\"\"INSERT INTO community_reports
                   (id, created_by, anon_fingerprint, report_type, title, description,
                    lat, lng, created_at, expires_at)
                   VALUES (?,?,?,?,?,?,?,?,?,?)
                \"\"\",
                (report_id, user_id, getattr(req, "anon_fingerprint", None), req.report_type, req.title, req.description,
                req.lat, req.lng, now, expires_at),
            )
            await db.commit()
            
            cursor = await db.execute("SELECT * FROM community_reports WHERE id=?", (report_id,))
            row = await cursor.fetchone()
            return {"report": _with_viewer_vote(dict(row), 0)}
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Error creating report: {e}")
            raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/{report_id}/confirm")
async def confirm_report(report_id: str, req: Any, request: Request):
    actor_key, actor_user_id, actor_anon_fingerprint = _actor_context(request)
    async with get_db() as db:
        cursor = await db.execute("SELECT id FROM community_reports WHERE id=?", (report_id,))
        exists = await cursor.fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Report not found")
        try:
            await db.execute(
                \"\"\"INSERT INTO report_confirmations (id, report_id, actor_key, user_id, anon_fingerprint, vote)
                   VALUES (?,?,?,?,?,?)
                   ON CONFLICT (report_id, actor_key) DO UPDATE SET vote=excluded.vote\"\"\",
                (str(uuid.uuid4()), report_id, actor_key, actor_user_id, actor_anon_fingerprint, req.vote),
            )
            await db.commit()
            
            cursor = await db.execute("SELECT * FROM community_reports WHERE id=?", (report_id,))
            row = await cursor.fetchone()
            return {"status": "ok", "vote": req.vote, "report": _with_viewer_vote(dict(row), req.vote)}
        except Exception as e:
            logger.error(f"Error confirming report: {e}")
            raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{report_id}")
async def delete_report(report_id: str, request: Request):
    user_id = get_optional_user(request)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Authentication required")

    async with get_db() as db:
        cursor = await db.execute("SELECT created_by FROM community_reports WHERE id=?", (report_id,))
        row = await cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found")
        if row["created_by"] != user_id:
            raise HTTPException(status_code=403, detail="Not the report owner")
        try:
            await db.execute("DELETE FROM community_reports WHERE id=?", (report_id,))
            await db.commit()
            return {"status": "deleted"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
