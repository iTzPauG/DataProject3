"""Database compatibility layer for SQLite local dev and Cloud SQL Postgres."""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from typing import Any, AsyncGenerator, Iterable, Sequence
from urllib.parse import parse_qs, unquote, urlparse

import aiosqlite

from config import DATABASE_URL

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None


logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DATABASE_PATH", "temp_local.db")
USE_POSTGRES = bool(DATABASE_URL)


# ============================================================================
# SEED DATA CONSTANTS
# ============================================================================

CATEGORY_SEED = [
    ("food", "Comida y bebida", "🍴", "#FF6B35", 1),
    ("nightlife", "Ocio nocturno", "🌙", "#3B82F6", 2),
    ("shopping", "Compras", "🛒", "#10B981", 3),
    ("transport", "Transporte", "🚌", "#64748B", 4),
    ("health", "Salud y farmacia", "💊", "#EF4444", 4),
    ("nature", "Naturaleza", "🌿", "#22C55E", 6),
    ("culture", "Cultura y ocio", "🎭", "#F59E0B", 7),
    ("services", "Servicios", "🛠️", "#94A3B8", 8),
    ("sport", "Deporte", "⚽", "#0EA5E9", 9),
    ("education", "Educación", "📚", "#8B5CF6", 10),
    ("event", "Eventos", "🎉", "#EC4899", 11),
    ("market", "Mercados", "🏪", "#F97316", 12),
    ("music", "Música en vivo", "🎵", "#A855F7", 13),
    ("report", "Reportes en vivo", "📢", "#EF4444", 14),
    ("wellness", "Bienestar", "🧖", "#8B5CF6", 15),
    ("coworking", "Coworking", "🏢", "#6366F1", 16),
    ("pets", "Mascotas", "🐾", "#F59E0B", 17),
    ("automotive", "Vehiculo", "🚗", "#64748B", 18),
    ("cinema", "Cine", "🎬", "#EC4899", 19),
]

REPORT_TYPE_SEED = [
    ("traffic", "Tráfico cortado", "🚧", "#FF4444", 2, 1),
    ("accident", "Accidente", "💥", "#FF4444", 3, 2),
    ("police", "Control policial", "👮", "#3B82F6", 2, 3),
    ("queue", "Cola larga", "👥", "#F59E0B", 1, 4),
    ("popup_market", "Mercadillo", "🏪", "#10B981", 6, 5),
    ("food_truck", "Food truck", "🚚", "#FF6B35", 4, 6),
    ("live_music", "Música en vivo", "🎸", "#8B5CF6", 4, 7),
    ("street_show", "Espectáculo calle", "🎭", "#EC4899", 3, 8),
    ("free_stuff", "Cosa gratis", "🎁", "#22C55E", 2, 9),
    ("road_closure", "Corte de calle", "🚫", "#EF4444", 4, 10),
    ("parking_free", "Parking libre", "🅿️", "#0EA5E9", 2, 11),
    ("protest", "Manifestación", "✊", "#F97316", 3, 12),
    ("construction", "Obras", "👷", "#94A3B8", 48, 13),
    ("other", "Otro", "📍", "#6366F1", 3, 14),
]

