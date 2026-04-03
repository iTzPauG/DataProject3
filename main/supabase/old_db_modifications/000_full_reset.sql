-- ============================================================================
-- GADO Full Reset — Single Source of Truth
-- Drops and recreates the public schema, then applies all structures and seeds.
-- WARNING: This wipes ALL data in public schema.
-- ============================================================================

-- 0. Wipe everything
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Permissions Restore
-- Required because DROP SCHEMA CASCADE wipes existing permissions for Supabase roles.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Profiles
CREATE TABLE public.profiles (
  id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name     TEXT,
  avatar_url       TEXT,
  anon_fingerprint TEXT UNIQUE,
  reputation_score INT DEFAULT 0,
  reports_count    INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

-- Categories
CREATE TABLE public.categories (
  id             TEXT PRIMARY KEY,
  label          TEXT NOT NULL,
  icon           TEXT NOT NULL,
  color          TEXT NOT NULL,
  sort_order     INT DEFAULT 0,
  is_active      BOOLEAN DEFAULT true,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Places
CREATE TABLE public.places (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id   TEXT,
  osm_id        TEXT,
  osm_type      TEXT,
  source        TEXT DEFAULT 'manual',
  category_id   TEXT NOT NULL REFERENCES public.categories(id),
  subcategory   TEXT,
  amenity       TEXT,
  name          TEXT NOT NULL,
  description   TEXT,
  address       TEXT,
  phone         TEXT,
  website       TEXT,
  photo_url     TEXT,
  rating        REAL,
  price_level   INT,
  location      geography(POINT, 4326) NOT NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  tags          JSONB DEFAULT '{}'::jsonb,
  opening_hours TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  is_verified   BOOLEAN DEFAULT false,
  search_vector tsvector,
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Events
CREATE TABLE public.events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   TEXT NOT NULL REFERENCES public.categories(id),
  subcategory   TEXT,
  title         TEXT NOT NULL,
  description   TEXT,
  location      geography(POINT, 4326) NOT NULL,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  address       TEXT,
  photo_url     TEXT,
  source_url    TEXT,
  starts_at     TIMESTAMPTZ NOT NULL,
  ends_at       TIMESTAMPTZ,
  is_recurring  BOOLEAN DEFAULT false,
  recurrence    TEXT,
  price_info    TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  status        TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'cancelled', 'completed')),
  created_by    UUID REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Report Types (Dynamic)
CREATE TABLE public.report_types (
  id          TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  icon        TEXT NOT NULL,
  color       TEXT DEFAULT '#FF4444',
  duration_h  INT DEFAULT 4,
  sort_order  INT DEFAULT 0,
  is_active   BOOLEAN DEFAULT true
);

-- Community Reports
CREATE TABLE public.community_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type       TEXT NOT NULL, -- references report_types.id logic-wise, but we keep it flexible
  title             TEXT NOT NULL,
  description       TEXT,
  location          geography(POINT, 4326) NOT NULL,
  lat               DOUBLE PRECISION NOT NULL,
  lng               DOUBLE PRECISION NOT NULL,
  address_hint      TEXT,
  photo_urls        TEXT[] DEFAULT '{}',
  created_by        UUID REFERENCES public.profiles(id),
  anon_fingerprint  TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL,
  is_active         BOOLEAN DEFAULT true,
  confirmations     INT DEFAULT 0,
  denials           INT DEFAULT 0,
  confidence        REAL DEFAULT 0.5,
  is_flagged        BOOLEAN DEFAULT false,
  flag_reason       TEXT,
  moderation_status TEXT DEFAULT 'pending' CHECK (
    moderation_status IN ('pending', 'approved', 'rejected', 'auto_expired')
  )
);

-- Report Confirmations
CREATE TABLE public.report_confirmations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        UUID NOT NULL REFERENCES public.community_reports(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES public.profiles(id),
  anon_fingerprint TEXT,
  vote             INT NOT NULL CHECK (vote IN (1, -1)),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Item Votes (Universal: Places, Events)
CREATE TABLE public.item_votes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type        TEXT NOT NULL CHECK (item_type IN ('place', 'event')),
  item_id          TEXT NOT NULL,
  voter_id         TEXT NOT NULL, -- Hashed IP + UA for anonymity, or User ID
  vote             INT NOT NULL CHECK (vote IN (1, -1)),
  created_at       TIMESTAMPTZ DEFAULT now(),
  UNIQUE (item_id, voter_id)
);

-- Saved Items
CREATE TABLE public.saved_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type   TEXT NOT NULL CHECK (item_type IN ('place', 'event', 'report')),
  item_id     UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

