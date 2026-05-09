#!/usr/bin/env python3
"""
Seed 3 cuentas de restaurante de prueba en la BD.
Restaurantes REALES de Valencia con coordenadas reales.

Uso:
    DATABASE_URL=postgresql://... python3 scripts/seed_business_accounts.py
    # Sin DATABASE_URL usa SQLite local (main/backend/temp_local.db)
"""
import asyncio, os, sys, uuid
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../main/backend"))

ACCOUNTS = [
    {
        "firebase_uid": "test-business-1",
        "display_name": "La Pepica",
        "role": "business",
        "restaurant_name": "La Pepica",
        "restaurant_address": "Passeig de Neptú, 2, 46011 Valencia",
        "restaurant_phone": "+34 963 71 03 66",
        "restaurant_place_id": "ChIJa9ZBqHhQYA0RqJBJJJJJJJJ",
        "restaurant_lat": 39.4607,
        "restaurant_lng": -0.3340,
    },
    {
        "firebase_uid": "test-business-2",
        "display_name": "Riff Restaurante",
        "role": "business",
        "restaurant_name": "Riff Restaurante",
        "restaurant_address": "Carrer del Comte d'Altea, 18, 46005 Valencia",
        "restaurant_phone": "+34 963 35 53 53",
        "restaurant_place_id": "ChIJb9ZBqHhQYA0RqJBJJJJJJJK",
        "restaurant_lat": 39.4648,
        "restaurant_lng": -0.3812,
    },
    {
        "firebase_uid": "test-business-3",
        "display_name": "Bar Pilar",
        "role": "business",
        "restaurant_name": "Bar Pilar",
        "restaurant_address": "Carrer del Moro Zeit, 13, 46003 Valencia",
        "restaurant_phone": "+34 963 91 04 97",
        "restaurant_place_id": "ChIJc9ZBqHhQYA0RqJBJJJJJJJL",
        "restaurant_lat": 39.4762,
        "restaurant_lng": -0.3762,
    },
]


async def seed():
    from database import get_db, init_db
    await init_db()

    async with get_db() as db:
        for acc in ACCOUNTS:
            pid = str(uuid.uuid4())
            await db.execute(
                """INSERT INTO profiles
                   (id, firebase_uid, display_name, role,
                    restaurant_name, restaurant_address, restaurant_phone,
                    restaurant_place_id, restaurant_lat, restaurant_lng)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT (firebase_uid) DO UPDATE SET
                   role=excluded.role,
                   restaurant_name=excluded.restaurant_name,
                   restaurant_address=excluded.restaurant_address,
                   restaurant_phone=excluded.restaurant_phone,
                   restaurant_place_id=excluded.restaurant_place_id,
                   restaurant_lat=excluded.restaurant_lat,
                   restaurant_lng=excluded.restaurant_lng""",
                (
                    pid,
                    acc["firebase_uid"],
                    acc["display_name"],
                    acc["role"],
                    acc["restaurant_name"],
                    acc["restaurant_address"],
                    acc["restaurant_phone"],
                    acc["restaurant_place_id"],
                    acc["restaurant_lat"],
                    acc["restaurant_lng"],
                ),
            )
            print(f"  ✓ {acc['restaurant_name']} ({acc['firebase_uid']})")

    print("\nSeed completado.")


if __name__ == "__main__":
    asyncio.run(seed())
