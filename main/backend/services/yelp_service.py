"""Yelp Fusion wrapper for secondary review enrichment."""

from __future__ import annotations

import logging
import math
from difflib import SequenceMatcher

import httpx

from config import YELP_API_KEY
from services.cache_service import cache_get, cache_set

log = logging.getLogger(__name__)

_BASE = "https://api.yelp.com/v3"
_http_client: httpx.AsyncClient | None = None
_MAX_MATCH_DISTANCE_M = 1500.0
_MAX_FALLBACK_DISTANCE_M = 3200.0
_MIN_NAME_SIMILARITY = 0.62
_FALLBACK_MIN_SCORE = 0.42
_missing_api_key_logged = False

_FOOD_CATEGORY_TERMS = (
    "restaurant",
    "food",
    "cafe",
    "coffee",
    "bar",
    "pub",
    "wine",
    "cocktail",
    "breakfast",
    "brunch",
    "bakery",
    "dessert",
    "pizza",
    "burger",
    "sushi",
    "tapas",
    "steak",
    "seafood",
    "bistro",
    "gastropub",
)

_INCOMPATIBLE_CATEGORY_TERMS = (
    "gas_station",
    "carwash",
    "car_dealers",
    "carrepair",
    "bank",
    "pharmacy",
    "hotel",
    "school",
    "realestate",
    "fitness",
    "shopping",
    "electronics",
)


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=10)
    return _http_client


def _is_api_key_configured() -> bool:
    global _missing_api_key_logged
    if YELP_API_KEY:
        return True
    if not _missing_api_key_logged:
        log.warning("YELP_API_KEY is not configured. Yelp review enrichment is disabled.")
        _missing_api_key_logged = True
    return False


def _review_locale(language: str) -> str:
    lang = (language or "es").strip().lower()
    if lang.startswith("en"):
        return "en_US"
    if lang.startswith("fr"):
        return "fr_FR"
    if lang.startswith("it"):
        return "it_IT"
    if lang.startswith("de"):
        return "de_DE"
    if lang.startswith("pt"):
        return "pt_PT"
    if lang.startswith("ca"):
        return "es_ES"
    return "es_ES"


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, (a or "").lower().strip(), (b or "").lower().strip()).ratio()


def _distance_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius = 6_371_000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlng / 2) ** 2
    return radius * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _business_distance_m(business: dict, *, lat: float, lng: float) -> float:
    raw_distance = business.get("distance")
    if isinstance(raw_distance, (int, float)) and raw_distance >= 0:
        return float(raw_distance)
    biz_lat = business.get("coordinates", {}).get("latitude")
    biz_lng = business.get("coordinates", {}).get("longitude")
    if isinstance(biz_lat, (int, float)) and isinstance(biz_lng, (int, float)):
        return _distance_m(lat, lng, float(biz_lat), float(biz_lng))
    return float("inf")


def _category_tokens(business: dict) -> set[str]:
    tokens: set[str] = set()
    for category in business.get("categories", []):
        if not isinstance(category, dict):
            continue
        alias = str(category.get("alias") or "").strip().lower()
        title = str(category.get("title") or "").strip().lower()
        if alias:
            tokens.add(alias)
        if title:
            tokens.add(title)
    return tokens


def _is_food_compatible(business: dict) -> bool:
    tokens = _category_tokens(business)
    if not tokens:
        return False

    for token in tokens:
        if any(bad in token for bad in _INCOMPATIBLE_CATEGORY_TERMS):
            return False

    if any(any(term in token for term in _FOOD_CATEGORY_TERMS) for token in tokens):
        return True

    # Yelp search is already filtered to food-ish categories in _find_business_id.
    return True


def _is_business_match(business: dict, *, name: str, lat: float, lng: float) -> bool:
    name_similarity = _similarity(name, business.get("name", ""))
    if name_similarity < _MIN_NAME_SIMILARITY:
        return False

    if _business_distance_m(business, lat=lat, lng=lng) > _MAX_MATCH_DISTANCE_M:
        return False

    return _is_food_compatible(business)


def _score_business(business: dict, *, name: str, lat: float, lng: float, address: str) -> float:
    score = 0.0
    score += _similarity(name, business.get("name", "")) * 0.7

    distance_penalty = min(1.0, _business_distance_m(business, lat=lat, lng=lng) / 2000.0)
    score += max(0.0, 0.2 - distance_penalty * 0.2)

    location_bits = business.get("location", {}).get("display_address") or []
    location_text = ", ".join(location_bits)
    if address and location_text:
        score += _similarity(address, location_text) * 0.1
    if _is_food_compatible(business):
        score += 0.15
    return score


