"""Google Places API (New) wrapper for search, details, and photos.

Key design decisions:
- Text Search requests `places.reviews` inline → avoids N extra detail calls
- No strict includedType filtering → lets Google's AI find relevant results
- 5 reviews per place is Google's hard limit; we use ALL of them (never truncate)
- `reviewSummary` (GA May 2025) provides an AI-generated digest of ALL reviews,
  giving much better signal than just 5 individual reviews for popular places
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

from config import GOOGLE_MAPS_API_KEY
from services.cache_service import cache_get, cache_set

log = logging.getLogger(__name__)

_BASE = "https://places.googleapis.com/v1"

# Shared httpx client — avoids TCP/TLS handshake per request
_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=10, http2=True)
    return _http_client

CATEGORY_TO_GOOGLE_TYPES: dict[str, list[str]] = {
    "food": ["restaurant", "cafe", "bar", "bakery", "meal_delivery"],
    "nightlife": ["night_club", "bar"],
    "shopping": ["shopping_mall", "store", "supermarket"],
    "culture": ["museum", "art_gallery", "library", "tourist_attraction"],
    "nature": ["park", "campground", "tourist_attraction"],
    "sport": ["gym", "stadium", "sports_club"],
    "health": ["pharmacy", "hospital", "doctor"],
    "education": ["school", "university", "library"],
"services": ["bank", "post_office", "atm", "hair_care"],
    "cinema": ["movie_theater"],
    "wellness": ["spa", "physiotherapist"],
    "coworking": ["library"],
    "pets": ["veterinary_care", "pet_store"],
    "automotive": ["gas_station", "car_repair", "car_wash", "parking"],
}


def _photo_proxy_url(photo_name: str) -> str:
    """Build a backend-relative URL for the photo proxy endpoint."""
    return f"/photos/google/{photo_name}"


def _extract_reviews(place: dict) -> list[dict]:
    """Extract and normalize reviews from a Google Places response."""
    reviews = []
    for rev in place.get("reviews", []):
        text_obj = rev.get("text", {})
        text = text_obj.get("text", "") if isinstance(text_obj, dict) else str(text_obj)
        if not text:
            continue
        reviews.append({
            "author": rev.get("authorAttribution", {}).get("displayName", ""),
            "rating": rev.get("rating", 0),
            "text": text,
            "relative_time": rev.get("relativePublishTimeDescription", ""),
        })
    return reviews


def _extract_review_summary(place: dict) -> str:
    """Extract the AI-generated reviewSummary text (GA May 2025).

    This is a Gemini-powered digest of ALL reviews, not just the 5 returned.
    Far more useful for places with thousands of ratings.
    """
    summary = place.get("reviewSummary", {})
    if not summary:
        return ""
    text_obj = summary.get("text", {})
    if isinstance(text_obj, dict):
        return text_obj.get("text", "")
    return str(text_obj) if text_obj else ""


async def search_places(
    *,
    query: str,
    lat: float,
    lng: float,
    radius_m: int = 2000,
    category: Optional[str] = None,
    subcategory: Optional[str] = None,
    strict_category: bool = False,
    limit: int = 20,
    language: str = "es",
) -> list[dict]:
    """Search for places using Google Places API (New) Text Search.

    Returns reviews INLINE with each result — no need for separate detail calls.
    Google returns up to 5 reviews per place (hard API limit).
    """
    if not GOOGLE_MAPS_API_KEY:
        return []

    cache_key = (
        f"gp_search:{query}:{lat:.4f}:{lng:.4f}:{radius_m}:"
        f"{category or ''}:{subcategory or ''}:{strict_category}:{limit}:{language}"
    )
    cached = await cache_get(cache_key)
    if cached:
        return cached

    included_types = set(CATEGORY_TO_GOOGLE_TYPES.get(category or "", []))

    body: dict = {
        "textQuery": query,
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": float(radius_m),
            }
        },
        "maxResultCount": min(limit, 20),
        "languageCode": language,
    }

    # We do NOT enforce includedType — Text Search is smart enough to find
    # what the user wants based on the query, and restricting to a single type
    # breaks categories that map to multiple Google types.

    field_mask = ",".join([
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.rating",
        "places.userRatingCount",
        "places.priceLevel",
        "places.photos",
        "places.types",
        "places.regularOpeningHours",
        # Reviews inline — up to 5 per place, avoids extra detail API calls
        "places.reviews",
        # AI-generated summary of ALL reviews (GA May 2025) — much richer signal
        "places.reviewSummary",
    ])

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": field_mask,
    }

    try:
        client = _get_http_client()
        resp = await client.post(f"{_BASE}/places:searchText", json=body, headers=headers)
        if resp.status_code != 200:
            log.error(f"🔴 GOOGLE PLACES API ERROR: [{resp.status_code}]")
            log.error(f"🔴 RESPONSE: {resp.text}")
            log.error("🔴 TIP: Ensure 'Places API (New)' is enabled for your API key in Google Cloud Console.")
            return []
        data = resp.json()
    except Exception as exc:
        log.warning("Google Places search exception: %s", exc)
        return []

    results: list[dict] = []
    for place in data.get("places", []):
        place_types = set(place.get("types", []))
        if strict_category and included_types and not (place_types & included_types):
            continue

        loc = place.get("location", {})
        photos = place.get("photos", [])
        photo_url = _photo_proxy_url(photos[0]["name"]) if photos else ""
        display_name = place.get("displayName", {})

        # Extract reviews inline — this is the key optimization
        reviews = _extract_reviews(place)
        review_summary = _extract_review_summary(place)

        results.append({
            "source": "google",
            "item_type": "place",
            "id": place.get("id", ""),
            "name": display_name.get("text", "Unknown"),
            "lat": loc.get("latitude"),
            "lng": loc.get("longitude"),
            "address": place.get("formattedAddress", ""),
            "category_id": category,
            "subcategory": subcategory,
            "metadata": {
                "photo_url": photo_url,
                "rating": place.get("rating"),
                "user_rating_count": place.get("userRatingCount"),
                "price_level": place.get("priceLevel"),
                "types": list(place_types),
                "source": "google",
            },
            # Reviews available directly — no extra API call needed
            "google_reviews": reviews,
            # AI digest of ALL reviews — much richer than just 5 texts
            "review_summary": review_summary,
        })
    await cache_set(cache_key, results, ttl=300)
    return results


import asyncio

async def get_place_details(place_id: str, language: str = "es") -> dict | None:
    """Fetch detailed info for a Google place.
    
    Acts as a 'brain' to get the best 15 reviews by querying Google Places
    concurrently in 3 different languages. The primary result uses the 'language' param.
    """
    if not GOOGLE_MAPS_API_KEY:
        return None

    # Cache for 24 hours — reviews and details are stable enough
    cache_key = f"gp_details_v2:{place_id}:{language}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    field_mask = ",".join([
        "displayName",
        "formattedAddress",
        "rating",
        "userRatingCount",
        "photos",
        "regularOpeningHours",
        "priceLevel",
        "reviews",
        "reviewSummary",
        "nationalPhoneNumber",
        "websiteUri",
    ])

    headers = {
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": field_mask,
    }

    try:
        client = _get_http_client()
        
        async def _fetch_lang(lang: str):
            res = await client.get(f"{_BASE}/places/{place_id}?languageCode={lang}", headers=headers)
            if res.status_code == 200:
                return res.json()
            return None

        # Fetch primary language + two others for extra reviews
        other_langs = [l for l in ["es", "en", "fr"] if l != language][:2]
        tasks = [_fetch_lang(language)] + [_fetch_lang(l) for l in other_langs]
        
        results = await asyncio.gather(*tasks)
        data = results[0] # Primary language result
        
        if not data:
            log.warning("Google Place details failed for %s", place_id)
            return None
            
        # Deduplicate reviews across all languages by text fingerprint to allow translated clones through if that was the intended behaviour
        all_reviews = []
        seen_texts = set()
        for res_data in results:
            if not res_data:
                continue
            for r in _extract_reviews(res_data):
                txt = r.get("text", "").strip()
                # Use first 50 chars for fuzzy deduplication
                fingerprint = txt[:50].lower()
                if txt and fingerprint not in seen_texts:
                    seen_texts.add(fingerprint)
                    all_reviews.append(r)
        
    except Exception as exc:
        log.warning("Google Place details error: %s", exc)
        return None

    photos = data.get("photos", [])
    photo_url = _photo_proxy_url(photos[0]["name"]) if photos else ""

    result = {
        "phone": data.get("nationalPhoneNumber", ""),
        "photo_url": photo_url,
        "rating": data.get("rating"),
        "user_rating_count": data.get("userRatingCount"),
        "price_level": data.get("priceLevel"),
        "website": data.get("websiteUri", ""),
        "opening_hours": data.get("regularOpeningHours", {}),
        "google_reviews": all_reviews,
    }

    await cache_set(cache_key, result, ttl=3600 * 24)
    return result


async def get_photo_bytes(photo_name: str, max_width: int = 800) -> bytes | None:
    """Fetch photo binary from Google Places API (New)."""
    if not GOOGLE_MAPS_API_KEY:
        return None

    cache_key = f"gp_photo:{photo_name}:{max_width}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    url = f"{_BASE}/{photo_name}/media"
    params = {
        "maxWidthPx": max_width,
        "key": GOOGLE_MAPS_API_KEY,
    }

    try:
        client = _get_http_client()
        resp = await client.get(url, params=params, follow_redirects=True)
        if resp.status_code != 200:
            log.warning("Google photo fetch failed: %s", resp.status_code)
            return None
        photo_bytes = resp.content
        await cache_set(cache_key, photo_bytes, ttl=3600)
        return photo_bytes
    except Exception as exc:
        log.warning("Google photo fetch error: %s", exc)
        return None
