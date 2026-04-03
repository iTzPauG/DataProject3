"""
Recommendation pipeline — optimised for speed.

2 LLM calls total (down from 4 + N):
  A  search_places()      → Google Places API, up to 20 candidates + haversine + inline reviews
  B  pre_filter()         → drop low-rated / wrong-price / too-far; rank by rating × log(reviews)
  C  merge_reviews()      → use inline reviews from search (no extra API calls needed)
  D  resolve_mood()       → DETERMINISTIC mood → structured prefs (no LLM)
  E  analyze_reviews()    → ONE LLM call: quality scores + signals for all candidates
  F  contextual_rank()    → formula-based ranking with distance + quality, top 10
  G  enrich_batch()       → ONE LLM call: brutally honest pros/cons/verdict for all top results
"""

import asyncio
import json
import logging
import math
import os
import re
import time
from typing import AsyncGenerator

from google import genai
from google.genai import types

from .tools import fetch_all_reviews, haversine, search_places
from .category_flow import get_flow_definition
from services.live_data_service import get_live_data

MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

log = logging.getLogger("pipeline")
logging.basicConfig(
    level=logging.DEBUG,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
for _noisy in ("httpcore", "httpx", "urllib3", "google.auth"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

MAX_DISTANCE_KM = 8.0
PREFILTER_CANDIDATES = 15
TOP_RESULTS = 10
MIN_RESULTS = 5

# ── Shared Gemini client ─────────────────────────────────────────────────────
_genai_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _genai_client
    if _genai_client is None:
        api_key = os.getenv("GOOGLE_GENAI_API_KEY") or os.getenv("GEMINI_API_KEY")
        _genai_client = genai.Client(api_key=api_key)
    return _genai_client


_llm_timings: list[dict] = []


async def _llm(name: str, instruction: str, prompt: str, *, json_mode: bool = True) -> str:
    """Direct google-genai call with optional JSON-forced output."""
    log.info("[LLM:%s] → %d chars de prompt", name, len(prompt))
    t0 = time.perf_counter()

    config_kwargs: dict = {
        "system_instruction": instruction,
        "temperature": 0.2,
    }
    if json_mode:
        config_kwargs["response_mime_type"] = "application/json"

    response = await _get_client().aio.models.generate_content(
        model=MODEL,
        contents=prompt,
        config=types.GenerateContentConfig(**config_kwargs),
    )
    final = response.text or ""
    elapsed = time.perf_counter() - t0

    usage = response.usage_metadata
    prompt_tok   = getattr(usage, "prompt_token_count",     "?")
    response_tok = getattr(usage, "candidates_token_count", "?")
    total_tok    = getattr(usage, "total_token_count",      "?")

    log.info(
        "[LLM:%s] ← %.2fs | tokens in=%s out=%s total=%s | respuesta %d chars",
        name, elapsed, prompt_tok, response_tok, total_tok, len(final),
    )
    _llm_timings.append({
        "name": name, "elapsed": elapsed,
        "tokens_in": prompt_tok, "tokens_out": response_tok, "tokens_total": total_tok,
    })
    return final


def _parse_json(text: str):
    """Pull a JSON array or object out of an LLM response."""
    # If response_mime_type=json was used, text is already clean JSON
    text = text.strip()
    if text and text[0] in ("[", "{"):
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if m:
        return json.loads(m.group(1))
    for open_c, close_c in [("[", "]"), ("{", "}")]:
        s, e = text.find(open_c), text.rfind(close_c)
        if s != -1 and e > s:
            return json.loads(text[s : e + 1])
    return json.loads(text)


# ── Category label helper ────────────────────────────────────────────────────

def _category_label(parent_category: str) -> str:
    """Human-readable label for the category, used in LLM prompts."""
    flow = get_flow_definition(parent_category)
    return flow.get("label", parent_category.replace("_", " ").title())


def _category_noun(parent_category: str) -> str:
    """What we call individual results: 'restaurante', 'bar', 'parque', etc."""
    NOUNS = {
        "food": "lugar", "restaurant": "restaurante",
        "nightlife": "local", "shopping": "tienda",
        "health": "centro de salud",
        "nature": "espacio natural", "culture": "espacio cultural",
        "services": "servicio", "sport": "instalacion deportiva",
        "education": "centro educativo", "cinema": "cine",
        "wellness": "centro de bienestar", "coworking": "espacio de coworking",
        "pets": "servicio de mascotas", "automotive": "servicio de automocion",
    }
    return NOUNS.get(parent_category, "lugar")


def _infer_city(address: str | None) -> str | None:
    """Best-effort city extraction for downstream live-data links."""
    if not address:
        return None
    parts = [part.strip() for part in address.split(",") if part.strip()]
    for part in reversed(parts):
        if any(ch.isalpha() for ch in part):
            return part
    return None


# ── Step B — pre_filter (Python) ─────────────────────────────────────────────

def _pre_filter(candidates: list[dict], price_level: int | None, n: int = PREFILTER_CANDIDATES) -> list[dict]:
    """Drop low-rated / price-mismatched places, rank by Google's own signal."""
    dropped = []
    kept = []
    far_candidates = []
    for r in candidates:
        rating = r.get("rating", 0) or 0
        price_diff = 0
        if price_level is not None and r.get("price_level") is not None:
            price_diff = abs(r.get("price_level", price_level) - price_level)
        distance_km = r.get("distance_m", 0) / 1000.0
        if rating < 3.0:
            dropped.append(f"{r['name']} (rating {rating} < 3.0)")
        elif price_level is not None and price_diff > 1:
            dropped.append(f"{r['name']} (price_level {r.get('price_level')} vs requested {price_level})")
        elif distance_km > MAX_DISTANCE_KM:
            far_candidates.append(r)
        else:
            kept.append(r)

    def _sort_key(r: dict):
        return (
            (r.get("rating") or 0.0) * math.log10((r.get("total_ratings") or 0) + 1),
            -(r.get("distance_m") or 0),
        )

    if dropped:
        log.debug("[B] dropped %d candidates: %s", len(dropped), " | ".join(dropped))

    kept.sort(key=_sort_key, reverse=True)
    far_candidates.sort(key=_sort_key, reverse=True)
    if len(kept) < n and far_candidates:
        kept.extend(far_candidates[: max(0, n - len(kept))])

    result = kept[:n]
    log.info(
        "[B] pre_filter: %d → %d candidates  |  kept: %s",
        len(candidates), len(result),
        ", ".join(f"{r['name']} ({r.get('rating')}★, {r.get('distance_m', 0):.0f}m)" for r in result),
    )
    return result


# ── Step D — resolve_mood (DETERMINISTIC — no LLM) ──────────────────────────

_MOOD_MAP: dict[str, dict] = {
    "quick":        {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["quick", "casual", "efficient"]},
    "casual":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["casual", "relaxed", "informal"]},
    "date":         {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["romantic", "intimate", "cozy"]},
    "family":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["family-friendly", "spacious", "welcoming"]},
    "celebration":  {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["festive", "impressive", "elegant"]},
    "sharing":      {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["lively", "sharing", "social"]},
    "gourmet":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["gourmet", "fine-dining", "elegant"]},
    "tapas":        {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["lively", "bustling", "traditional"]},
    "chill":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["chill", "relaxed", "quiet"]},
    "party":        {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["energetic", "loud", "dancing"]},
    "friends":      {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["social", "lively", "fun"]},
    "music":        {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["live-music", "atmosphere", "energetic"]},
    "relax":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["peaceful", "scenic", "relaxing"]},
    "active":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["adventurous", "active", "outdoor"]},
    "photo_spot":   {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["scenic", "photogenic", "panoramic"]},
    "learn":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["educational", "immersive", "quiet"]},
    "interactive":  {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["interactive", "fun", "immersive"]},
    "classic":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["historical", "classic", "impressive"]},
    "entertainment": {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["entertaining", "fun", "casual"]},
    "window":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["browsing", "relaxed", "leisurely"]},
    "treat_myself": {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["premium", "treat", "luxury"]},
    "sale":         {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["bargain", "deals", "sale"]},
    "luxury":       {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["luxury", "premium", "exclusive"]},
    "urgent":       {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["fast", "trusted", "nearby"]},
    "checkup":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["professional", "trusted", "modern"]},
    "specialist":   {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["specialist", "expert", "professional"]},
    "intense":      {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["intense", "competitive", "professional"]},
    "fun":          {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["fun", "social", "casual"]},
    "competitive":  {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["competitive", "intense", "skilled"]},
    "beginner":     {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["beginner-friendly", "relaxed", "welcoming"]},
    "action":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["action", "exciting", "thrilling"]},
    "comedy":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["comedy", "fun", "lighthearted"]},
    "drama":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["dramatic", "intense", "emotional"]},
    "indie":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["indie", "alternative", "artistic"]},
    "blockbuster":  {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["blockbuster", "epic", "spectacular"]},
    "kids":         {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["kids", "family", "animated"]},
    "premium":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["premium", "comfortable", "luxury"]},
    "fast":         {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["quick", "efficient", "direct"]},
    "cheap":        {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["affordable", "value", "budget"]},
    "eco":          {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["eco-friendly", "green", "sustainable"]},
    "comfort":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["comfortable", "convenient", "relaxed"]},
    "quiet":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["quiet", "focused", "peaceful"]},
    "social":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["social", "collaborative", "networking"]},
    "focused":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["focused", "productive", "quiet"]},
    "group":        {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["group", "social", "spacious"]},
    "nearby":       {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["nearby", "convenient", "accessible"]},
    "trusted":      {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["trusted", "reliable", "professional"]},
    "emergency":    {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["emergency", "urgent", "fast"]},
    "friendly":     {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["friendly", "welcoming", "caring"]},
    "open_now":     {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["open-now", "accessible", "fast"]},
    "affordable":   {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["affordable", "cheap", "value"]},
    "flexible_hours": {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["flexible", "accessible", "convenient"]},
    "stress_relief": {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["relaxing", "calming", "therapeutic"]},
    "picnic":       {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["picnic", "outdoor", "park"]},
    "breakdown":    {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["emergency", "repair", "urgent"]},
    # Cinema occasion moods
    "date_night":   {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["romantic", "intimate", "cozy"]},
    "solo":         {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["solo", "relaxed", "independent"]},
    # Services
    "express":      {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["express", "quick", "efficient"]},
    # Wellness
    "disconnect":   {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["disconnect", "peaceful", "escape"]},
    "couples":      {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["couples", "romantic", "exclusive"]},
    "detox":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["detox", "purifying", "healthy"]},
    # Coworking
    "focus":        {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["focused", "quiet", "productive"]},
    "networking":   {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["networking", "social", "professional"]},
    # Pets
    "routine_care": {"prefer_quiet": True,  "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["routine", "professional", "trusted"]},
    "new_pet":      {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["new", "welcoming", "guidance"]},
    "training":     {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["training", "discipline", "active"]},
    # Automotive
    "maintenance":  {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": True,  "prefer_outdoor": False, "vibe_keywords": ["maintenance", "professional", "trusted"]},
    "quick_stop":   {"prefer_quiet": False, "prefer_fast": True,  "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["quick", "efficient", "convenient"]},
    "roadtrip":     {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["roadtrip", "adventure", "prepared"]},
    # Sport
    "outdoor":      {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": True,  "vibe_keywords": ["outdoor", "fresh-air", "nature"]},
    "classes":      {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["classes", "structured", "guided"]},
    "competition":  {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": ["competitive", "intense", "tournament"]},
}

_NEUTRAL_MOOD = {"prefer_quiet": False, "prefer_fast": False, "prefer_formal": False, "prefer_outdoor": False, "vibe_keywords": []}


def _resolve_mood(mood: str) -> dict:
    """Instant mood resolution — no LLM needed."""
    result = _MOOD_MAP.get(mood, _NEUTRAL_MOOD)
    log.info("[D] resolve_mood('%s') → %s", mood, result)
    return result


# ── Step E — analyze reviews (SINGLE LLM call) ────────────────────────────

def _review_confidence(r: dict) -> float:
    total = r.get("total_ratings", 0) or 0
    rating_confidence = min(1.0, math.log10(total + 1) / math.log10(20000))
    text_count = len(r.get("google_reviews", []))
    text_bonus = min(0.15, text_count * 0.03)
    return min(1.0, rating_confidence + text_bonus)


def _enrich_fallback(r: dict, signals: dict[str, dict]) -> dict:
    pid = r["place_id"]
    sig = signals.get(pid, {})
    total = r.get("total_ratings") or 0
    return {
        "id": pid, 
        "name": r.get("name"), 
        "priceLevel": int(r.get("price_level") or 2), 
        "rating": float(r.get("rating") or 0.0),
        "reviewsCount": int(total), 
        "address": r.get("address", "") or "", 
        "phone": r.get("phone", "") or "",
        "photoUrl": r.get("photo_url", "") or "", 
        "tagline": r.get("name", "") or "", 
        "why": "",
        "pros": sig.get("green_flags", [])[:2] or ["Sin suficientes datos."],
        "cons": sig.get("red_flags", [])[:2] or (["Pocas reseñas."] if total < 50 else ["Sin quejas destacadas."]),
        "verdict": "Sin suficiente informacion." if total < 50 else "Lugar popular.",
        "tags": sig.get("atmosphere_tags", [])[:4], 
        "reviews": r.get("google_reviews", [])[:15],
        "review_count": int(total), 
        "lat": float(r.get("lat") or 0.0), 
        "lng": float(r.get("lng") or 0.0),
        "bestReviewQuote": r.get("best_review_quote") or "",
        "reviewQualityScore": float(r.get("review_quality_score") or 0.5),
        "distanceM": int(r.get("distance_m") or 0),
    }


# ── Orchestrator ──────────────────────────────────────────────────────────────

async def recommend(parent_category: str, subcategory: str | None, mood: str, price_level: int | None, lat: float, lng: float, fast_mode: bool = False, language: str = "es") -> list[dict]:
    t_total = time.perf_counter()
    _llm_timings.clear()
    resolved_sub = subcategory or parent_category
    label = _category_label(parent_category)
    log.info("=" * 60)
    log.info("REQUEST category='%s' (%s) mood='%s' lang=%s", parent_category, label, mood, language)
    
    # PHASE 1: Parallel Search + Predictive Review Fetching
    t_step = time.perf_counter()
    raw = await search_places(parent_category, resolved_sub, lat, lng, price_level, language=language)
    candidates = raw.get("restaurants", [])
    log.info("[PERF] Step A (Search): %.2fs", time.perf_counter() - t_step)
    
    if not candidates: return []
    
    # PHASE 2: Fast Filter & Pre-Ranking (Python only)
    t_step = time.perf_counter()
    candidates = _pre_filter(candidates, price_level)
    log.info("[PERF] Step B (Pre-filter): %.2fs", time.perf_counter() - t_step)

    # PHASE 3: Deep Fetch (Parallel) for ONLY the top 5 candidates
    t_step = time.perf_counter()
    top_winners = candidates[:5]
    
    async def _deep_fetch_safe(r: dict) -> dict:
        try:
            data = await fetch_all_reviews(r["place_id"], r["name"], r["lat"], r["lng"], language=language)
            return {**r, **data}
        except Exception as e:
            log.warning("[G] Deep fetch failed for %s: %s", r.get("name"), e)
            return r

    results = await asyncio.gather(*[_deep_fetch_safe(r) for r in top_winners], return_exceptions=True)
    top_winners = [r for r in results if isinstance(r, dict)]
    log.info("[PERF] Step C (Deep Fetch Top %d): %.2fs", len(top_winners), time.perf_counter() - t_step)

    # PHASE 4: Single LLM Call (Analyze + Translate + Enrich)
    t_step = time.perf_counter()
    
    lang_map = {"es": "Spanish", "en": "English", "fr": "French"}
    target_lang = lang_map.get(language, "Spanish")
    
    ai_payload = []
    for r in top_winners:
        ai_payload.append({
            "id": r["place_id"],
            "name": r["name"],
            "reviews": r.get("google_reviews", [])[:15],
            "summary": r.get("review_summary", "")
        })

    instruction = f"""You are GADO, a brutally honest guide for {label} in Valencia, Spain.
TASK: For each place, perform these 3 steps in ONE go:
1. ANALYSIS: Detect quality, vibe, and red flags from reviews.
2. TRANSLATION: Translate the provided 'reviews' (author, text) into {target_lang}.
3. ENRICHMENT: Write tagline, pros, cons, and verdict in {target_lang}.

RULES:
- Be honest. If there are negatives, you MUST include them in 'cons'.
- Tone: Local, direct, insightful.
- Output: A JSON array of objects.
"""

    prompt = f"""Language: {target_lang}. Vibe requested: {mood}.
For each place in this list, return:
- id: same as place_id
- translated_reviews: array containing ALL provided reviews (do not drop any, even if they seem similar) with 'author', 'text' (translated), 'rating', 'relative_time'
- tagline: 5-8 word summary in {target_lang}
- why: 1-2 sentences in {target_lang} matching user mood
- pros: 2-3 specific points in {target_lang}
- cons: 1-2 specific negatives in {target_lang}
- verdict: Final honest take in {target_lang}
- tags: 3-5 descriptive tags in {target_lang}

PLACES:
{json.dumps(ai_payload, ensure_ascii=False)}
"""

    try:
        raw_ai = await _llm(name="combined_ai", instruction=instruction, prompt=prompt)
        ai_results = _parse_json(raw_ai)
        
        # Ensure ai_results is a list
        if isinstance(ai_results, dict):
            ai_results = [ai_results]
        elif not isinstance(ai_results, list):
            ai_results = []
            
        ai_map = {item.get("id"): item for item in ai_results if isinstance(item, dict) and "id" in item}
        
        final_results = []
        for r in top_winners:
            ai_data = ai_map.get(r["place_id"], {})
            
            # Safety: Ensure reviews is always a list before slicing
            translated = ai_data.get("translated_reviews")
            if not isinstance(translated, list):
                translated = r.get("google_reviews")
            if not isinstance(translated, list):
                translated = []
                
            # Safety: Map reviews to match schema exactly
            safe_reviews = []
            for rev in translated[:15]:
                if not isinstance(rev, dict): continue
                safe_reviews.append({
                    "author": str(rev.get("author", "Anonymous")),
                    "rating": int(rev.get("rating") or 0),
                    "text": str(rev.get("text") or ""),
                    "relative_time": str(rev.get("relative_time") or "n/a"),
                })

            final_results.append({
                "id": r["place_id"],
                "name": str(r.get("name") or ""),
                "address": r.get("address", "") or "",
                "website": r.get("website"),
                "city": r.get("city") or _infer_city(r.get("address")),
                "rating": float(r.get("rating") or 0.0),
                "priceLevel": int(r.get("price_level") or 2),
                "photoUrl": r.get("photo_url", "") or "",
                "lat": float(r.get("lat") or 0.0),
                "lng": float(r.get("lng") or 0.0),
                "distanceM": int(r.get("distance_m") or 0),
                "tagline": ai_data.get("tagline") or str(r.get("name") or ""),
                "why": ai_data.get("why") or "",
                "pros": ai_data.get("pros") or [],
                "cons": ai_data.get("cons") or [],
                "verdict": ai_data.get("verdict") or "",
                "reviews": safe_reviews,
                "reviewsCount": int(r.get("total_ratings") or 0),
                "review_count": int(r.get("total_ratings") or 0),
                "bestReviewQuote": ai_data.get("best_quote") or r.get("best_review_quote") or "",
                "reviewQualityScore": float(ai_data.get("quality_score") or r.get("review_quality_score") or 0.5),
                "tags": ai_data.get("tags") or [],
            })
            
        log.info("[PERF] Step E+G (Combined AI): %.2fs", time.perf_counter() - t_step)
        
        # PHASE 5: Fetch Live Data (Parallel)
        t_step = time.perf_counter()
        live_data_tasks = [
            get_live_data(
                category=parent_category,
                subcategory=subcategory,
                lat=r.get("lat") or lat,
                lng=r.get("lng") or lng,
                website=r.get("website"),
                name=r.get("name"),
                city=r.get("city"),
            )
            for r in final_results
        ]
        live_data_results = await asyncio.gather(*live_data_tasks, return_exceptions=True)
        for i, r in enumerate(final_results):
            ld = live_data_results[i]
            r["liveData"] = ld if isinstance(ld, dict) else {"type": "none"}
        log.info("[PERF] Step H (Live Data): %.2fs", time.perf_counter() - t_step)

        total_time = time.perf_counter() - t_total
        log.info("=" * 60)
        log.info("[PERF] TURBO PIPELINE DONE in %.2fs", total_time)
        log.info("=" * 60)
        return final_results

    except Exception as exc:
        log.error("[AI] Combined call failed or mapping error: %s", exc)
        fallback_results = [_enrich_fallback(r, {}) for r in top_winners]
        # Fetch live data for fallbacks too
        live_data_tasks = [
            get_live_data(
                category=parent_category,
                subcategory=subcategory,
                lat=r.get("lat") or lat,
                lng=r.get("lng") or lng,
                website=r.get("website"),
                name=r.get("name"),
                city=r.get("city"),
            )
            for r in fallback_results
        ]
        live_data_results = await asyncio.gather(*live_data_tasks, return_exceptions=True)
        for i, r in enumerate(fallback_results):
            ld = live_data_results[i]
            r["liveData"] = ld if isinstance(ld, dict) else {"type": "none"}
        return fallback_results


# ── Single-place LLM enrichment (for streaming) ─────────────────────────────

async def _llm_enrich_single(r: dict, mood: str, language: str, parent_category: str) -> dict:
    """Enrich a single candidate with LLM — smaller prompt, faster response."""
    label = _category_label(parent_category)
    lang_map = {"es": "Spanish", "en": "English", "fr": "French"}
    target_lang = lang_map.get(language, "Spanish")

    ai_payload = {
        "id": r["place_id"],
        "name": r["name"],
        "reviews": r.get("google_reviews", [])[:15],
        "summary": r.get("review_summary", ""),
    }

    instruction = f"""You are GADO, a brutally honest guide for {label}.
Analyze this ONE place. Be honest about negatives. Output JSON."""

    prompt = f"""Language: {target_lang}. Vibe: {mood}.
Return a JSON object with:
- id, translated_reviews (array containing ALL provided reviews, do not drop any, with author/text (translated)/rating/relative_time),
  tagline, why, pros (2-3), cons (1-2), verdict, tags (3-5).
All text in {target_lang}.

PLACE:
{json.dumps(ai_payload, ensure_ascii=False)}"""

    # Try once, retry once on quota/rate error — always return dict, never raise.
    for attempt in range(2):
        try:
            raw_ai = await _llm(name="enrich_single", instruction=instruction, prompt=prompt)
            parsed = _parse_json(raw_ai)
            if parsed:
                return parsed
            log.warning("[STREAM] LLM returned empty JSON for %s (attempt %d)", r.get("name"), attempt + 1)
        except Exception as e:
            err = str(e)
            log.warning("[STREAM] LLM enrich failed for %s (attempt %d): %s", r.get("name"), attempt + 1, err)
            if attempt == 0 and ("429" in err or "quota" in err.lower() or "exhausted" in err.lower()):
                await asyncio.sleep(3)  # brief backoff before single retry
            else:
                break  # non-quota error → give up immediately

    log.error("[STREAM] LLM enrich gave up for %s — returning empty", r.get("name"))
    return {}  # result is still shown, just without verdicts


def _build_result(r: dict, ai_data: dict, live_data: dict) -> dict:
    """Build a final result dict from a candidate + AI data + live data."""
    translated = ai_data.get("translated_reviews")
    if not isinstance(translated, list):
        translated = r.get("google_reviews")
    if not isinstance(translated, list):
        translated = []

    safe_reviews = []
    for rev in translated[:15]:
        if not isinstance(rev, dict):
            continue
        safe_reviews.append({
            "author": str(rev.get("author", "Anonymous")),
            "rating": int(rev.get("rating") or 0),
            "text": str(rev.get("text") or ""),
            "relative_time": str(rev.get("relative_time") or "n/a"),
        })

    return {
        "id": r["place_id"],
        "name": str(r.get("name") or ""),
        "address": r.get("address", "") or "",
        "website": r.get("website"),
        "city": r.get("city") or _infer_city(r.get("address")),
        "rating": float(r.get("rating") or 0.0),
        "priceLevel": int(r.get("price_level") or 2),
        "photoUrl": r.get("photo_url", "") or "",
        "lat": float(r.get("lat") or 0.0),
        "lng": float(r.get("lng") or 0.0),
        "distanceM": int(r.get("distance_m") or 0),
        "tagline": ai_data.get("tagline") or str(r.get("name") or ""),
        "why": ai_data.get("why") or "",
        "pros": ai_data.get("pros") or [],
        "cons": ai_data.get("cons") or [],
        "verdict": ai_data.get("verdict") or "",
        "reviews": safe_reviews,
        "reviewsCount": int(r.get("total_ratings") or 0),
        "review_count": int(r.get("total_ratings") or 0),
        "bestReviewQuote": ai_data.get("best_quote") or r.get("best_review_quote") or "",
        "reviewQualityScore": float(ai_data.get("quality_score") or r.get("review_quality_score") or 0.5),
        "tags": ai_data.get("tags") or [],
        "liveData": live_data if isinstance(live_data, dict) else {"type": "none"},
    }


# ── Streaming pipeline ──────────────────────────────────────────────────────

async def recommend_stream(
    parent_category: str,
    subcategory: str | None,
    mood: str,
    price_level: int | None,
    lat: float,
    lng: float,
    language: str = "es",
) -> AsyncGenerator[dict, None]:
    """Yield results one by one via SSE as they are enriched."""
    t_total = time.perf_counter()
    resolved_sub = subcategory or parent_category
    label = _category_label(parent_category)
    log.info("[STREAM] START category='%s' mood='%s'", parent_category, mood)

    # Phase 1: Search
    raw = await search_places(parent_category, resolved_sub, lat, lng, price_level, language=language)
    candidates = raw.get("restaurants", [])
    if not candidates:
        yield {"event": "done", "total": 0}
        return

    # Phase 2: Pre-filter
    candidates = _pre_filter(candidates, price_level)
    # IMMEDIATELY YIELD META so UI knows how many are coming
    yield {"event": "meta", "total": len(candidates)}

    # Phase 3+4+5: Process each candidate and yield IMMEDIATELY as each finishes.
    # We use an asyncio.Queue so producers (tasks) and the consumer (this generator)
    # are decoupled — each result is yielded the instant it's ready, no batching.
    result_queue: asyncio.Queue[dict | None] = asyncio.Queue()
    result_index = 0
    total_tasks = len(candidates)

    async def _process_one(r: dict) -> None:
        try:
            # Deep fetch
            try:
                data = await fetch_all_reviews(r["place_id"], r["name"], r["lat"], r["lng"], language=language)
                enriched = {**r, **data}
            except Exception:
                enriched = r

            # LLM enrich
            ai_data = await _llm_enrich_single(enriched, mood, language, parent_category)

            # Live data
            try:
                live = await get_live_data(
                    category=parent_category, subcategory=subcategory,
                    lat=enriched.get("lat") or lat, lng=enriched.get("lng") or lng,
                    website=enriched.get("website"), name=enriched.get("name"),
                    city=enriched.get("city") or _infer_city(enriched.get("address")),
                )
            except Exception:
                live = {"type": "none"}

            await result_queue.put(_build_result(enriched, ai_data, live))
        except Exception as e:
            log.error("[STREAM] Failed processing %s: %s", r.get("name"), e)
            await result_queue.put(None)  # signal this task is done (failed)

    async def _run_all() -> None:
        """Process candidates sequentially — each result arrives as soon as it's
        ready, giving the user a true one-by-one progressive experience."""
        for c in candidates:
            await _process_one(c)

    # Start the producer in the background
    producer = asyncio.ensure_future(_run_all())

    # Consume results as they arrive from the queue
    finished = 0
    while finished < total_tasks:
        item = await result_queue.get()
        finished += 1
        if item is not None:
            result_index += 1
            yield {"event": "result", "index": result_index, "data": item}

    await producer  # ensure cleanup

    total_time = time.perf_counter() - t_total
    log.info("[STREAM] DONE in %.2fs, yielded %d results", total_time, result_index)
    yield {"event": "done", "total": result_index}
