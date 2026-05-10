#!/usr/bin/env python3
"""
seed_firebase_users.py
-----------------------
Crea los 12 usuarios fake en Firebase Authentication y actualiza
profiles.firebase_uid en las 3 bases de datos Cloud SQL.

Idempotente: si el usuario ya existe en Firebase Auth, reutiliza su UID.

Uso:
    python3 scripts/seed_firebase_users.py

Requiere:
    - Application Default Credentials (gcloud auth application-default login)
    - Cloud SQL Proxy corriendo en puertos 5442, 5443, 5444
    - .venv con firebase-admin y asyncpg instalados
"""

import asyncio
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../main/backend"))

import firebase_admin
from firebase_admin import auth, credentials

# ── Usuarios fake ─────────────────────────────────────────────────────────────

FAKE_USERS = [
    {"uid_fake": "fake-user-001", "name": "Ana García",        "email": "ana.garcia@gado-test.com"},
    {"uid_fake": "fake-user-002", "name": "Carlos Martínez",   "email": "carlos.martinez@gado-test.com"},
    {"uid_fake": "fake-user-003", "name": "Elena Rodríguez",   "email": "elena.rodriguez@gado-test.com"},
    {"uid_fake": "fake-user-004", "name": "David López",       "email": "david.lopez@gado-test.com"},
    {"uid_fake": "fake-user-005", "name": "María Sánchez",     "email": "maria.sanchez@gado-test.com"},
    {"uid_fake": "fake-user-006", "name": "Javier Fernández",  "email": "javier.fernandez@gado-test.com"},
    {"uid_fake": "fake-user-007", "name": "Laura Gómez",       "email": "laura.gomez@gado-test.com"},
    {"uid_fake": "fake-user-008", "name": "Pablo Torres",      "email": "pablo.torres@gado-test.com"},
    {"uid_fake": "fake-user-009", "name": "Sofía Díaz",        "email": "sofia.diaz@gado-test.com"},
    {"uid_fake": "fake-user-010", "name": "Miguel Ruiz",       "email": "miguel.ruiz@gado-test.com"},
    {"uid_fake": "fake-user-011", "name": "Isabel Moreno",     "email": "isabel.moreno@gado-test.com"},
    {"uid_fake": "fake-user-012", "name": "Alejandro Jiménez", "email": "alejandro.jimenez@gado-test.com"},
]

PASSWORD = "Gado2026!"

# ── Cloud SQL enviroments ─────────────────────────────────────────────────────

ENVIRONMENTS = [
    {"name": "dev-data", "url": "postgresql://gado_app:0uvl8wHx2ZdUWozrnBAxeoLEvYNBOKaz@127.0.0.1:5442/gado"},
    {"name": "dev-ia",   "url": "postgresql://gado_app:jzGeMtejmO19mRZvr5Afa1D7rn4vq21O@127.0.0.1:5443/gado"},
    {"name": "main",     "url": "postgresql://gado_app:Q0onKztFqruLfbCYfTw3RErr0SgQYpGU@127.0.0.1:5444/gado"},
]


def init_firebase():
    if firebase_admin._apps:
        return
    # Usa Application Default Credentials (gcloud auth application-default login)
    firebase_admin.initialize_app(credentials.ApplicationDefault())


def get_or_create_firebase_user(user: dict) -> str:
    """Crea el usuario en Firebase Auth o devuelve el UID si ya existe."""
    email = user["email"]
    name = user["name"]
    try:
        fb_user = auth.get_user_by_email(email)
        print(f"   ↩ Ya existe: {email} → {fb_user.uid}")
        return fb_user.uid
    except auth.UserNotFoundError:
        fb_user = auth.create_user(
            email=email,
            password=PASSWORD,
            display_name=name,
            email_verified=False,
        )
        print(f"   ✓ Creado:    {email} → {fb_user.uid}")
        return fb_user.uid


async def update_profiles_in_db(env: dict, uid_map: dict[str, str]):
    """Actualiza firebase_uid en profiles para todos los usuarios fake."""
    import asyncpg
    conn = await asyncpg.connect(env["url"])
    try:
        updated = 0
        for uid_fake, uid_real in uid_map.items():
            result = await conn.execute(
                "UPDATE profiles SET firebase_uid = $1 WHERE firebase_uid = $2",
                uid_real, uid_fake,
            )
            count = int(result.split()[-1])
            updated += count
        print(f"   ✓ {env['name']}: {updated} perfiles actualizados")
    finally:
        await conn.close()


async def main():
    print("🔥 Inicializando Firebase Admin...")
    init_firebase()

    # ── 1. Crear usuarios en Firebase Auth ────────────────────────────────────
    print("\n👤 Creando usuarios en Firebase Authentication...")
    uid_map: dict[str, str] = {}  # fake_uid → real_uid
    for user in FAKE_USERS:
        real_uid = get_or_create_firebase_user(user)
        uid_map[user["uid_fake"]] = real_uid

    # ── 2. Actualizar profiles.firebase_uid en las 3 BBDDs ────────────────────
    print("\n🗄️  Actualizando perfiles en Cloud SQL...")
    for env in ENVIRONMENTS:
        try:
            await update_profiles_in_db(env, uid_map)
        except Exception as e:
            print(f"   ⚠ {env['name']}: ERROR — {e}")

    # ── 3. Resumen ────────────────────────────────────────────────────────────
    print("\n✅ Usuarios listos:")
    print(f"   {'Nombre':25s}  {'Email':38s}  {'UID Firebase'}")
    print(f"   {'-'*25}  {'-'*38}  {'-'*28}")
    for user in FAKE_USERS:
        real_uid = uid_map[user["uid_fake"]]
        print(f"   {user['name']:25s}  {user['email']:38s}  {real_uid}")
    print(f"\n   🔑 Contraseña de todos: {PASSWORD}")


if __name__ == "__main__":
    asyncio.run(main())
