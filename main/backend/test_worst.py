import asyncio
import json
import os
from dotenv import load_dotenv

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
    print("=== Step 1: Testing the Agents with the Absolute Worst Place ===")
    
    place_id = "worst_place_ever"
    rating = 1.2
    
    print(f"\n🏆 TESTING WITH: El Rincón del Desastre")
    print(f"⭐ Rating: {rating} stars (432 reviews)")
    print(f"📍 Address: Plaza de la Indigestión, 13\n")
    
    # 2. Fake terrible reviews
    reviews = [
        {"author": "AngryTourist", "rating": 1, "text": "Absolutely disgusting. The paella was literally just yellow rice with frozen peas and a single sad shrimp. It took them an hour to bring the drinks and the waiter rolled his eyes when we asked for water. AVOID AT ALL COSTS."},
        {"author": "FoodieVal", "rating": 2, "text": "The location is nice, right by the square, but that's the only good thing. The chicken was undercooked and the bathrooms were completely flooded. Way overpriced tourist trap."},
        {"author": "LocalGuy", "rating": 1, "text": "I got food poisoning here last week. The meat tasted like it had been left in the sun for two days. Also, they sneakily added a 'service charge' that wasn't on the menu."},
        {"author": "Optimist", "rating": 1, "text": "I wanted to like this place because the decor is cute, but there were literal cockroaches running under the table. When I told the manager, he just shrugged."},
    ]
    
    print(f"Loaded {len(reviews)} horrific reviews. Let's see the damage:")
    for i, r in enumerate(reviews):
        print(f" Review {i+1} ({r['rating']}★): {r['text'][:150]}...")

    # Build the candidate object
    candidate = {
        "place_id": place_id,
        "name": "El Rincón del Desastre",
        "address": "Plaza de la Indigestión, 13",
        "phone": "963 00 00 00",
        "photo_url": "http://example.com/bad.jpg",
        "rating": rating,
        "total_ratings": 432,
        "price_level": 3, # Overpriced
        "lat": 39.47,
        "lng": -0.37,
        "distance_m": 500,
        "google_reviews": reviews,
        "tripadvisor_reviews": [],
        "yelp_reviews": []
    }
    
    candidates_list = [candidate]
    print("\n" + "="*50 + "\n")

    mood = "casual"
    print(f"=== Testing Agent: Honest Copywriter (Mood: {mood}) ===")
    
    quality_result = await _quality_filter_reviews(json.loads(json.dumps(candidates_list)))
    signals_result = await _extract_signals(json.loads(json.dumps(candidates_list)))
    
    print("\n--- Signals Extracted by AI ---")
    print(json.dumps(signals_result[place_id], indent=2))
    
    print("\n--- Final Honest Copywriter Output ---")
    enrich_result = await _enrich_one(quality_result[0], signals_result, mood)
    print(json.dumps(enrich_result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(run_tests())
