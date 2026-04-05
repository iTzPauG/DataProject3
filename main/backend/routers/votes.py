"""Voting endpoints — like / dislike places."""
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import get_optional_user, get_voter_id
from database import get_db
from models.schemas import VoteRequest

logger = logging.getLogger(__name__)

router = APIRouter(tags=["votes"])


class VoteBatchRequest(BaseModel):
    ids: List[str]


def _resolve_voter_id(request: Request) -> str:
    user_id = get_optional_user(request)
    if user_id:
        return f"user:{user_id}"
    return f"anon:{get_voter_id(request)}"


async def _summarize_votes(db, item_id: str, voter_id: str) -> dict:
    rows = await db.fetch("SELECT vote, voter_id FROM item_votes WHERE item_id=$1", item_id)
    likes = sum(1 for v in rows if v["vote"] == 1)
    dislikes = sum(1 for v in rows if v["vote"] == -1)
    user_vote = next((v["vote"] for v in rows if v["voter_id"] == voter_id), 0)
    return {"likes": likes, "dislikes": dislikes, "userVote": user_vote}


@router.post("/vote")
async def vote_endpoint(req: VoteRequest, request: Request):
    if req.vote not in (1, -1):
        raise HTTPException(status_code=400, detail="vote must be 1 or -1")

    voter_id = _resolve_voter_id(request)

    try:
        async with get_db() as db:
            existing = await db.fetchrow(
                "SELECT id, vote FROM item_votes WHERE item_id=$1 AND voter_id=$2",
                req.item_id, voter_id,
            )

            if existing:
                if existing["vote"] == req.vote:
                    await db.execute("DELETE FROM item_votes WHERE id=$1", existing["id"])
                    summary = await _summarize_votes(db, req.item_id, voter_id)
                    return {"success": True, "status": "removed", "vote": 0, "userVote": 0, **summary}
                else:
                    await db.execute(
                        "UPDATE item_votes SET vote=$1, item_type=$2 WHERE id=$3",
                        req.vote, req.item_type, existing["id"],
                    )
                    summary = await _summarize_votes(db, req.item_id, voter_id)
                    return {"success": True, "status": "updated", "vote": req.vote, "userVote": req.vote, **summary}
            else:
                await db.execute(
                    """INSERT INTO item_votes (item_id, item_type, voter_id, vote)
                       VALUES ($1, $2, $3, $4)
                       ON CONFLICT (item_id, voter_id) DO UPDATE SET vote=EXCLUDED.vote, item_type=EXCLUDED.item_type""",
                    req.item_id, req.item_type, voter_id, req.vote,
                )
                summary = await _summarize_votes(db, req.item_id, voter_id)
                return {"success": True, "status": "created", "vote": req.vote, "userVote": req.vote, **summary}
    except Exception as exc:
        logger.exception("vote failed for item %s", req.item_id)
        raise HTTPException(status_code=500, detail=f"Vote failed: {exc}") from exc


@router.get("/votes/{item_id}")
async def get_votes(item_id: str, request: Request):
    voter_id = _resolve_voter_id(request)
    try:
        async with get_db() as db:
            return await _summarize_votes(db, item_id, voter_id)
    except Exception as exc:
        logger.warning("get_votes failed for %s: %s", item_id, exc)
        return {"likes": 0, "dislikes": 0, "userVote": 0}


@router.post("/votes/batch")
async def get_votes_batch(body: VoteBatchRequest, request: Request):
    voter_id = _resolve_voter_id(request)
    ids = body.ids

    if not ids:
        return {"votes": {}}

    try:
        async with get_db() as db:
            rows = await db.fetch(
                "SELECT item_id, vote, voter_id FROM item_votes WHERE item_id = ANY($1::text[])", ids
            )
    except Exception as exc:
        logger.warning("votes/batch failed, returning empty votes: %s", exc)
        return {"votes": {rid: {"likes": 0, "dislikes": 0, "userVote": 0} for rid in ids}}

    result = {}
    for rid in ids:
        rv = [v for v in rows if v["item_id"] == rid]
        likes = sum(1 for v in rv if v["vote"] == 1)
        dislikes = sum(1 for v in rv if v["vote"] == -1)
        user_vote = next((v["vote"] for v in rv if v["voter_id"] == voter_id), 0)
        result[rid] = {"likes": likes, "dislikes": dislikes, "userVote": user_vote}

    return {"votes": result}
