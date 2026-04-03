import asyncio
import json
import os
from dotenv import load_dotenv

# Load environment variables from .env if present
load_dotenv(".env")
load_dotenv(".env.production")

from services.recommendation.pipeline import (
    _translate_mood,
    _quality_filter_reviews,
    _extract_signals,
    _enrich_one
)

# Mock data with realistic reviews to test the agents
candidates_with_reviews = [
    {
        "place_id": "test_place_1",
        "name": "La Trattoria del Sol",
        "address": "Calle Falsa 123",
        "phone": "+34 123 456 789",
        "photo_url": "http://example.com/photo.jpg",
        "rating": 4.5,
        "total_ratings": 120,
        "price_level": 2,
        "lat": 39.46,
        "lng": -0.37,
        "distance_m": 1500,
        "google_reviews": [
            {"author": "Alice", "rating": 5, "text": "The homemade pasta was incredible. The truffle ravioli changed my life. Service was a bit slow though."},
            {"author": "Bob", "rating": 4, "text": "Very romantic atmosphere, perfect for our anniversary. The wine selection is great. Tables are a bit too close together."},
            {"author": "Charlie", "rating": 3, "text": "Good food but very noisy on a Friday night. Waited 30 minutes for our table despite having a reservation."}
        ],
        "tripadvisor_reviews": [],
        "yelp_reviews": []
    }
]

async def run_tests():
    print("=== Testing Agent 1: Mood Translator ===")
    mood = "date"
    print(f"Input Mood: '{mood}'")
    mood_result = await _translate_mood(mood)
    print("Output:")
    print(json.dumps(mood_result, indent=2))
    print("\n" + "="*50 + "\n")

    print("=== Testing Agent 2: Review Quality Analyst ===")
    # Copy candidates to avoid mutating the original
    candidates_copy = json.loads(json.dumps(candidates_with_reviews))
    quality_result = await _quality_filter_reviews(candidates_copy)
    print("Output:")
    print(json.dumps([{
        "name": r["name"],
        "review_quality_score": r.get("review_quality_score"),
        "best_review_quote": r.get("best_review_quote")
    } for r in quality_result], indent=2))
    print("\n" + "="*50 + "\n")

    print("=== Testing Agent 3: Objective Signal Extractor ===")
    signals_result = await _extract_signals(candidates_copy)
    print("Output:")
    print(json.dumps(signals_result, indent=2))
    print("\n" + "="*50 + "\n")

    print("=== Testing Agent 4: Honest Copywriter ===")
    enrich_result = await _enrich_one(candidates_copy[0], signals_result, mood)
    print("Output:")
    print(json.dumps(enrich_result, indent=2, ensure_ascii=False))
    print("\n" + "="*50 + "\n")

if __name__ == "__main__":
    asyncio.run(run_tests())
