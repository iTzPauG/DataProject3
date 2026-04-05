-- Cloud SQL clean schema (no Supabase dependencies)

CREATE EXTENSION IF NOT EXISTS postgis;

-- Profiles (standalone, no auth.users FK)
CREATE TABLE IF NOT EXISTS public.profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firebase_uid     TEXT UNIQUE,
  display_name     TEXT,
  avatar_url       TEXT,
  anon_fingerprint TEXT UNIQUE,
  reputation_score INT DEFAULT 0,
  reports_count    INT DEFAULT 0,
  created_at       TIMESTAMPTZ DEFAULT now(),
  updated_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON public.profiles(firebase_uid);

-- Places
CREATE TABLE IF NOT EXISTS public.places (
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
CREATE TABLE IF NOT EXISTS public.events (
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

-- Community Reports
CREATE TABLE IF NOT EXISTS public.community_reports (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type       TEXT NOT NULL,
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
CREATE TABLE IF NOT EXISTS public.report_confirmations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id        UUID NOT NULL REFERENCES public.community_reports(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES public.profiles(id),
  anon_fingerprint TEXT,
  actor_key        TEXT,
  vote             INT NOT NULL CHECK (vote IN (1, -1)),
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Saved Items
CREATE TABLE IF NOT EXISTS public.saved_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_type   TEXT NOT NULL CHECK (item_type IN ('place', 'event', 'report')),
  item_id     UUID NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

-- User Preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id           UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  default_radius_m  INT DEFAULT 2000,
  favorite_cats     TEXT[] DEFAULT '{}',
  map_style         TEXT DEFAULT 'standard',
  map_minimal       BOOLEAN DEFAULT false,
  map_preset        TEXT DEFAULT 'classic',
  gado_overlay_on   BOOLEAN DEFAULT true,
  notifications_on  BOOLEAN DEFAULT true,
  language          TEXT DEFAULT 'es',
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Search History
CREATE TABLE IF NOT EXISTS public.search_history (
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
CREATE TABLE IF NOT EXISTS public.push_tokens (
  user_id    UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  token      TEXT PRIMARY KEY,
  device_os  TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_places_location ON public.places USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_places_category ON public.places(category_id);
CREATE INDEX IF NOT EXISTS idx_places_osm_id ON public.places(osm_id) WHERE osm_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_places_fts ON public.places USING GIN(search_vector);
CREATE INDEX IF NOT EXISTS idx_events_location ON public.events USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_events_starts ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS idx_reports_location ON public.community_reports USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_reports_active ON public.community_reports(is_active, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_confirm_user ON public.report_confirmations(report_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_confirm_anon ON public.report_confirmations(report_id, anon_fingerprint) WHERE anon_fingerprint IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_confirm_actor ON public.report_confirmations(report_id, actor_key) WHERE actor_key IS NOT NULL;

-- Search vector trigger
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

CREATE OR REPLACE TRIGGER trg_places_search_vector
  BEFORE INSERT OR UPDATE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.update_places_search_vector();

-- Report confidence trigger
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
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_update_confidence
  AFTER INSERT OR UPDATE ON public.report_confirmations
  FOR EACH ROW EXECUTE FUNCTION public.update_report_confidence();

-- Seed: categories
INSERT INTO public.categories (id, label, icon, color, sort_order) VALUES
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
ON CONFLICT (id) DO NOTHING;

-- Seed: report types
INSERT INTO public.report_types (id, label, icon, color, duration_h, sort_order) VALUES
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
ON CONFLICT (id) DO NOTHING;