CATEGORY_SUBCATEGORY_SEED = [
    ("pizza", "food", "Pizza", "🍕", 1),
    ("hamburger", "food", "Hamburguesas", "🍔", 2),
    ("sushi", "food", "Sushi", "🍣", 3),
    ("paella", "food", "Paella", "🥘", 4),
    ("tacos", "food", "Tacos", "🌮", 5),
    ("healthy", "food", "Healthy", "🥗", 6),
    ("vegan", "food", "Vegan", "🌱", 7),
    ("italian", "food", "Italiano", "🍝", 8),
    ("asian", "food", "Asiático", "🍜", 9),
    ("bar", "nightlife", "Bar", "🍻", 1),
    ("club", "nightlife", "Discoteca", "🕺", 2),
    ("pub", "nightlife", "Pub", "🍺", 3),
    ("cocktail", "nightlife", "Cócteles", "🍸", 4),
    ("lounge", "nightlife", "Lounge", "🛋️", 5),
    ("clothes", "shopping", "Ropa", "👗", 1),
    ("shoes", "shopping", "Zapatos", "👞", 2),
    ("electronics", "shopping", "Electrónica", "💻", 3),
    ("supermarket", "shopping", "Supermercado", "🛒", 4),
    ("mall", "shopping", "Centro comercial", "🏬", 5),
    ("bus", "transport", "Autobús", "🚌", 1),
    ("metro", "transport", "Metro", "🚇", 2),
    ("taxi", "transport", "Taxi", "🚕", 3),
    ("bike", "transport", "Bici", "🚲", 4),
    ("train", "transport", "Tren", "🚆", 5),
    ("parking", "transport", "Parking", "🅿️", 6),
    ("pharmacy", "health", "Farmacia", "💊", 1),
    ("hospital", "health", "Hospital", "🏥", 2),
    ("clinic", "health", "Clínica", "⚕️", 3),
    ("dentist", "health", "Dentista", "🦷", 4),
    ("park", "nature", "Parque", "🌲", 1),
    ("beach", "nature", "Playa", "🏖️", 2),
    ("hiking", "nature", "Senderismo", "🥾", 3),
    ("garden", "nature", "Jardín", "🌺", 4),
    ("museum", "culture", "Museo", "🏛️", 1),
    ("gallery", "culture", "Galería", "🖼️", 2),
    ("theater", "culture", "Teatro", "🎭", 3),
    ("library", "culture", "Biblioteca", "📚", 4),
    ("bank", "services", "Banco", "🏦", 1),
    ("post_office", "services", "Correos", "📮", 2),
    ("salon", "services", "Peluquería", "✂️", 3),
    ("gym", "services", "Gimnasio", "🏋️", 4),
    ("football", "sport", "Fútbol", "⚽", 1),
    ("basketball", "sport", "Baloncesto", "🏀", 2),
    ("tennis", "sport", "Tenis", "🎾", 3),
    ("pool", "sport", "Piscina", "🏊", 4),
    ("public_school", "education", "Público", "🏛️", 1),
    ("private_school", "education", "Privado", "🏫", 2),
    ("concerted_school", "education", "Concertado", "🤝", 3),
    ("special_education", "education", "Especial", "⭐", 4),
    ("university", "education", "Universidad", "🎓", 5),
    ("vocational_training", "education", "FP", "🛠️", 6),
    ("movies", "cinema", "Películas", "🍿", 1),
    ("indie", "cinema", "Cine indie", "📽️", 2),
    ("imax", "cinema", "IMAX", "🎬", 3),
    ("live", "music", "Música en vivo", "🎵", 1),
    ("concert", "music", "Concierto", "🎤", 2),
    ("festival", "music", "Festival", "🎪", 3),
    ("fair", "market", "Feria", "🎪", 1),
    ("farmers_market", "market", "Mercado local", "🥕", 2),
    ("popup", "event", "Pop-up", "✨", 1),
    ("community", "event", "Comunidad", "🤝", 2),
]

CATEGORY_MOOD_SEED = [
    ("quick", "food", "Algo rápido", "⚡", 1),
    ("casual", "food", "Informal", "😊", 2),
    ("date", "food", "Cita", "❤️", 3),
    ("family", "food", "Familiar", "👨‍👩‍👧", 4),
    ("celebration", "food", "Celebración", "🎉", 5),
    ("tapas", "food", "Tapas", "🥂", 6),
    ("chill", "nightlife", "Tranquilo", "🍷", 1),
    ("party", "nightlife", "Fiesta", "💃", 2),
    ("friends", "nightlife", "Con amigos", "🍻", 3),
    ("music", "nightlife", "Música", "🎸", 4),
    ("window", "shopping", "Mirar", "👀", 1),
    ("gifts", "shopping", "Regalos", "🎁", 2),
    ("sale", "shopping", "Ofertas", "🏷️", 3),
    ("luxury", "shopping", "Lujo", "💎", 4),
    ("fast", "transport", "El más rápido", "🚀", 1),
    ("cheap", "transport", "Económico", "💰", 2),
    ("eco", "transport", "Ecológico", "🌱", 3),
    ("comfort", "transport", "Cómodo", "🛋️", 4),
    ("urgent", "health", "Urgente", "🚨", 1),
    ("routine", "health", "Rutina", "📅", 2),
    ("specialist", "health", "Especialista", "👨‍⚕️", 3),
    ("relax", "nature", "Relajante", "🧘", 1),
    ("active", "nature", "Activo", "🏃", 2),
    ("view", "nature", "Vistas", "📸", 3),
    ("learn", "culture", "Aprender", "🧠", 1),
    ("art", "culture", "Arte", "🎨", 2),
    ("history", "culture", "Historia", "🏛️", 3),
    ("quality", "services", "Calidad", "⭐", 1),
    ("cheap_services", "services", "Económico", "💰", 2),
    ("intense", "sport", "Intenso", "🔥", 1),
    ("fun", "sport", "Divertido", "😆", 2),
    ("team", "sport", "En equipo", "🤝", 3),
    ("infant_primary", "education", "Infantil / Primaria", "🧒", 1),
    ("secondary_baccalaureate", "education", "ESO / Bachillerato", "📘", 2),
    ("vocational_path", "education", "FP media / superior", "🛠️", 3),
    ("university_path", "education", "Grado / Máster", "🎓", 4),
    ("special_support", "education", "Apoyo específico", "🫶", 5),
    ("bilingual_languages", "education", "Bilingüe / Idiomas", "🗣️", 6),
    ("action", "cinema", "Acción", "💥", 1),
    ("comedy", "cinema", "Comedia", "😂", 2),
    ("drama", "cinema", "Drama", "🎭", 3),
    ("discover", "event", "Descubrir", "✨", 1),
    ("weekend", "event", "Fin de semana", "🎉", 2),
    ("local", "market", "Local", "🥬", 1),
    ("deal", "market", "Gangas", "💸", 2),
    ("live_vibe", "music", "En vivo", "🎶", 1),
]

