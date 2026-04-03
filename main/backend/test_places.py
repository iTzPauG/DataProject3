import asyncio
import os
import json
import httpx
from dotenv import load_dotenv

load_dotenv(".env.production")
_BASE = "https://places.googleapis.com/v1"

from config import GOOGLE_MAPS_API_KEY

async def test():
    query = "aparcar gratis en valencia"
    lat, lng = 39.47, -0.37
    
    body = {
        "textQuery": query,
        "locationBias": {
            "circle": {
                "center": {"latitude": lat, "longitude": lng},
                "radius": 5000.0,
            }
        },
        "maxResultCount": 20,
        "languageCode": "es",
    }
    
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
    ])

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": field_mask,
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(f"{_BASE}/places:searchText", json=body, headers=headers)
        print(resp.status_code)
        if resp.status_code != 200:
            print(resp.text)
        else:
            print(json.dumps(resp.json(), indent=2))

asyncio.run(test())