"""Recommendation endpoint with progressive polling."""
import asyncio
import json
import time
import uuid

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from models.schemas import RecommendRequest, RecommendResponse
from services.recommendation.pipeline import recommend, recommend_stream

router = APIRouter(tags=["recommend"])

# ── In-memory job store for progressive polling ──────────────────────────────
# Each job: { "results": [...], "total": int|None, "done": bool, "created": float }
_jobs: dict[str, dict] = {}
_JOB_TTL = 300  # auto-cleanup after 5 minutes


def _cleanup_jobs() -> None:
    """Remove stale jobs older than TTL."""
    now = time.time()
    stale = [k for k, v in _jobs.items() if now - v["created"] > _JOB_TTL]
    for k in stale:
        del _jobs[k]


# ── Original batch endpoint (backwards-compatible) ───────────────────────────

@router.post("/recommend", response_model=RecommendResponse)
async def recommend_endpoint(
    req: RecommendRequest,
    fast: bool = Query(False, description="Skip expensive enrichment for a faster response"),
):
    try:
        parent_category = req.parent_category or req.category or "food"
        subcategory = req.subcategory or req.category or parent_category
        results = await recommend(
            parent_category=parent_category,
            subcategory=subcategory,
            mood=req.mood,
            price_level=req.priceLevel,
            lat=req.lat,
            lng=req.lng,
            fast_mode=fast,
            language=req.language or "es",
        )
        return {"top": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── SSE stream endpoint (kept for web clients that support ReadableStream) ───

@router.post("/recommend/stream")
async def recommend_stream_endpoint(req: RecommendRequest):
    """SSE endpoint — yields results one by one as the LLM enriches them."""
    parent_category = req.parent_category or req.category or "food"
    subcategory = req.subcategory or req.category or parent_category

    async def event_generator():
        async for event in recommend_stream(
            parent_category=parent_category,
            subcategory=subcategory,
            mood=req.mood,
            price_level=req.priceLevel,
            lat=req.lat,
            lng=req.lng,
            language=req.language or "es",
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


# ── Progressive polling: start + poll ────────────────────────────────────────

@router.post("/recommend/start")
async def recommend_start(req: RecommendRequest):
    """Start a recommendation job. Returns a job_id to poll for results."""
    _cleanup_jobs()

    job_id = str(uuid.uuid4())[:8]
    parent_category = req.parent_category or req.category or "food"
    subcategory = req.subcategory or req.category or parent_category

    job = {
        "results": [],
        "total": None,
        "done": False,
        "created": time.time(),
    }
    _jobs[job_id] = job

    async def _run():
        try:
            async for event in recommend_stream(
                parent_category=parent_category,
                subcategory=subcategory,
                mood=req.mood,
                price_level=req.priceLevel,
                lat=req.lat,
                lng=req.lng,
                language=req.language or "es",
            ):
                if event["event"] == "meta":
                    job["total"] = event["total"]
                elif event["event"] == "result":
                    job["results"].append(event["data"])
                elif event["event"] == "done":
                    job["done"] = True
        except Exception:
            job["done"] = True  # mark done even on error so client stops polling

    asyncio.create_task(_run())

    return {"job_id": job_id}


@router.get("/recommend/poll/{job_id}")
async def recommend_poll(job_id: str, after: int = 0):
    """Poll for new results. Pass after=N to get only results after index N."""
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found or expired")

    new_results = job["results"][after:]
    return {
        "results": new_results,
        "total": job["total"],
        "done": job["done"],
        "cursor": after + len(new_results),
    }
