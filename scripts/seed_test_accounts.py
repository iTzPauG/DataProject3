#!/usr/bin/env python3
"""
Crea dos cuentas de prueba en Firebase Auth y les asigna el rol correcto en Cloud SQL.

Cuentas creadas:
  - Restaurante: restaurante@gado.test / Gado1234!  (role=business)
  - Usuario:     usuario@gado.test    / Gado1234!  (role=user)

Uso:
  cd main/backend
  python ../../scripts/seed_test_accounts.py
"""
import asyncio
import os
import sys
from pathlib import Path

# Cargar .env del backend
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "main" / "backend"))
from config import FIREBASE_CREDENTIALS_PATH, DATABASE_URL  # noqa: E402

import firebase_admin
from firebase_admin import auth, credentials
import asyncpg

ACCOUNTS = [
    {"email": "restaurante@gado.test", "password": "Gado1234!", "display_name": "Restaurante Demo", "role": "business"},
    {"email": "usuario@gado.test",     "password": "Gado1234!", "display_name": "Usuario Demo",     "role": "user"},
]


def _init_firebase():
    if not firebase_admin._apps:
        cred = credentials.Certificate(FIREBASE_CREDENTIALS_PATH) if FIREBASE_CREDENTIALS_PATH else credentials.ApplicationDefault()
        firebase_admin.initialize_app(cred)


def _get_or_create_firebase_user(email: str, password: str, display_name: str) -> str:
    try:
        user = auth.get_user_by_email(email)
        print(f"  [Firebase] Ya existe: {email} → uid={user.uid}")
        return user.uid
    except auth.UserNotFoundError:
        user = auth.create_user(email=email, password=password, display_name=display_name)
        print(f"  [Firebase] Creado: {email} → uid={user.uid}")
        return user.uid


async def _upsert_profile(conn, uid: str, display_name: str, role: str):
    await conn.execute(
        """
        INSERT INTO profiles (firebase_uid, display_name, role)
        VALUES ($1, $2, $3)
        ON CONFLICT (firebase_uid) DO UPDATE
          SET display_name = EXCLUDED.display_name,
              role         = EXCLUDED.role,
              updated_at   = now()
        """,
        uid, display_name, role,
    )
    print(f"  [DB] Perfil upserted: uid={uid}, role={role}")


async def main():
    _init_firebase()
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        for acc in ACCOUNTS:
            print(f"\n→ {acc['email']} ({acc['role']})")
            uid = _get_or_create_firebase_user(acc["email"], acc["password"], acc["display_name"])
            await _upsert_profile(conn, uid, acc["display_name"], acc["role"])
    finally:
        await conn.close()

    print("\n✅ Cuentas listas:")
    for acc in ACCOUNTS:
        print(f"   {acc['role']:10s}  {acc['email']}  /  {acc['password']}")


if __name__ == "__main__":
    asyncio.run(main())
