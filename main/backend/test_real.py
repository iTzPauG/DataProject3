import asyncio
from dotenv import load_dotenv
import os

load_dotenv(".env.production")
from services.google_places_service import get_place_details

async def test():
    place_id = "ChIJuZ71xlJPYA0R457gKjvJmLE" # Café de Las Horas
    res = await get_place_details(place_id)
    print("Reviews found:", len(res.get("google_reviews", [])))
    print("Phone:", res.get("phone"))
    print("Rating:", res.get("rating"))
    for r in res.get("google_reviews", []):
        print(f"- {r['rating']}★ : {r['text'][:100]}...")

asyncio.run(test())
