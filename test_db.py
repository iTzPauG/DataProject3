import asyncio
from main.backend.database import init_db

async def test():
    try:
        await init_db()
        print("Success")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test())
