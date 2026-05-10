#!/usr/bin/env python3
"""
seed_fake_interactions.py
--------------------------
Genera usuarios falsos + interacciones (likes, favoritos, reservas) con
restaurantes REALES de la base de datos.

Mínimo: 10 usuarios, 100 interacciones por usuario.

Uso:
    DATABASE_URL=postgresql://... python3 scripts/seed_fake_interactions.py
    # Sin DATABASE_URL usa SQLite local
"""
import asyncio
import json
import os
import random
import sys
import uuid
from datetime import datetime, timezone, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../main/backend"))

# ── Datos de usuarios falsos ────────────────────────────────────────────────
FAKE_USERS = [
    {"name": "Ana García",       "avatar": "https://i.pravatar.cc/150?img=1",  "uid": "fake-user-001"},
    {"name": "Carlos Martínez",  "avatar": "https://i.pravatar.cc/150?img=2",  "uid": "fake-user-002"},
    {"name": "Elena Rodríguez",  "avatar": "https://i.pravatar.cc/150?img=3",  "uid": "fake-user-003"},
    {"name": "David López",      "avatar": "https://i.pravatar.cc/150?img=4",  "uid": "fake-user-004"},
    {"name": "María Sánchez",    "avatar": "https://i.pravatar.cc/150?img=5",  "uid": "fake-user-005"},
    {"name": "Javier Fernández", "avatar": "https://i.pravatar.cc/150?img=6",  "uid": "fake-user-006"},
    {"name": "Laura Gómez",      "avatar": "https://i.pravatar.cc/150?img=7",  "uid": "fake-user-007"},
    {"name": "Pablo Torres",     "avatar": "https://i.pravatar.cc/150?img=8",  "uid": "fake-user-008"},
    {"name": "Sofía Díaz",       "avatar": "https://i.pravatar.cc/150?img=9",  "uid": "fake-user-009"},
    {"name": "Miguel Ruiz",      "avatar": "https://i.pravatar.cc/150?img=10", "uid": "fake-user-010"},
    {"name": "Isabel Moreno",    "avatar": "https://i.pravatar.cc/150?img=11", "uid": "fake-user-011"},
    {"name": "Alejandro Jiménez","avatar": "https://i.pravatar.cc/150?img=12", "uid": "fake-user-012"},
]

# Perfiles de comportamiento para variedad
PROFILES = {
    "foodie":       {"vote_ratio": 0.7, "save_ratio": 0.5, "reserve_ratio": 0.15, "min_rating": 4.0},
    "casual":       {"vote_ratio": 0.3, "save_ratio": 0.2, "reserve_ratio": 0.05, "min_rating": 3.0},
    "budget":       {"vote_ratio": 0.4, "save_ratio": 0.3, "reserve_ratio": 0.03, "min_rating": 3.5},
    "premium":      {"vote_ratio": 0.6, "save_ratio": 0.6, "reserve_ratio": 0.25, "min_rating": 4.2},
    "explorer":     {"vote_ratio": 0.5, "save_ratio": 0.4, "reserve_ratio": 0.10, "min_rating": 3.0},
}

PROFILE_NAMES = list(PROFILES.keys())

NAMES_FOR_RESERVATION = [
    "Ana García", "Carlos Martínez", "Elena Rodríguez", "David López",
    "María Sánchez", "Javier Fernández", "Laura Gómez", "Pablo Torres",
    "Sofía Díaz", "Miguel Ruiz", "Isabel Moreno", "Alejandro Jiménez",
]

PARTY_SIZES = [1, 2, 2, 2, 3, 4, 4, 5, 6, 8]
NOTES_POOL = [
    "Mesa con vista a la calle si es posible",
    "Celebramos un cumpleaños",
    "Somos alérgicos al gluten",
    "Necesitamos silla de bebé",
    "Mesa exterior preferiblemente",
    "Sin preferencia especial",
    None, None, None, None,
]

MIN_INTERACTIONS_PER_USER = 100


