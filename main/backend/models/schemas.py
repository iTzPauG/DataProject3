"""Pydantic models shared across routers."""
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Recommendation ───────────────────────────────────────────────────────────

class RecommendRequest(BaseModel):
    category: Optional[str] = None
    parent_category: Optional[str] = None
    subcategory: Optional[str] = None
    mood: str
    priceLevel: Optional[int] = None
    lat: float
    lng: float
    language: Optional[str] = "es"


class ReviewItem(BaseModel):
    author: str = ""
    rating: int = 0
    text: str = ""
    relative_time: str = ""


class PlaceResult(BaseModel):
    id: str
    name: str
    priceLevel: int
    rating: float
    reviewsCount: int
    review_count: int = 0
    address: str = ""
    phone: str = ""
    photoUrl: str = ""
    lat: float
    lng: float
    distanceM: int = 0
    bestReviewQuote: str = ""
    reviewQualityScore: float = 0.5
    tagline: str = ""
    why: str = ""
    pros: List[str] = Field(default_factory=list)
    cons: List[str] = Field(default_factory=list)
    verdict: str = ""
    tags: List[str] = Field(default_factory=list)
    reviews: List[ReviewItem] = Field(default_factory=list)
    liveData: Optional[Dict[str, Any]] = None


class RecommendResponse(BaseModel):
    top: List[PlaceResult] = Field(default_factory=list)


# ── Voting ───────────────────────────────────────────────────────────────────

class VoteRequest(BaseModel):
    item_id: str
    item_type: Literal["place", "event"] = Field(..., description="place | event")
    vote: Literal[1, -1] = Field(..., description="1 = like, -1 = dislike")


# ── Map / Places ─────────────────────────────────────────────────────────────

class MapItemsQuery(BaseModel):
    lat: float
    lng: float
    radius: float = Field(default=2000.0, description="Search radius in metres")
    categories: Optional[List[str]] = Field(
        default=None,
        description="Optional list of category slugs to filter by",
    )


# ── Reports ──────────────────────────────────────────────────────────────────

class CreateReportRequest(BaseModel):
    report_type: str = Field(..., description="e.g. 'closure', 'hazard', 'noise'")
    title: str = Field(..., max_length=200)
    description: str = Field(default="", max_length=2000)
    lat: float
    lng: float
    anon_fingerprint: Optional[str] = Field(
        default=None,
        description="Anonymous fingerprint (if user not authenticated)",
    )
    duration_hours: int = Field(
        default=4,
        ge=1,
        le=72,
        description="How many hours the report stays active",
    )


class ConfirmReportRequest(BaseModel):
    vote: Literal[1, -1] = Field(
        ..., description="1 = confirm the report is real, -1 = deny"
    )


# ── Report Types ──────────────────────────────────────────────────────────────

class ReportTypeUpsert(BaseModel):
    id: str
    label: str
    icon: str
    color: Optional[str] = None
    duration_h: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


class ReportTypeUpdate(BaseModel):
    label: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    duration_h: Optional[int] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


# ── Preferences ───────────────────────────────────────────────────────────────

class UserPreferencesResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    default_radius_m: int = 2000
    favorite_cats: List[str] = Field(default_factory=list)
    map_style: str = "standard"
    map_minimal: bool = False
    map_preset: str = "classic"
    gado_overlay_on: bool = Field(default=True, serialization_alias="gado_overlay", validation_alias="gado_overlay")
    notifications_on: bool = True
    language: str = "es"
    theme: str = "system"
    show_real_time_events: bool = True


class UserPreferencesUpdate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    default_radius_m: Optional[int] = Field(default=None, ge=500, le=50000)
    favorite_cats: Optional[List[str]] = None
    map_style: Optional[str] = None
    map_minimal: Optional[bool] = None
    map_preset: Optional[str] = None
    gado_overlay_on: Optional[bool] = Field(default=None, serialization_alias="gado_overlay", validation_alias="gado_overlay")
    notifications_on: Optional[bool] = None
    language: Optional[str] = None
    theme: Optional[str] = None
    show_real_time_events: Optional[bool] = None


# ── Events ───────────────────────────────────────────────────────────────────

class CreateEventRequest(BaseModel):
    category_id: str
    title: str = Field(..., max_length=200)
    description: str = Field(default="", max_length=5000)
    lat: float
    lng: float
    starts_at: datetime
    ends_at: Optional[datetime] = None
    photo_url: Optional[str] = None
    address: Optional[str] = None
    price_info: Optional[str] = None
    is_recurring: bool = False
    recurrence: Optional[str] = None
    status: str = "active"


# ── Universal POI / Places ────────────────────────────────────────────────────

class PlaceUpsert(BaseModel):
    external_id: Optional[str] = None
    osm_id: Optional[str] = None
    osm_type: Optional[str] = None
    source: str = "manual"
    category_id: str
    subcategory: Optional[str] = None
    amenity: Optional[str] = None
    name: str
    description: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    photo_url: Optional[str] = None
    rating: Optional[float] = None
    price_level: Optional[int] = None
    lat: float
    lng: float
    tags: Dict[str, Any] = Field(default_factory=dict)
    opening_hours: Optional[str] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)
    is_verified: bool = False