async def _find_business_id(
    *,
    name: str,
    lat: float,
    lng: float,
    address: str = "",
    language: str = "es",
) -> tuple[str | None, int]:
    if not _is_api_key_configured() or not name:
        return None, 0

    cache_key = f"yelp_match_v3:{name}:{lat:.4f}:{lng:.4f}:{address}:{language}"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached.get("id"), cached.get("count", 0)

    headers = {"Authorization": f"Bearer {YELP_API_KEY}"}
    params = {
        "term": name,
        "latitude": lat,
        "longitude": lng,
        "radius": 2000,
        "categories": "restaurants,bars,cafes,food",
        "limit": 5,
        "sort_by": "best_match",
        "locale": _review_locale(language),
    }

    try:
        client = _get_http_client()
        resp = await client.get(f"{_BASE}/businesses/search", params=params, headers=headers)
        if resp.status_code != 200:
            log.info("Yelp business search failed for %r: %s", name, resp.status_code)
            await cache_set(cache_key, {"id": None, "count": 0}, ttl=1800)
            return None, 0
        businesses = resp.json().get("businesses", [])
    except Exception as exc:
        log.info("Yelp business search exception for %r: %s", name, exc)
        return None, 0

    if not businesses:
        await cache_set(cache_key, {"id": None, "count": 0}, ttl=1800)
        return None, 0

    scored = sorted(
        businesses,
        key=lambda b: _score_business(b, name=name, lat=lat, lng=lng, address=address),
        reverse=True,
    )
    best_id: str | None = None
    review_count = 0
    fallback_id: str | None = None
    fallback_score = 0.0
    fallback_review_count = 0
    for business in scored:
        score = _score_business(business, name=name, lat=lat, lng=lng, address=address)
        candidate_id = str(business.get("id") or "").strip() or None

        if (
            candidate_id
            and _is_food_compatible(business)
            and _business_distance_m(business, lat=lat, lng=lng) <= _MAX_FALLBACK_DISTANCE_M
            and score > fallback_score
        ):
            fallback_id = candidate_id
            fallback_score = score
            fallback_review_count = int(business.get("review_count") or 0)

        if not _is_business_match(business, name=name, lat=lat, lng=lng):
            continue
        if score < 0.55:
            continue
        best_id = candidate_id
        if best_id:
            review_count = int(business.get("review_count") or 0)
            break

    if not best_id and fallback_id and fallback_score >= _FALLBACK_MIN_SCORE:
        best_id = fallback_id
        review_count = fallback_review_count

    await cache_set(cache_key, {"id": best_id or "", "count": review_count}, ttl=1800)
    return best_id, review_count


async def get_yelp_reviews(
    *,
    name: str,
    lat: float,
    lng: float,
    address: str = "",
    language: str = "es",
) -> dict:
    """Return Yelp reviews and total count for a nearby business match, if any."""
    if not _is_api_key_configured():
        return {"reviews": [], "total_count": 0}

    business_id, review_count = await _find_business_id(name=name, lat=lat, lng=lng, address=address, language=language)
    if not business_id:
        return {"reviews": [], "total_count": 0}

    cache_key = f"yelp_reviews_v3:{business_id}:{language}"
    cached = await cache_get(cache_key)
    if cached:
        return {"reviews": cached, "total_count": review_count}

    headers = {"Authorization": f"Bearer {YELP_API_KEY}"}

    async def _fetch_reviews_for(locale: str) -> list[dict]:
        params = {"locale": locale}
        try:
            client = _get_http_client()
            resp = await client.get(f"{_BASE}/businesses/{business_id}/reviews", params=params, headers=headers)
            if resp.status_code != 200:
                log.info("Yelp reviews failed for %s locale=%s: %s", business_id, locale, resp.status_code)
                return []
            payload = resp.json()
        except Exception as exc:
            log.info("Yelp reviews exception for %s locale=%s: %s", business_id, locale, exc)
            return []

        reviews: list[dict] = []
        for review in payload.get("reviews", [])[:3]:
            text = str(review.get("text") or "").strip()
            if not text:
                continue
            user = review.get("user") or {}
            reviews.append(
                {
                    "author": user.get("name", "Yelp user"),
                    "rating": int(review.get("rating") or 0),
                    "text": text,
                    "relative_time": str(review.get("time_created") or ""),
                    "source_language": language,
                    "source": "yelp",
                    "url": review.get("url", ""),
                }
            )
        return reviews

    locale = _review_locale(language)
    reviews = await _fetch_reviews_for(locale)
    if not reviews and locale != "en_US":
        reviews = await _fetch_reviews_for("en_US")

    if review_count <= 0 and reviews:
        review_count = len(reviews)

    await cache_set(cache_key, reviews, ttl=3600 * 6)
    return {"reviews": reviews, "total_count": review_count}
