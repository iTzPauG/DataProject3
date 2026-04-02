"""Search request/response models."""
from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class SearchResponse(BaseModel):
    source: str
    query_used: str
    category_used: Optional[str] = None
    count: int = 0


class BrainResponse(BaseModel):
    query: str
    category: Optional[str] = None
    intent: str = "search"
    response: str = "Buscando..."


class BrainRequest(BaseModel):
    message: str = Field(..., min_length=1)
    context: Optional[dict] = None
