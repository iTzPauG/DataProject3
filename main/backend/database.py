"""Local SQLite async connection."""
import os
import sqlite3
import aiosqlite
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

logger = logging.getLogger(__name__)

DB_PATH = os.getenv("DATABASE_PATH", "temp_local.db")

async def init_db():
    """Initialize the local SQLite database with basic schema."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("PRAGMA foreign_keys = ON")
        
        # Categories
        await db.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                icon TEXT,
                color TEXT,
                sort_order INTEGER,
                is_active BOOLEAN DEFAULT 1
            )
        """)

        # Places
        await db.execute("""
            CREATE TABLE IF NOT EXISTS places (
                id TEXT PRIMARY KEY,
                external_id TEXT,
                osm_id TEXT,
                osm_type TEXT,
                source TEXT DEFAULT 'manual',
                category_id TEXT NOT NULL REFERENCES categories(id),
                subcategory TEXT,
                amenity TEXT,
                name TEXT NOT NULL,
                description TEXT,
                address TEXT,
                phone TEXT,
                website TEXT,
                photo_url TEXT,
                rating REAL,
                price_level INTEGER,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                tags TEXT,
                opening_hours TEXT,
                metadata TEXT,
                is_verified BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(source, external_id)
            )
        """)

        # Events
        await db.execute("""
            CREATE TABLE IF NOT EXISTS events (
                id TEXT PRIMARY KEY,
                category_id TEXT NOT NULL REFERENCES categories(id),
                subcategory TEXT,
                title TEXT NOT NULL,
                description TEXT,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                address TEXT,
                photo_url TEXT,
                starts_at DATETIME NOT NULL,
                ends_at DATETIME,
                price_info TEXT,
                metadata TEXT,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Community Reports
        await db.execute("""
            CREATE TABLE IF NOT EXISTS community_reports (
                id TEXT PRIMARY KEY,
                report_type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                address_hint TEXT,
                photo_urls TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                confirmations INTEGER DEFAULT 0,
                denials INTEGER DEFAULT 0,
                confidence REAL DEFAULT 0.5
            )
        """)

        # Profiles
        await db.execute("""
            CREATE TABLE IF NOT EXISTS profiles (
                id TEXT PRIMARY KEY,
                firebase_uid TEXT UNIQUE,
                display_name TEXT,
                avatar_url TEXT,
                anon_fingerprint TEXT UNIQUE,
                reputation_score INTEGER DEFAULT 0,
                reports_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Saved Items
        await db.execute("""
            CREATE TABLE IF NOT EXISTS saved_items (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                item_type TEXT NOT NULL,
                item_id TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (user_id, item_type, item_id)
            )
        """)

        # Item Votes
        await db.execute("""
            CREATE TABLE IF NOT EXISTS item_votes (
                id TEXT PRIMARY KEY,
                item_id TEXT NOT NULL,
                voter_id TEXT NOT NULL,
                vote INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (item_id, voter_id)
            )
        """)

        # User Preferences
        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                user_id TEXT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
                default_radius_m INTEGER DEFAULT 2000,
                favorite_cats TEXT DEFAULT '[]',
                map_style TEXT DEFAULT 'standard',
                map_minimal BOOLEAN DEFAULT 0,
                map_preset TEXT DEFAULT 'classic',
                gado_overlay_on BOOLEAN DEFAULT 1,
                notifications_on BOOLEAN DEFAULT 1,
                language TEXT DEFAULT 'es',
                theme TEXT DEFAULT 'system',
                show_real_time_events BOOLEAN DEFAULT 1,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Category Subcategories
        await db.execute("""
            CREATE TABLE IF NOT EXISTS category_subcategories (
                id TEXT NOT NULL,
                category_id TEXT NOT NULL REFERENCES categories(id),
                label TEXT NOT NULL,
                icon TEXT,
                metadata TEXT,
                sort_order INTEGER,
                is_active BOOLEAN DEFAULT 1,
                PRIMARY KEY (id, category_id)
            )
        """)

        # Category Moods
        await db.execute("""
            CREATE TABLE IF NOT EXISTS category_moods (
                id TEXT NOT NULL,
                category_id TEXT NOT NULL REFERENCES categories(id),
                label TEXT NOT NULL,
                icon TEXT,
                metadata TEXT,
                sort_order INTEGER,
                is_active BOOLEAN DEFAULT 1,
                PRIMARY KEY (id, category_id)
            )
        """)

        # Report Confirmations
        await db.execute("""
            CREATE TABLE IF NOT EXISTS report_confirmations (
                id TEXT PRIMARY KEY,
                report_id TEXT NOT NULL REFERENCES community_reports(id) ON DELETE CASCADE,
                user_id TEXT REFERENCES profiles(id),
                anon_fingerprint TEXT,
                actor_key TEXT NOT NULL,
                vote INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(report_id, actor_key)
            )
        """)

        # Report Types
        await db.execute("""
            CREATE TABLE IF NOT EXISTS report_types (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                icon TEXT,
                color TEXT,
                duration_h INTEGER DEFAULT 2,
                sort_order INTEGER,
                is_active BOOLEAN DEFAULT 1
            )
        """)

        # Seed categories if empty
        cursor = await db.execute("SELECT COUNT(*) FROM categories")
        count = (await cursor.fetchone())[0]
        if count == 0:
            categories = [
                ('food','Comida y bebida','🍴','#FF6B35',1),
                ('nightlife','Ocio nocturno','🌙','#3B82F6',2),
                ('shopping','Compras','🛒','#10B981',3),
                ('health','Salud y farmacia','💊','#EF4444',4),
                ('nature','Naturaleza','🌿','#22C55E',6),
                ('culture','Cultura y ocio','🎭','#F59E0B',7),
                ('services','Servicios','🛠️','#94A3B8',8),
                ('sport','Deporte','⚽','#0EA5E9',9),
                ('education','Educación','📚','#8B5CF6',10),
                ('event','Eventos','🎉','#EC4899',11),
                ('market','Mercados','🏪','#F97316',12),
                ('music','Música en vivo','🎵','#A855F7',13),
                ('report','Reportes en vivo','📢','#EF4444',14),
                ('wellness','Bienestar','🧖','#8B5CF6',15),
                ('coworking','Coworking','🏢','#6366F1',16),
                ('pets','Mascotas','🐾','#F59E0B',17),
                ('automotive','Vehiculo','🚗','#64748B',18),
                ('cinema','Cine','🎬','#EC4899',11)
            ]
            await db.executemany(
                "INSERT INTO categories (id, label, icon, color, sort_order) VALUES (?, ?, ?, ?, ?)",
                categories
            )
            await db.commit()

        # Seed report types
        cursor = await db.execute("SELECT COUNT(*) FROM report_types")
        count = (await cursor.fetchone())[0]
        if count == 0:
            report_types = [
                ('traffic','Tráfico cortado','🚧','#FF4444',2,1),
                ('accident','Accidente','💥','#FF4444',3,2),
                ('police','Control policial','👮','#3B82F6',2,3),
                ('queue','Cola larga','👥','#F59E0B',1,4),
                ('popup_market','Mercadillo','🏪','#10B981',6,5),
                ('food_truck','Food truck','🚚','#FF6B35',4,6),
                ('live_music','Música en vivo','🎸','#8B5CF6',4,7),
                ('street_show','Espectáculo calle','🎭','#EC4899',3,8),
                ('free_stuff','Cosa gratis','🎁','#22C55E',2,9),
                ('road_closure','Corte de calle','🚫','#EF4444',4,10),
                ('parking_free','Parking libre','🅿️','#0EA5E9',2,11),
                ('protest','Manifestación','✊','#F97316',3,12),
                ('construction','Obras','👷','#94A3B8',48,13),
                ('other','Otro','📍','#6366F1',3,14)
            ]
            await db.executemany(
                "INSERT INTO report_types (id, label, icon, color, duration_h, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
                report_types
            )
            await db.commit()

@asynccontextmanager
async def get_db() -> AsyncGenerator[aiosqlite.Connection, None]:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db
