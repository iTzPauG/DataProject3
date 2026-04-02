from __future__ import annotations

from fastapi import APIRouter

from models.search import BrainRequest
from services.brain_service import ask_brain

router = APIRouter(prefix="/brain", tags=["brain"])


@router.post("")
async def brain_chat(payload: BrainRequest):
    """Chat directo con el LLM. Para la barra de búsqueda inteligente."""
    result = await ask_brain(payload.message, context=payload.context)
    return result