EDUCATION_SUBCATEGORY_SEED = [
    ("public_school", "education", "Público", "🏛️", 1),
    ("private_school", "education", "Privado", "🏫", 2),
    ("concerted_school", "education", "Concertado", "🤝", 3),
    ("special_education", "education", "Especial", "⭐", 4),
]

EDUCATION_MOOD_SEED = [
    ("infant_primary", "education", "Infantil / Primaria", "🧒", 1),
    ("secondary_baccalaureate", "education", "ESO / Bachillerato", "📘", 2),
    ("vocational_path", "education", "FP media / superior", "🛠️", 3),
    ("university_path", "education", "Grado / Máster", "🎓", 4),
    ("special_support", "education", "Apoyo específico", "🫶", 5),
    ("bilingual_languages", "education", "Bilingüe / Idiomas", "🗣️", 6),
]


# ============================================================================
# UNIFIED SCHEMA - Uses same structure for Postgres and SQLite (adapted dynamically)
# ============================================================================

SCHEMA_STATEMENTS = [
    # Core tables
    """
    CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        description TEXT,
        has_price INTEGER DEFAULT 1,
        search_mode TEXT DEFAULT 'guided_ranked',
        default_radius_m INTEGER DEFAULT 5000,
        fallback_radius_m INTEGER DEFAULT 25000,
        provider_types TEXT DEFAULT '[]',
        sort_order INTEGER,
        is_active INTEGER DEFAULT 1
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS places (
        id TEXT PRIMARY KEY,
        external_id TEXT,
        osm_id TEXT,
        osm_type TEXT,
        source TEXT DEFAULT 'manual',
        category_id TEXT NOT NULL,
        subcategory TEXT,
        amenity TEXT,
        name TEXT NOT NULL,
        description TEXT,
        address TEXT,
        phone TEXT,
        website TEXT,
        photo_url TEXT,
        rating DOUBLE PRECISION,
        price_level INTEGER,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        tags TEXT,
        opening_hours TEXT,
        metadata TEXT,
        is_verified INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source, external_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        category_id TEXT NOT NULL,
        subcategory TEXT,
        title TEXT NOT NULL,
        description TEXT,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        address TEXT,
        photo_url TEXT,
        starts_at TEXT NOT NULL,
        ends_at TEXT,
        price_info TEXT,
        metadata TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS community_reports (
        id TEXT PRIMARY KEY,
        created_by TEXT,
        anon_fingerprint TEXT,
        report_type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        address_hint TEXT,
        photo_urls TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        confirmations INTEGER DEFAULT 0,
        denials INTEGER DEFAULT 0,
        confidence DOUBLE PRECISION DEFAULT 0.5
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        firebase_uid TEXT UNIQUE,
        display_name TEXT,
        avatar_url TEXT,
        restaurant_photo_url TEXT,
        anon_fingerprint TEXT UNIQUE,
        reputation_score INTEGER DEFAULT 0,
        reports_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS saved_items (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, item_type, item_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS item_votes (
        id TEXT PRIMARY KEY,
        item_id TEXT NOT NULL,
        voter_id TEXT NOT NULL,
        vote INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (item_id, voter_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        default_radius_m INTEGER DEFAULT 2000,
        favorite_cats TEXT DEFAULT '[]',
        map_style TEXT DEFAULT 'standard',
        map_minimal INTEGER DEFAULT 0,
        map_preset TEXT DEFAULT 'classic',
        gado_overlay_on INTEGER DEFAULT 1,
        notifications_on INTEGER DEFAULT 1,
        language TEXT DEFAULT 'es',
        theme TEXT DEFAULT 'system',
        show_real_time_events INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS category_subcategories (
        id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        label TEXT NOT NULL,
        icon TEXT,
        metadata TEXT,
        sort_order INTEGER,
        is_active INTEGER DEFAULT 1,
        PRIMARY KEY (category_id, id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS category_moods (
        id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        label TEXT NOT NULL,
        icon TEXT,
        metadata TEXT,
        sort_order INTEGER,
        is_active INTEGER DEFAULT 1,
        PRIMARY KEY (category_id, id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS report_confirmations (
        id TEXT PRIMARY KEY,
        report_id TEXT NOT NULL,
        user_id TEXT,
        anon_fingerprint TEXT,
        actor_key TEXT NOT NULL,
        vote INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(report_id, actor_key)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS report_types (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        icon TEXT,
        color TEXT,
        duration_h INTEGER DEFAULT 2,
        sort_order INTEGER,
        is_active INTEGER DEFAULT 1
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS reservations (
        id TEXT PRIMARY KEY,
        deal_id TEXT,
        restaurant_id TEXT NOT NULL,
        user_id TEXT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT,
        reservation_date TIMESTAMPTZ NOT NULL,
        party_size INTEGER NOT NULL,
        notes TEXT,
        status TEXT DEFAULT 'confirmed',
        status_reason TEXT,
        status_updated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS deals (
        id TEXT PRIMARY KEY,
        owner_uid TEXT NOT NULL,
        restaurant_id TEXT NOT NULL,
        restaurant_name TEXT NOT NULL,
        restaurant_place_id TEXT,
        lat REAL NOT NULL,
        lng REAL NOT NULL,
        price REAL NOT NULL,
        original_price REAL,
        seats INTEGER NOT NULL,
        cuisine TEXT NOT NULL DEFAULT 'general',
        restaurant_cuisines TEXT DEFAULT '[]',
        available_at TEXT NOT NULL,
        reservation_deadline_at TIMESTAMPTZ,
        description TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        expires_at TEXT
    )
    """,
    # ALTER TABLE statements
    """ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user' """,
    """ALTER TABLE profiles ADD COLUMN IF NOT EXISTS restaurant_name TEXT """,
    """ALTER TABLE profiles ADD COLUMN IF NOT EXISTS restaurant_address TEXT """,
    """ALTER TABLE profiles ADD COLUMN IF NOT EXISTS restaurant_phone TEXT """,
    """ALTER TABLE profiles ADD COLUMN IF NOT EXISTS restaurant_place_id TEXT """,
    """ALTER TABLE profiles ADD COLUMN IF NOT EXISTS restaurant_lat REAL """,
    """ALTER TABLE profiles ADD COLUMN IF NOT EXISTS restaurant_lng REAL """,
    """ALTER TABLE profiles ADD COLUMN IF NOT EXISTS restaurant_cuisines TEXT DEFAULT '[]' """,
    """ALTER TABLE profiles ADD COLUMN IF NOT EXISTS restaurant_photo_url TEXT """,
    """ALTER TABLE deals ADD COLUMN IF NOT EXISTS is_active INTEGER DEFAULT 1 """,
    """ALTER TABLE deals ADD COLUMN IF NOT EXISTS cancellation_reason TEXT """,
    """ALTER TABLE deals ADD COLUMN IF NOT EXISTS cancelled_at TEXT """,
    """ALTER TABLE deals ADD COLUMN IF NOT EXISTS not_presented_at TEXT """,
    """ALTER TABLE reservations ADD COLUMN IF NOT EXISTS status_reason TEXT """,
    """ALTER TABLE reservations ADD COLUMN IF NOT EXISTS status_updated_at TEXT """,
    # Indexes
    """CREATE INDEX IF NOT EXISTS idx_deals_active ON deals(is_active, available_at) """,
    """CREATE INDEX IF NOT EXISTS idx_deals_owner ON deals(owner_uid) """,
    """CREATE INDEX IF NOT EXISTS idx_reservations_deal ON reservations(deal_id, status) """,
]