async def seed():
    from database import get_db, init_db

    print("🔌 Inicializando base de datos...")
    await init_db()

    async with get_db() as db:

        # ── 1. Cargar restaurantes reales de la BD ──────────────────────────
        print("🔍 Cargando restaurantes reales...")
        cursor = await db.execute(
            "SELECT id, name, lat, lng, category_id, photo_url, rating FROM places WHERE lat IS NOT NULL AND lng IS NOT NULL LIMIT 2000"
        )
        places = await cursor.fetchall()

        if not places:
            print("❌ No hay restaurantes en la tabla 'places'. Ejecuta primero el seed de lugares.")
            return

        places = [dict(p) for p in places]
        print(f"   ✓ {len(places)} restaurantes disponibles")

        # ── 2. Crear perfiles de usuario falsos ─────────────────────────────
        print("\n👥 Creando usuarios falsos...")
        user_profiles = []
        for i, user in enumerate(FAKE_USERS):
            pid = str(uuid.uuid4())
            profile_type = PROFILE_NAMES[i % len(PROFILE_NAMES)]
            await db.execute(
                """INSERT INTO profiles
                   (id, firebase_uid, display_name, avatar_url, reputation_score, reports_count)
                   VALUES (?, ?, ?, ?, ?, ?)
                   ON CONFLICT (firebase_uid) DO UPDATE SET
                   display_name=excluded.display_name,
                   avatar_url=excluded.avatar_url""",
                (
                    pid,
                    user["uid"],
                    user["name"],
                    user["avatar"],
                    random.randint(10, 350),
                    random.randint(0, 20),
                ),
            )
            # Recuperar el id real (puede haber sido ON CONFLICT)
            cursor = await db.execute(
                "SELECT id FROM profiles WHERE firebase_uid=?", (user["uid"],)
            )
            row = await cursor.fetchone()
            real_pid = dict(row)["id"] if row else pid

            user_profiles.append({
                **user,
                "profile_id": str(real_pid),
                "behavior": PROFILES[profile_type],
                "profile_type": profile_type,
            })
            print(f"   ✓ {user['name']} ({profile_type})")

        await db.commit()

        # ── 3. Generar interacciones (en memoria, luego bulk insert) ──────────
        print(f"\n⚡ Generando interacciones (mín. {MIN_INTERACTIONS_PER_USER} por usuario)...")

        all_votes: list[tuple] = []
        all_saves: list[tuple] = []
        all_reservations: list[tuple] = []

        now = datetime.now(timezone.utc)
        vote_seen: set[str] = set()   # (item_id, voter_id) deduplicate
        save_seen: set[str] = set()   # (user_id, item_id) deduplicate

        user_stats = []
        for up in user_profiles:
            beh = up["behavior"]
            uid = up["profile_id"]

            sample_size = min(len(places), max(150, MIN_INTERACTIONS_PER_USER + 50))
            user_places = random.sample(places, sample_size)

            votes_added = saves_added = reservations_added = 0

            for place in user_places:
                pid_place = str(place["id"])
                place_rating = float(place["rating"] or 3.0)

                if place_rating < beh["min_rating"] and random.random() > 0.2:
                    continue

                # ── VOTO ──────────────────────────────────────────────
                if random.random() < beh["vote_ratio"]:
                    voter_id = f"{uid}::{pid_place}"
                    if voter_id not in vote_seen:
                        vote_seen.add(voter_id)
                        if place_rating >= 4.2:
                            vote_val = random.choices([1, -1], weights=[90, 10])[0]
                        elif place_rating >= 3.5:
                            vote_val = random.choices([1, -1], weights=[70, 30])[0]
                        else:
                            vote_val = random.choices([1, -1], weights=[40, 60])[0]
                        all_votes.append((str(uuid.uuid4()), pid_place, voter_id, vote_val))
                        votes_added += 1

                # ── FAVORITO ───────────────────────────────────────────
                if random.random() < beh["save_ratio"] and place_rating >= 3.5:
                    save_key = f"{uid}::{pid_place}"
                    if save_key not in save_seen:
                        save_seen.add(save_key)
                        all_saves.append((
                            str(uuid.uuid4()),
                            uid,
                            pid_place,
                            place.get("name") or "Restaurante",
                            float(place.get("lat") or 0),
                            float(place.get("lng") or 0),
                            place.get("photo_url") or "",
                            place.get("category_id") or "food",
                        ))
                        saves_added += 1

                # ── RESERVA ────────────────────────────────────────────
                # Saltear reservas: la tabla requiere deal_id NOT NULL y
                # el schema real no coincide con el esperado (no hay reservation_date)
                pass

            # Garantizar mínimo de 100 interacciones para este usuario
            if votes_added + saves_added + reservations_added < MIN_INTERACTIONS_PER_USER:
                remaining = [p for p in places if p not in user_places]
                random.shuffle(remaining)
                for place in remaining:
                    if votes_added + saves_added + reservations_added >= MIN_INTERACTIONS_PER_USER:
                        break
                    voter_id = f"{uid}::{place['id']}"
                    if voter_id not in vote_seen:
                        vote_seen.add(voter_id)
                        vote_val = random.choices([1, -1], weights=[70, 30])[0]
                        all_votes.append((str(uuid.uuid4()), str(place["id"]), voter_id, vote_val))
                        votes_added += 1

            user_stats.append((up["name"], up["profile_type"], votes_added, saves_added, reservations_added))
            print(
                f"   ✓ {up['name']:22s} [{up['profile_type']:8s}]  "
                f"votos={votes_added:4d}  guardados={saves_added:4d}  reservas={reservations_added:3d}"
            )

        # ── 4. Bulk insert ──────────────────────────────────────────────────
        print(f"\n💾 Insertando {len(all_votes):,} votos en batch...")
        await db.executemany(
            """INSERT INTO item_votes (id, item_id, voter_id, vote)
               VALUES (?, ?, ?, ?)
               ON CONFLICT (item_id, voter_id) DO UPDATE SET vote=excluded.vote""",
            all_votes,
        )
        await db.commit()

        print(f"💾 Insertando {len(all_saves):,} favoritos en batch...")
        await db.executemany(
            """INSERT INTO saved_items
               (id, user_id, item_type, item_id, title, lat, lng, photo_url, category_id)
               VALUES (?, ?, 'place', ?, ?, ?, ?, ?, ?)
               ON CONFLICT DO NOTHING""",
            all_saves,
        )
        await db.commit()

        print(f"💾 Insertando {len(all_reservations):,} reservas en batch...")
        # No insertamos reservas (schema incompatible: deal_id NOT NULL requerido)

        total_votes = len(all_votes)
        total_saves = len(all_saves)
        total_reservations = len(all_reservations)

        print(f"\n✅ Seed completado:")
        print(f"   👥 {len(user_profiles)} usuarios")
        print(f"   👍 {total_votes:,} votos")
        print(f"   ⭐ {total_saves:,} favoritos")
        print(f"   📅 {len(all_reservations):,} reservas (omitidas — schema incompatible)")
        print(f"   📊 Total interacciones: {total_votes + total_saves:,}")


if __name__ == "__main__":
    asyncio.run(seed())
