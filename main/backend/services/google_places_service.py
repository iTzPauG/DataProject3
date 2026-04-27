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
from collections import OrderedDict
from typing import Optional

import httpx

from config import GOOGLE_MAPS_API_KEY
from services.cache_service import cache_get, cache_set
from services.yelp_service import get_yelp_reviews

log = logging.getLogger(__name__)

_BASE = "https://places.googleapis.com/v1"

# Shared httpx client — avoids TCP/TLS handshake per request
_http_client: httpx.AsyncClient | None = None


def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        # Keep transport requirements minimal in Cloud Run images.
        _http_client = httpx.AsyncClient(timeout=10)
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

_SEARCH_LANGUAGE_POOL = ("es", "en", "ca", "fr", "it", "de", "pt")


def _photo_proxy_url(photo_name: str) -> str:
    """Build a backend-relative URL for the photo proxy endpoint."""
    return f"/photos/google/{photo_name}"


def _extract_reviews(place: dict, source_language: str | None = None) -> list[dict]:
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
            "source_language": source_language or "",
            "source": "google",
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
        f"gp_search_v2:{query}:{lat:.4f}:{lng:.4f}:{radius_m}:"
        f"{category or ''}:{subcategory or ''}:{strict_category}:{limit}:{language}"
    )
    cached = await cache_get(cache_key)
    if cached:
        return cached

    included_types = set(CATEGORY_TO_GOOGLE_TYPES.get(category or "", []))

    search_languages = _search_languages_for_query(language, max_languages=3)

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

        async def _search_lang(lang: str) -> tuple[str, dict | None]:
            body: dict = {
                "textQuery": query,
                "locationBias": {
                    "circle": {
                        "center": {"latitude": lat, "longitude": lng},
                        "radius": float(radius_m),
                    }
                },
                "maxResultCount": min(limit, 20),
                "languageCode": lang,
            }
            resp = await client.post(f"{_BASE}/places:searchText", json=body, headers=headers)
            if resp.status_code != 200:
                log.error("Google Places searchText failed [%s] lang=%s query=%r body=%s", resp.status_code, lang, query, resp.text[:400])
                return lang, None
            return lang, resp.json()

        payloads = await asyncio.gather(*[_search_lang(lang) for lang in search_languages])
        data_by_lang = OrderedDict(payloads)
        primary_data = data_by_lang.get(search_languages[0]) or {}
    except Exception as exc:
        log.warning(
            "Google Places search exception: query=%r category=%r subcategory=%r radius_m=%s language=%s error=%s",
            query,
            category,
            subcategory,
            radius_m,
            language,
            exc,
        )
        return []

    def _review_fingerprint(review: dict) -> tuple[str, int, str, str]:
        text = " ".join(str(review.get("text", "")).strip().lower().split())
        return (
            str(review.get("author", "")).strip().lower(),
            int(review.get("rating") or 0),
            str(review.get("source_language", "")).strip().lower(),
            text,
        )

    merged_by_id: OrderedDict[str, dict] = OrderedDict()

    for index, place in enumerate(primary_data.get("places", [])):
        pid = place.get("id", "")
        if pid:
            merged_by_id[pid] = {
                "place": place,
                "index": index,
                "reviews": _extract_reviews(place, source_language=search_languages[0]),
                "review_summary": _extract_review_summary(place),
            }

    for lang, data in data_by_lang.items():
        if not data:
            continue
        for place in data.get("places", []):
            pid = place.get("id", "")
            if not pid:
                continue
            entry = merged_by_id.get(pid)
            reviews = _extract_reviews(place, source_language=lang)
            if entry is None:
                merged_by_id[pid] = {
                    "place": place,
                    "index": len(merged_by_id),
                    "reviews": reviews,
                    "review_summary": _extract_review_summary(place),
                }
                continue
            existing = entry["reviews"]
            seen = {_review_fingerprint(r) for r in existing}
            for review in reviews:
                fp = _review_fingerprint(review)
                if fp not in seen and review.get("text"):
                    seen.add(fp)
                    existing.append(review)
            if not entry.get("review_summary"):
                entry["review_summary"] = _extract_review_summary(place)

    results: list[dict] = []
    for pid, entry in list(merged_by_id.items())[:limit]:
        place = entry["place"]
        place_types = set(place.get("types", []))
        if strict_category and included_types and not (place_types & included_types):
            continue

        loc = place.get("location", {})
        photos = place.get("photos", [])
        photo_url = _photo_proxy_url(photos[0]["name"]) if photos else ""
        display_name = place.get("displayName", {})

        # Extract reviews inline — this is the key optimization
        reviews = entry["reviews"]
        review_summary = entry["review_summary"]

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

