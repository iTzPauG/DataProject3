import asyncio
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv(".env")
load_dotenv(".env.production")

from services.google_places_service import search_places, get_place_details
from services.recommendation.pipeline import (
    _translate_mood,
    _quality_filter_reviews,
    _extract_signals,
    _enrich_one
)

async def run_tests():
    os.environ["GEMINI_MODEL"] = "gemini-3.0-flash"
    print("=== Step 0: Using REAL Google Places Data (Manual) ===")
    place_id = "ChIJ1VbQfU1PYA0RiMq5MxHNr6Q" # San Tommaso
    name = "San Tommaso"
    address = "C/ de la Corretgeria, 37, 46001 València"
    
    # Real reviews fetched from Google (summarized for test)
    reviews = [
        {"author": "John", "rating": 5, "text": "Absolutely incredible Italian food. The carbonara is the best I've ever had. Very busy, so book in advance!"},
        {"author": "Maria", "rating": 5, "text": "Perfect for a romantic dinner. Great wine selection and the truffle pasta was amazing. The atmosphere is very cozy."},
        {"author": "David", "rating": 4, "text": "Great food but it's very loud and tables are packed together. Hard to have a quiet conversation on a weekend night."},
    ]
    
    print(f"Testing with: {name} (ID: {place_id})")
    print(f"Loaded {len(reviews)} real-scenario reviews.")

    # Build the candidate object
    candidate = {
        "place_id": place_id,
        "name": name,
        "address": address,
        "phone": "963 92 07 55",
        "photo_url": "http://example.com/san_tommaso.jpg",
        "rating": 4.4,
        "total_ratings": 12693,
        "price_level": 2,
        "lat": 39.475,
        "lng": -0.377,
        "distance_m": 500,
        "google_reviews": reviews,
        "tripadvisor_reviews": [],
        "yelp_reviews": []
    }
    
    candidates_list = [candidate]
    print("\n" + "="*50 + "\n")

    print("=== Testing Agent 1: Mood Translator ===")
    mood = "date"
    print(f"Input Mood: '{mood}'")
    mood_result = await _translate_mood(mood)
    print("Output:")
    print(json.dumps(mood_result, indent=2))
    print("\n" + "="*50 + "\n")

    print("=== Testing Agent 2: Review Quality Analyst ===")
    quality_result = await _quality_filter_reviews(json.loads(json.dumps(candidates_list)))
    print("Output:")
    print(json.dumps([{
        "name": r["name"],
        "review_quality_score": r.get("review_quality_score"),
        "best_review_quote": r.get("best_review_quote")
    } for r in quality_result], indent=2))
    print("\n" + "="*50 + "\n")

    print("=== Testing Agent 3: Objective Signal Extractor ===")
    signals_result = await _extract_signals(json.loads(json.dumps(candidates_list)))
    print("Output:")
    print(json.dumps(signals_result, indent=2))
    print("\n" + "="*50 + "\n")

    print("=== Testing Agent 4: Honest Copywriter ===")
    enrich_result = await _enrich_one(quality_result[0], signals_result, mood)
    print("Output:")
    print(json.dumps(enrich_result, indent=2, ensure_ascii=False))
    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    asyncio.run(run_tests())
