import asyncio
import os
import sys

# Hack to allow imports
sys.path.append(os.path.join(os.path.dirname(__file__), "."))

from services.recommendation.pipeline import recommend
from dotenv import load_dotenv

load_dotenv(".env.production")
load_dotenv(".env")

async def test():
    print("Running recommend...")
    res = await recommend(
        parent_category="nature",
        subcategory="forest",
        mood="dog_friendly",
        price_level=1,
        lat=39.4699,
        lng=-0.3763,
    )
    print(f"Returned {len(res)} places")
    if res:
        print("First place:", res[0].get("name"))

if __name__ == "__main__":
    asyncio.run(test())
