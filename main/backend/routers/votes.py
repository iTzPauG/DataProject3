"""Voting endpoints — simple upvote/downvote for any item."""
from typing import Optional
import uuid

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from auth import get_voter_id
from database import get_db

router = APIRouter(prefix="/votes", tags=["votes"])


class VoteRequest(BaseModel):
    item_id: str
    vote: int  # 1 for upvote, -1 for downvote


class BatchVoteRequest(BaseModel):
    ids: list[str]

@router.post("/batch")
async def get_votes_batch(req: BatchVoteRequest, request: Request):
    """Get the vote summary for multiple items."""
    voter_id = get_voter_id(request)
    if not req.ids:
        return {"votes": {}}
        
    async with get_db() as db:
        placeholders = ",".join("?" for _ in req.ids)
        cursor = await db.execute(
            f"SELECT item_id, vote, voter_id FROM item_votes WHERE item_id IN ({placeholders})",
            req.ids
        )
        rows = await cursor.fetchall()

    results = {}
    for item_id in req.ids:
        item_rows = [r for r in rows if r["item_id"] == item_id]
        ups = sum(1 for r in item_rows if r["vote"] == 1)
        downs = sum(1 for r in item_rows if r["vote"] == -1)
        user_vote = next((r["vote"] for r in item_rows if r["voter_id"] == voter_id), 0)
        results[item_id] = {"likes": ups, "dislikes": downs, "userVote": user_vote}

    return {"votes": results}

@router.get("/{item_id}")
async def get_votes(item_id: str, request: Request):
    """Get the vote summary for an item."""
    voter_id = get_voter_id(request)
    async with get_db() as db:
        cursor = await db.execute("SELECT vote, voter_id FROM item_votes WHERE item_id=?", (item_id,))
        rows = await cursor.fetchall()

    ups = sum(1 for r in rows if r["vote"] == 1)
    downs = sum(1 for r in rows if r["vote"] == -1)
    user_vote = next((r["vote"] for r in rows if r["voter_id"] == voter_id), 0)

    return {"likes": ups, "dislikes": downs, "userVote": user_vote}


@router.post("")
async def cast_vote(req: VoteRequest, request: Request):
    """Cast or update a vote for an item."""
    if req.vote not in (1, -1, 0):
        raise HTTPException(status_code=400, detail="Invalid vote value")

    voter_id = get_voter_id(request)
    async with get_db() as db:
        if req.vote == 0:
            await db.execute(
                "DELETE FROM item_votes WHERE item_id=? AND voter_id=?",
                (req.item_id, voter_id),
            )
        else:
            await db.execute(
                """INSERT INTO item_votes (id, item_id, voter_id, vote)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(item_id, voter_id) DO UPDATE SET vote=excluded.vote""",
                (str(uuid.uuid4()), req.item_id, voter_id, req.vote),
            )
        await db.commit()

        cursor = await db.execute("SELECT vote, voter_id FROM item_votes WHERE item_id=?", (req.item_id,))
        rows = await cursor.fetchall()

    ups = sum(1 for r in rows if r["vote"] == 1)
    downs = sum(1 for r in rows if r["vote"] == -1)
    return {"status": "ok", "likes": ups, "dislikes": downs, "userVote": req.vote}