# SQLite-specific column additions (handle separately due to missing ADD COLUMN IF NOT EXISTS)
SQLITE_PROFILE_COLUMNS = [
    ("role", "TEXT NOT NULL DEFAULT 'user'"),
    ("restaurant_name", "TEXT"),
    ("restaurant_address", "TEXT"),
    ("restaurant_phone", "TEXT"),
    ("restaurant_place_id", "TEXT"),
    ("restaurant_lat", "REAL"),
    ("restaurant_lng", "REAL"),
    ("restaurant_cuisines", "TEXT DEFAULT '[]'"),
    ("restaurant_photo_url", "TEXT"),
]

SQLITE_DEALS_COLUMNS = [
    ("is_active", "INTEGER DEFAULT 1"),
    ("cancellation_reason", "TEXT"),
    ("cancelled_at", "TEXT"),
    ("not_presented_at", "TEXT"),
]

SQLITE_RESERVATIONS_COLUMNS = [
    ("status_reason", "TEXT"),
    ("status_updated_at", "TEXT"),
]


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def using_postgres() -> bool:
    """Check if using Postgres backend."""
    return USE_POSTGRES


def _postgres_connect_kwargs() -> dict[str, Any]:
    """Parse DATABASE_URL and return asyncpg connection kwargs."""
    parsed = urlparse(DATABASE_URL)
    query = parse_qs(parsed.query)
    host = query.get("host", [parsed.hostname or "localhost"])[0]
    database = parsed.path.lstrip("/") or "postgres"
    return {
        "user": unquote(parsed.username) if parsed.username else None,
        "password": unquote(parsed.password) if parsed.password else None,
        "database": database,
        "host": host,
        "port": parsed.port or 5432,
    }