_REVIEW_LANGUAGE_POOL = ("es", "en", "fr", "it", "de", "ca", "pt")


def _search_languages_for_query(language: str, max_languages: int = 3) -> list[str]:
    preferred = (language or "es").strip().lower() or "es"
    ordered = [preferred]
    for lang in _SEARCH_LANGUAGE_POOL:
        if lang not in ordered:
            ordered.append(lang)
        if len(ordered) >= max_languages:
            break
    return ordered[:max_languages]


def _review_languages_for_place(language: str, max_languages: int = 5) -> list[str]:
    """Pick the preferred language plus up to N-1 useful alternates for reviews.

    The app language always goes first so UI-aligned content wins ties, then we add
    common tourism/local languages for Valencia to maximize review yield.
    """
    preferred = (language or "es").strip().lower() or "es"
    ordered = [preferred]
    for lang in _REVIEW_LANGUAGE_POOL:
        if lang not in ordered:
            ordered.append(lang)
        if len(ordered) >= max_languages:
            break
    return ordered[:max_languages]


async def get_place_details(place_id: str, language: str = "es") -> dict | None:
    """Fetch detailed info for a Google place.
    
    Acts as a 'brain' to get the best review coverage by querying Google Places
    concurrently in up to 5 different languages. The primary result uses the
    app/request language so the visible place data stays aligned with the UI.
    Yelp is optional enrichment only; if it fails, Google still drives the result.
    """
    if not GOOGLE_MAPS_API_KEY:
        return None

    # Cache for 24 hours — reviews and details are stable enough
    cache_key = f"gp_details_v3:{place_id}:{language}"
    cached = await cache_get(cache_key)
    if cached:
        return cached

    field_mask = ",".join([
        "displayName",
        "formattedAddress",
        "location",
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

    yelp_reviews: list[dict] = []

    try:
        client = _get_http_client()
        
        async def _fetch_lang(lang: str):
            res = await client.get(f"{_BASE}/places/{place_id}?languageCode={lang}", headers=headers)
            if res.status_code == 200:
                return res.json()
            return None

        review_languages = _review_languages_for_place(language, max_languages=5)
        tasks = [_fetch_lang(lang) for lang in review_languages]
        
        results = await asyncio.gather(*tasks)
        data = results[0]  # Primary/app language result
        
        if not data:
            log.warning("Google Place details failed for %s", place_id)
            return None
            
        all_reviews = []
        seen_reviews = set()
        for lang, res_data in zip(review_languages, results):
            if not res_data:
                continue
            for r in _extract_reviews(res_data, source_language=lang):
                txt = " ".join(str(r.get("text", "")).strip().lower().split())
                fingerprint = (
                    str(r.get("author", "")).strip().lower(),
                    int(r.get("rating") or 0),
                    str(r.get("relative_time", "")).strip().lower(),
                    str(r.get("source_language", "")).strip().lower(),
                    txt,
                )
                if txt and fingerprint not in seen_reviews:
                    seen_reviews.add(fingerprint)
                    all_reviews.append(r)

    except Exception as exc:
        log.warning("Google Place details error: %s", exc)
        return None

    try:
        yelp_reviews = await get_yelp_reviews(
            name=data.get("displayName", {}).get("text", ""),
            lat=float(data.get("location", {}).get("latitude") or 0.0),
            lng=float(data.get("location", {}).get("longitude") or 0.0),
            address=data.get("formattedAddress", ""),
            language=language,
        )
    except Exception as exc:
        log.info("Yelp enrichment failed for %s: %s", place_id, exc)
        yelp_reviews = []

    for r in yelp_reviews:
        txt = " ".join(str(r.get("text", "")).strip().lower().split())
        fingerprint = (
            str(r.get("author", "")).strip().lower(),
            int(r.get("rating") or 0),
            str(r.get("source_language", "")).strip().lower(),
            txt,
        )
        if txt and fingerprint not in seen_reviews:
            seen_reviews.add(fingerprint)
            all_reviews.append(r)

    photos = data.get("photos", [])
    photo_url = _photo_proxy_url(photos[0]["name"]) if photos else ""

    result = {
        "name": data.get("displayName", {}).get("text", ""),
        "address": data.get("formattedAddress", ""),
        "phone": data.get("nationalPhoneNumber", ""),
        "photo_url": photo_url,
        "rating": data.get("rating"),
        "user_rating_count": data.get("userRatingCount"),
        "price_level": data.get("priceLevel"),
        "website": data.get("websiteUri", ""),
        "opening_hours": data.get("regularOpeningHours", {}),
        "google_reviews": all_reviews,
        "yelp_reviews": yelp_reviews,
        "review_summary": _extract_review_summary(data),
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
