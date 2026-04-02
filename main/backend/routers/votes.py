"""Voting endpoints — like / dislike places."""
import logging
from typing import List
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import get_optional_user, get_voter_id
from database import get_supabase
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


def _summarize_votes(sb, item_id: str, voter_id: str) -> dict:
    all_votes = (
        sb.table("item_votes")
        .select("vote, voter_id")
        .eq("item_id", item_id)
        .execute()
    )
    rows = all_votes.data or []
    likes = sum(1 for v in rows if v["vote"] == 1)
    dislikes = sum(1 for v in rows if v["vote"] == -1)
    user_vote = next((v["vote"] for v in rows if v["voter_id"] == voter_id), 0)
    return {"likes": likes, "dislikes": dislikes, "userVote": user_vote}


@router.post("/vote")
async def vote_endpoint(req: VoteRequest, request: Request):
    """Cast a like (+1) or dislike (-1) vote for a place or event.

    Uses a hashed IP+UA fingerprint to enforce one vote per item per user.
    Voting again with the same value toggles the vote off.
    """
    if req.vote not in (1, -1):
        raise HTTPException(status_code=400, detail="vote must be 1 or -1")

    voter_id = _resolve_voter_id(request)

    try:
        sb = get_supabase()

        # Check for existing vote
        existing = (
            sb.table("item_votes")
            .select("id, vote")
            .eq("item_id", req.item_id)
            .eq("voter_id", voter_id)
            .execute()
        )

        if existing.data and len(existing.data) > 0:
            row = existing.data[0]
            if row["vote"] == req.vote:
                # Same vote again -> toggle off (remove vote)
                sb.table("item_votes").delete().eq("id", row["id"]).execute()
                summary = _summarize_votes(sb, req.item_id, voter_id)
                return {
                    "success": True,
                    "status": "removed",
                    "vote": 0,
                    "userVote": 0,
                    "total_likes": summary["likes"],
                    "total_dislikes": summary["dislikes"],
                }
            else:
                # Different vote -> update
                (
                    sb.table("item_votes")
                    .upsert(
                        {
                            "id": row["id"],
                            "item_id": req.item_id,
                            "item_type": req.item_type,
                            "voter_id": voter_id,
                            "vote": req.vote,
                        },
                        on_conflict="item_id,voter_id",
                    )
                    .execute()
                )
                summary = _summarize_votes(sb, req.item_id, voter_id)
                return {
                    "success": True,
                    "status": "updated",
                    "vote": req.vote,
                    "userVote": req.vote,
                    "total_likes": summary["likes"],
                    "total_dislikes": summary["dislikes"],
                }
        else:
            # New vote
            sb.table("item_votes").upsert(
                {
                    "item_id": req.item_id,
                    "item_type": req.item_type,
                    "voter_id": voter_id,
                    "vote": req.vote,
                },
                on_conflict="item_id,voter_id",
            ).execute()
            summary = _summarize_votes(sb, req.item_id, voter_id)
            return {
                "success": True,
                "status": "created",
                "vote": req.vote,
                "userVote": req.vote,
                "total_likes": summary["likes"],
                "total_dislikes": summary["dislikes"],
            }
    except Exception as exc:
        logger.exception("vote failed for item %s", req.item_id)
        raise HTTPException(status_code=500, detail=f"Vote failed: {exc}") from exc


@router.get("/votes/{item_id}")
async def get_votes(item_id: str, request: Request):
    """Get vote counts and the current user's vote for an item."""
    voter_id = _resolve_voter_id(request)
    try:
        sb = get_supabase()
        return _summarize_votes(sb, item_id, voter_id)
    except Exception as exc:
        logger.warning("get_votes failed for %s: %s", item_id, exc)
        return {"likes": 0, "dislikes": 0, "userVote": 0}


@router.post("/votes/batch")
async def get_votes_batch(body: VoteBatchRequest, request: Request):
    """Get vote counts for multiple item IDs at once."""
    voter_id = _resolve_voter_id(request)
    ids = body.ids

    if not ids:
        return {"votes": {}}

    try:
        sb = get_supabase()
        all_votes = (
            sb.table("item_votes")
            .select("item_id, vote, voter_id")
            .in_("item_id", ids)
            .execute()
        )
    except Exception as exc:
        logger.warning("votes/batch failed, returning empty votes: %s", exc)
        return {"votes": {rid: {"likes": 0, "dislikes": 0, "userVote": 0} for rid in ids}}

    result = {}
    for rid in ids:
        rv = [v for v in all_votes.data if v["item_id"] == rid]
        likes = sum(1 for v in rv if v["vote"] == 1)
        dislikes = sum(1 for v in rv if v["vote"] == -1)
        user_vote = 0
        for v in rv:
            if v["voter_id"] == voter_id:
                user_vote = v["vote"]
                break
        result[rid] = {"likes": likes, "dislikes": dislikes, "userVote": user_vote}

    return {"votes": result}
