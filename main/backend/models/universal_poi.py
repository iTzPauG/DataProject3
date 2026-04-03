"""Universal POI models."""
from __future__ import annotations

from typing import Any, Optional

from pydantic import BaseModel, Field


class UniversalPOI(BaseModel):
    osm_id: Optional[str] = None
    osm_type: Optional[str] = None
    name: str
    lat: float
    lng: float
    address: Optional[str] = None
    amenity: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    opening_hours: Optional[str] = None
    tags: dict[str, Any] = Field(default_factory=dict)
    source: str = "osm"