-- User Preferences
CREATE TABLE public.user_preferences (
  user_id           UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  default_radius_m  INT DEFAULT 2000,
  favorite_cats     TEXT[] DEFAULT '{}',
  map_style         TEXT DEFAULT 'standard',
  notifications_on  BOOLEAN DEFAULT true,
  language          TEXT DEFAULT 'es',
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Search History
CREATE TABLE public.search_history (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  anon_fp      TEXT,
  query        TEXT NOT NULL,
  category     TEXT,
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  result_count INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Push Tokens
CREATE TABLE public.push_tokens (
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token      TEXT PRIMARY KEY,
  device_os  TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX idx_places_location ON public.places USING GIST(location);
CREATE INDEX idx_places_category ON public.places(category_id);
CREATE INDEX idx_places_osm_id ON public.places(osm_id) WHERE osm_id IS NOT NULL;
CREATE INDEX idx_places_fts ON public.places USING GIN(search_vector);

CREATE INDEX idx_events_location ON public.events USING GIST(location);
CREATE INDEX idx_events_starts ON public.events(starts_at);

CREATE INDEX idx_reports_location ON public.community_reports USING GIST(location);
CREATE INDEX idx_reports_active ON public.community_reports(is_active, expires_at);

CREATE UNIQUE INDEX idx_confirm_user ON public.report_confirmations(report_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_confirm_anon ON public.report_confirmations(report_id, anon_fingerprint) WHERE anon_fingerprint IS NOT NULL;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Categories are public" ON public.categories FOR SELECT USING (true);

ALTER TABLE public.places ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Places are public" ON public.places FOR SELECT USING (true);
CREATE POLICY "Auth users can create places" ON public.places FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active events are public" ON public.events FOR SELECT USING (status = 'active');
CREATE POLICY "Auth users can create events" ON public.events FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active reports are public" ON public.community_reports FOR SELECT USING (is_active = true AND expires_at > now());
CREATE POLICY "Anyone can create reports" ON public.community_reports FOR INSERT WITH CHECK (true);

ALTER TABLE public.report_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can confirm reports" ON public.report_confirmations FOR INSERT WITH CHECK (true);

ALTER TABLE public.item_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can vote" ON public.item_votes FOR ALL USING (true);

ALTER TABLE public.saved_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own saved items" ON public.saved_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage saved items" ON public.saved_items FOR ALL USING (auth.uid() = user_id);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own preferences" ON public.user_preferences FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Search Vector Trigger
CREATE OR REPLACE FUNCTION public.update_places_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector(
    'spanish',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(NEW.address, '') || ' ' ||
    coalesce(NEW.subcategory, '') || ' ' ||
    coalesce(NEW.amenity, '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_places_search_vector
  BEFORE INSERT OR UPDATE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.update_places_search_vector();

-- Report Confidence Trigger
CREATE OR REPLACE FUNCTION public.update_report_confidence()
RETURNS TRIGGER AS $$
DECLARE
  confirm_count INT;
  deny_count INT;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN vote = 1 THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN vote = -1 THEN 1 ELSE 0 END), 0)
  INTO confirm_count, deny_count
  FROM public.report_confirmations
  WHERE report_id = NEW.report_id;

  UPDATE public.community_reports
  SET
    confirmations = confirm_count,
    denials = deny_count,
    confidence = CASE
      WHEN (confirm_count + deny_count) = 0 THEN 0.5
      ELSE confirm_count::REAL / (confirm_count + deny_count)::REAL
    END,
    is_active = CASE
      WHEN deny_count >= 5 AND deny_count > confirm_count * 2 THEN false
      ELSE is_active
    END
  WHERE id = NEW.report_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_confidence
  AFTER INSERT OR UPDATE ON public.report_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.update_report_confidence();

-- Auth Signup Trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Nearby Items RPC
-- Uses explicit SRID 4326 for geography operations to avoid compatibility issues.
-- Granting execute permission explicitly to ensure availability.
GRANT ALL ON SCHEMA public TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.nearby_items(
  user_lat        DOUBLE PRECISION,
  user_lng        DOUBLE PRECISION,
  radius_m        INT DEFAULT 5000,
  category_filter TEXT DEFAULT NULL,
  item_types      TEXT[] DEFAULT ARRAY['place','event','report']
)
RETURNS TABLE (
  item_type   TEXT,
  item_id     UUID,
  category_id TEXT,
  title       TEXT,
  lat         DOUBLE PRECISION,
  lng         DOUBLE PRECISION,
  distance_m  DOUBLE PRECISION,
  icon        TEXT,
  color       TEXT,
  metadata    JSONB
) AS $$
DECLARE
    u_geog geography;
BEGIN
  -- Create geography point once
  u_geog := ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography;

  RETURN QUERY
  SELECT * FROM (
    SELECT 
      'place'::TEXT AS item_type, 
      p.id AS item_id, 
      p.category_id, 
      p.name AS title, 
      p.lat, 
      p.lng,
      ST_Distance(p.location, u_geog)::DOUBLE PRECISION AS distance_m,
      c.icon, 
      c.color,
      jsonb_build_object('rating', p.rating, 'address', p.address, 'photo_url', p.photo_url) AS metadata
    FROM public.places p 
    JOIN public.categories c ON c.id = p.category_id
    WHERE 'place' = ANY(item_types) 
      AND ST_DWithin(p.location, u_geog, radius_m::DOUBLE PRECISION)
      AND (category_filter IS NULL OR p.category_id = category_filter)
      
    UNION ALL
    
    SELECT 
      'event'::TEXT AS item_type, 
      e.id AS item_id, 
      e.category_id, 
      e.title, 
      e.lat, 
      e.lng,
      ST_Distance(e.location, u_geog)::DOUBLE PRECISION AS distance_m,
      c.icon, 
      c.color,
      jsonb_build_object('starts_at', e.starts_at, 'photo_url', e.photo_url) AS metadata
    FROM public.events e 
    JOIN public.categories c ON c.id = e.category_id
    WHERE 'event' = ANY(item_types) 
      AND ST_DWithin(e.location, u_geog, radius_m::DOUBLE PRECISION)
      AND e.status = 'active' 
      AND (e.ends_at IS NULL OR e.ends_at > now())
      AND (category_filter IS NULL OR e.category_id = category_filter)
      
    UNION ALL
    
    SELECT 
      'report'::TEXT AS item_type, 
      r.id AS item_id, 
      'report'::TEXT AS category_id, 
      r.title, 
      r.lat, 
      r.lng,
      ST_Distance(r.location, u_geog)::DOUBLE PRECISION AS distance_m,
      rt.icon, 
      rt.color,
      jsonb_build_object('report_type', r.report_type, 'expires_at', r.expires_at) AS metadata
    FROM public.community_reports r 
    LEFT JOIN public.report_types rt ON rt.id = r.report_type
    WHERE 'report' = ANY(item_types) 
      AND ST_DWithin(r.location, u_geog, radius_m::DOUBLE PRECISION)
      AND r.is_active = true 
      AND r.expires_at > now()
  ) sub
  ORDER BY sub.distance_m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Categories
INSERT INTO public.categories (id, label, icon, color, sort_order) VALUES
  ('food',          'Comida y bebida',    '🍴',  '#FF6B35', 1),
  ('nightlife',     'Ocio nocturno',      '🌙',  '#3B82F6', 2),
  ('shopping',      'Compras',            '🛒',  '#10B981', 3),
  ('health',        'Salud y farmacia',   '💊',  '#EF4444', 4),
  ('nature',        'Naturaleza',         '🌿',  '#22C55E', 6),
  ('culture',       'Cultura y ocio',     '🎭',  '#F59E0B', 7),
  ('services',      'Servicios',          '🛠️',  '#94A3B8', 8),
  ('sport',         'Deporte',            '⚽',  '#0EA5E9', 9),
  ('education',     'Educación',          '📚',  '#8B5CF6', 10),
  ('event',         'Eventos',            '🎉',  '#EC4899', 11),
  ('market',        'Mercados',           '🏪',  '#F97316', 12),
  ('music',         'Música en vivo',     '🎵',  '#A855F7', 13),
  ('report',        'Reportes en vivo',   '📢',  '#EF4444', 14);

-- Report Types
INSERT INTO public.report_types (id, label, icon, color, duration_h, sort_order) VALUES
  ('traffic',         'Tráfico cortado',    '🚧', '#FF4444', 2,  1),
  ('accident',        'Accidente',          '💥', '#FF4444', 3,  2),
  ('police',          'Control policial',   '👮', '#3B82F6', 2,  3),
  ('queue',           'Cola larga',         '👥', '#F59E0B', 1,  4),
  ('popup_market',    'Mercadillo',         '🏪', '#10B981', 6,  5),
  ('food_truck',      'Food truck',         '🚚', '#FF6B35', 4,  6),
  ('live_music',      'Música en vivo',     '🎸', '#8B5CF6', 4,  7),
  ('street_show',     'Espectáculo calle',  '🎭', '#EC4899', 3,  8),
  ('free_stuff',      'Cosa gratis',        '🎁', '#22C55E', 2,  9),
  ('road_closure',    'Corte de calle',     '🚫', '#EF4444', 4, 10),
  ('parking_free',    'Parking libre',      '🅿️',  '#0EA5E9', 2, 11),
  ('protest',         'Manifestación',      '✊', '#F97316', 3, 12),
  ('construction',    'Obras',              '👷', '#94A3B8', 48, 13),
  ('other',           'Otro',               '📍', '#6366F1', 3, 14);

-- Places (Valencia)
INSERT INTO public.places (category_id, name, description, address, rating, price_level, lat, lng, location) VALUES
('food', 'La Pepica', 'Famous traditional restaurant.', 'Passeig de Neptú, 6, 46011 València', 4.2, 2, 39.4673, -0.3235, ST_MakePoint(-0.3235, 39.4673)::geography),
('food', 'Ricard Camarena', 'Michelin-starred.', 'Av. de Burjassot, 54, 46009 València', 4.8, 4, 39.4842, -0.3846, ST_MakePoint(-0.3846, 39.4842)::geography);

-- Events
INSERT INTO public.events (category_id, title, description, starts_at, lat, lng, location) VALUES
('event', 'Mascletá', 'Plaza del Ayuntamiento firecrackers.', now() + interval '5 days', 39.4699, -0.3768, ST_MakePoint(-0.3768, 39.4699)::geography);

-- Final explicit grant for all tables created in this script
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;