async def _postgres_connect():
    """Create asyncpg connection to Postgres."""
    if asyncpg is None:
        raise RuntimeError("DATABASE_URL is set but asyncpg is not installed")
    kwargs = _postgres_connect_kwargs()
    return await asyncpg.connect(**kwargs)


def _translate_sql(sql: str) -> str:
    """Convert SQLite ? placeholders to Postgres $N format."""
    parts: list[str] = []
    index = 1
    for char in sql:
        if char == "?":
            parts.append(f"${index}")
            index += 1
        else:
            parts.append(char)
    return "".join(parts)


def _is_read_query(sql: str) -> bool:
    """Check if SQL is a read-only query."""
    stripped = sql.lstrip().lower()
    return stripped.startswith(("select", "with", "show", "explain"))


# ============================================================================
# DATABASE COMPATIBILITY LAYER
# ============================================================================

class CompatCursor:
    """Cursor wrapper that normalizes asyncpg/aiosqlite result formats."""

    def __init__(self, rows: Sequence[Any] | None = None):
        self._rows = [dict(row) if not isinstance(row, dict) else row for row in (rows or [])]

    async def fetchone(self):
        """Return first row or None."""
        return self._rows[0] if self._rows else None

    async def fetchall(self):
        """Return all rows as list."""
        return list(self._rows)


class PostgresCompatConnection:
    """Wrapper for asyncpg connection that emulates aiosqlite interface."""

    def __init__(self, conn: Any):
        self._conn = conn

    async def execute(self, sql: str, params: Sequence[Any] | None = None):
        """Execute query and return CompatCursor."""
        params = tuple(params or ())
        translated = _translate_sql(sql)
        if _is_read_query(sql):
            rows = await self._conn.fetch(translated, *params)
            return CompatCursor(rows)
        await self._conn.execute(translated, *params)
        return CompatCursor()

    async def executemany(self, sql: str, param_sets: Iterable[Sequence[Any]]):
        """Execute query multiple times with different params."""
        translated = _translate_sql(sql)
        await self._conn.executemany(translated, list(param_sets))

    async def commit(self):
        """No-op for asyncpg (auto-commits)."""
        return None


# ============================================================================
# SEEDING FUNCTIONS
# ============================================================================

async def _sync_education_subcategories(db: Any) -> None:
    """Sync education subcategories and moods (special handling)."""
    await db.execute("DELETE FROM category_subcategories WHERE category_id = ?", ("education",))
    await db.executemany(
        "INSERT INTO category_subcategories (id, category_id, label, icon, sort_order) VALUES (?, ?, ?, ?, ?)",
        EDUCATION_SUBCATEGORY_SEED,
    )
    await db.execute("DELETE FROM category_moods WHERE category_id = ?", ("education",))
    await db.executemany(
        "INSERT INTO category_moods (id, category_id, label, icon, sort_order) VALUES (?, ?, ?, ?, ?)",
        EDUCATION_MOOD_SEED,
    )
    await db.commit()


async def _seed_db(db: Any) -> None:
    """Seed categories, subcategories, moods, and report types."""
    # Check if already seeded
    cursor = await db.execute("SELECT COUNT(*) AS count FROM categories")
    row = await cursor.fetchone()
    if row and row.get("count", 0) > 0:
        return  # Already seeded

    # Seed categories
    await db.executemany(
        "INSERT INTO categories (id, label, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)",
        CATEGORY_SEED,
    )

    # Seed subcategories
    await db.executemany(
        "INSERT INTO category_subcategories (id, category_id, label, icon, sort_order) VALUES (?, ?, ?, ?, ?)",
        CATEGORY_SUBCATEGORY_SEED,
    )

    # Seed moods
    await db.executemany(
        "INSERT INTO category_moods (id, category_id, label, icon, sort_order) VALUES (?, ?, ?, ?, ?)",
        CATEGORY_MOOD_SEED,
    )

    # Sync education-specific data
    await _sync_education_subcategories(db)

    # Seed report types
    await db.executemany(
        "INSERT INTO report_types (id, label, icon, color, duration_h, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        REPORT_TYPE_SEED,
    )

    await db.commit()


# ============================================================================
# INITIALIZATION FUNCTIONS
# ============================================================================

async def _init_sqlite() -> None:
    """Initialize SQLite database with schema and seed data."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA foreign_keys = ON")

        # Create base tables
        for statement in SCHEMA_STATEMENTS:
            try:
                await db.execute(statement)
            except Exception as e:
                logger.debug(f"SQLite schema statement failed (may be expected): {e}")

        # Add missing profile columns
        cols_cursor = await db.execute("PRAGMA table_info(profiles)")
        cols = await cols_cursor.fetchall()
        existing_cols = {row[1] for row in cols}
        for col_name, col_type in SQLITE_PROFILE_COLUMNS:
            if col_name not in existing_cols:
                await db.execute(f"ALTER TABLE profiles ADD COLUMN {col_name} {col_type}")

        # Add missing deals columns
        deal_cols_cursor = await db.execute("PRAGMA table_info(deals)")
        deal_cols = await deal_cols_cursor.fetchall()
        existing_deal_cols = {row[1] for row in deal_cols}
        for col_name, col_type in SQLITE_DEALS_COLUMNS:
            if col_name not in existing_deal_cols:
                await db.execute(f"ALTER TABLE deals ADD COLUMN {col_name} {col_type}")

        # Add missing reservations columns
        reservation_cols_cursor = await db.execute("PRAGMA table_info(reservations)")
        reservation_cols = await reservation_cols_cursor.fetchall()
        existing_reservation_cols = {row[1] for row in reservation_cols}
        for col_name, col_type in SQLITE_RESERVATIONS_COLUMNS:
            if col_name not in existing_reservation_cols:
                await db.execute(f"ALTER TABLE reservations ADD COLUMN {col_name} {col_type}")

        await db.commit()
        await _seed_db(db)


async def _init_postgres() -> None:
    """Initialize Postgres database with schema and seed data."""
    conn = await _postgres_connect()
    try:
        db = PostgresCompatConnection(conn)
        for statement in SCHEMA_STATEMENTS:
            try:
                await conn.execute(statement)
            except Exception as e:
                logger.debug(f"Postgres schema statement failed (may be expected): {e}")
        await _seed_db(db)
    finally:
        await conn.close()


# ============================================================================
# PUBLIC API
# ============================================================================

async def init_db():
    """Initialize the configured database backend (Postgres or SQLite)."""
    if USE_POSTGRES:
        logger.info("Initializing Cloud SQL compatibility schema...")
        await _init_postgres()
        return

    logger.info("Initializing local SQLite database...")
    await _init_sqlite()


@asynccontextmanager
async def get_db() -> AsyncGenerator[Any, None]:
    """
    Context manager to get database connection.
    Returns PostgresCompatConnection for Postgres, aiosqlite.Connection for SQLite.
    """
    if USE_POSTGRES:
        conn = await _postgres_connect()
        try:
            yield PostgresCompatConnection(conn)
        finally:
            await conn.close()
        return

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db
