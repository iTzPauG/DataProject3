-- Additive category flow config, report confirmation repair, preferences support,
-- and polymorphic ID alignment. No destructive reset.

-- ============================================================================
-- CATEGORY FLOW CONFIG
-- ============================================================================

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS has_price BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS search_mode TEXT DEFAULT 'guided_ranked',
  ADD COLUMN IF NOT EXISTS default_radius_m INT DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS fallback_radius_m INT DEFAULT 25000,
  ADD COLUMN IF NOT EXISTS provider_types JSONB DEFAULT '[]'::jsonb;

ALTER TABLE public.categories
  DROP CONSTRAINT IF EXISTS categories_search_mode_check;

ALTER TABLE public.categories
  ADD CONSTRAINT categories_search_mode_check
  CHECK (search_mode IN ('guided_ranked', 'nearby_list', 'event_list', 'report_only'));

CREATE TABLE IF NOT EXISTS public.category_subcategories (
  id TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  icon TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (category_id, id)
);

CREATE TABLE IF NOT EXISTS public.category_moods (
  id TEXT NOT NULL,
  category_id TEXT NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  icon TEXT,
  sort_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  PRIMARY KEY (category_id, id)
);

CREATE INDEX IF NOT EXISTS idx_category_subcategories_category
  ON public.category_subcategories(category_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_category_moods_category
  ON public.category_moods(category_id, sort_order);

ALTER TABLE public.category_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_moods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Category subcategories are public" ON public.category_subcategories;
CREATE POLICY "Category subcategories are public"
  ON public.category_subcategories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Category moods are public" ON public.category_moods;
CREATE POLICY "Category moods are public"
  ON public.category_moods FOR SELECT USING (true);

UPDATE public.categories
SET
  description = CASE id
    WHEN 'food' THEN 'Comida, cafeterias y planes para salir a comer'
    WHEN 'nightlife' THEN 'Bares, clubs y ocio nocturno'
    WHEN 'shopping' THEN 'Compras, centros comerciales y tiendas'
    WHEN 'transport' THEN 'Opciones para moverte y aparcar'
    WHEN 'health' THEN 'Salud, farmacias y atención médica'
    WHEN 'nature' THEN 'Parques, playas y escapadas al aire libre'
    WHEN 'culture' THEN 'Museos, galerías y espacios culturales'
    WHEN 'services' THEN 'Servicios cotidianos y gestiones'
    WHEN 'sport' THEN 'Deporte, gimnasios e instalaciones'
    WHEN 'education' THEN 'Estudio, bibliotecas y campus'
    WHEN 'cinema' THEN 'Cines y experiencias audiovisuales'
    WHEN 'event' THEN 'Eventos y planes temporales'
    WHEN 'market' THEN 'Mercados y ferias'
    WHEN 'music' THEN 'Música en vivo y conciertos'
    WHEN 'report' THEN 'Reportes en directo de la comunidad'
    ELSE description
  END,
  has_price = CASE id
    WHEN 'food' THEN true
    WHEN 'nightlife' THEN true
    WHEN 'shopping' THEN true
    WHEN 'culture' THEN true
    WHEN 'services' THEN true
    WHEN 'cinema' THEN true
    ELSE false
  END,
  search_mode = CASE id
    WHEN 'event' THEN 'event_list'
    WHEN 'market' THEN 'event_list'
    WHEN 'music' THEN 'event_list'
    WHEN 'report' THEN 'report_only'
    WHEN 'nature' THEN 'guided_ranked'
    WHEN 'transport' THEN 'guided_ranked'
    WHEN 'health' THEN 'guided_ranked'
    WHEN 'sport' THEN 'guided_ranked'
    WHEN 'education' THEN 'guided_ranked'
    ELSE 'guided_ranked'
  END,
  default_radius_m = CASE id
    WHEN 'transport' THEN 3000
    WHEN 'health' THEN 4000
    WHEN 'nature' THEN 6000
    WHEN 'event' THEN 8000
    WHEN 'report' THEN 10000
    ELSE 5000
  END,
  fallback_radius_m = CASE id
    WHEN 'transport' THEN 30000
    WHEN 'health' THEN 25000
    WHEN 'nature' THEN 50000
    WHEN 'event' THEN 50000
    WHEN 'report' THEN 50000
    ELSE 25000
  END,
  provider_types = CASE id
    WHEN 'food' THEN '["restaurant","cafe","bar","bakery","meal_delivery"]'::jsonb
    WHEN 'nightlife' THEN '["night_club","bar"]'::jsonb
    WHEN 'shopping' THEN '["shopping_mall","store","supermarket"]'::jsonb
    WHEN 'transport' THEN '["bus_station","train_station","gas_station","parking"]'::jsonb
    WHEN 'health' THEN '["pharmacy","hospital","doctor"]'::jsonb
    WHEN 'nature' THEN '["park","campground","tourist_attraction"]'::jsonb
    WHEN 'culture' THEN '["museum","art_gallery","library","tourist_attraction"]'::jsonb
    WHEN 'services' THEN '["bank","post_office","atm"]'::jsonb
    WHEN 'sport' THEN '["gym","stadium","sports_club"]'::jsonb
    WHEN 'education' THEN '["school","university","library"]'::jsonb
    WHEN 'cinema' THEN '["movie_theater"]'::jsonb
    ELSE COALESCE(provider_types, '[]'::jsonb)
  END;

-- Ensure 'cinema' category exists (missing from initial seed)
INSERT INTO public.categories (id, label, icon, color, sort_order)
VALUES ('cinema', 'Cine', '🎬', '#6366F1', 15)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.category_subcategories (id, category_id, label, icon, sort_order)
VALUES
  ('pizza', 'food', 'Pizza', '🍕', 1),
  ('hamburger', 'food', 'Hamburguesas', '🍔', 2),
  ('sushi', 'food', 'Sushi', '🍣', 3),
  ('paella', 'food', 'Paella', '🥘', 4),
  ('tacos', 'food', 'Tacos', '🌮', 5),
  ('healthy', 'food', 'Healthy', '🥗', 6),
  ('vegan', 'food', 'Vegan', '🌱', 7),
  ('italian', 'food', 'Italiano', '🍝', 8),
  ('asian', 'food', 'Asiático', '🍜', 9),
  ('bar', 'nightlife', 'Bar', '🍻', 1),
  ('club', 'nightlife', 'Discoteca', '🕺', 2),
  ('pub', 'nightlife', 'Pub', '🍺', 3),
  ('cocktail', 'nightlife', 'Cócteles', '🍸', 4),
  ('lounge', 'nightlife', 'Lounge', '🛋️', 5),
  ('clothes', 'shopping', 'Ropa', '👗', 1),
  ('shoes', 'shopping', 'Zapatos', '👞', 2),
  ('electronics', 'shopping', 'Electrónica', '💻', 3),
  ('supermarket', 'shopping', 'Supermercado', '🛒', 4),
  ('mall', 'shopping', 'Centro comercial', '🏬', 5),
  ('bus', 'transport', 'Autobús', '🚌', 1),
  ('metro', 'transport', 'Metro', '🚇', 2),
  ('taxi', 'transport', 'Taxi', '🚕', 3),
  ('bike', 'transport', 'Bici', '🚲', 4),
  ('train', 'transport', 'Tren', '🚆', 5),
  ('parking', 'transport', 'Parking', '🅿️', 6),
  ('pharmacy', 'health', 'Farmacia', '💊', 1),
  ('hospital', 'health', 'Hospital', '🏥', 2),
  ('clinic', 'health', 'Clínica', '⚕️', 3),
  ('dentist', 'health', 'Dentista', '🦷', 4),
  ('park', 'nature', 'Parque', '🌲', 1),
  ('beach', 'nature', 'Playa', '🏖️', 2),
  ('hiking', 'nature', 'Senderismo', '🥾', 3),
  ('garden', 'nature', 'Jardín', '🌺', 4),
  ('museum', 'culture', 'Museo', '🏛️', 1),
  ('gallery', 'culture', 'Galería', '🖼️', 2),
  ('theater', 'culture', 'Teatro', '🎭', 3),
  ('library', 'culture', 'Biblioteca', '📚', 4),
  ('bank', 'services', 'Banco', '🏦', 1),
  ('post_office', 'services', 'Correos', '📮', 2),
  ('salon', 'services', 'Peluquería', '✂️', 3),
  ('gym', 'services', 'Gimnasio', '🏋️', 4),
  ('football', 'sport', 'Fútbol', '⚽', 1),
  ('basketball', 'sport', 'Baloncesto', '🏀', 2),
  ('tennis', 'sport', 'Tenis', '🎾', 3),
  ('pool', 'sport', 'Piscina', '🏊', 4),
  ('school', 'education', 'Escuela', '🏫', 1),
  ('university', 'education', 'Universidad', '🎓', 2),
  ('study', 'education', 'Biblioteca', '📚', 3),
  ('movies', 'cinema', 'Películas', '🍿', 1),
  ('indie', 'cinema', 'Cine indie', '📽️', 2),
  ('imax', 'cinema', 'IMAX', '🎬', 3),
  ('live', 'music', 'Música en vivo', '🎵', 1),
  ('concert', 'music', 'Concierto', '🎤', 2),
  ('festival', 'music', 'Festival', '🎪', 3),
  ('fair', 'market', 'Feria', '🎪', 1),
  ('farmers_market', 'market', 'Mercado local', '🥕', 2),
  ('popup', 'event', 'Pop-up', '✨', 1),
  ('community', 'event', 'Comunidad', '🤝', 2)
ON CONFLICT (category_id, id) DO UPDATE
SET
  category_id = EXCLUDED.category_id,
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

INSERT INTO public.category_moods (id, category_id, label, icon, sort_order)
VALUES
  ('quick', 'food', 'Algo rápido', '⚡', 1),
  ('casual', 'food', 'Informal', '😊', 2),
  ('date', 'food', 'Cita', '❤️', 3),
  ('family', 'food', 'Familiar', '👨‍👩‍👧', 4),
  ('celebration', 'food', 'Celebración', '🎉', 5),
  ('tapas', 'food', 'Tapas', '🥂', 6),
  ('chill', 'nightlife', 'Tranquilo', '🍷', 1),
  ('party', 'nightlife', 'Fiesta', '💃', 2),
  ('friends', 'nightlife', 'Con amigos', '🍻', 3),
  ('music', 'nightlife', 'Música', '🎸', 4),
  ('window', 'shopping', 'Mirar', '👀', 1),
  ('gifts', 'shopping', 'Regalos', '🎁', 2),
  ('sale', 'shopping', 'Ofertas', '🏷️', 3),
  ('luxury', 'shopping', 'Lujo', '💎', 4),
  ('fast', 'transport', 'El más rápido', '🚀', 1),
  ('cheap', 'transport', 'Económico', '💰', 2),
  ('eco', 'transport', 'Ecológico', '🌱', 3),
  ('comfort', 'transport', 'Cómodo', '🛋️', 4),
  ('urgent', 'health', 'Urgente', '🚨', 1),
  ('routine', 'health', 'Rutina', '📅', 2),
  ('specialist', 'health', 'Especialista', '👨‍⚕️', 3),
  ('relax', 'nature', 'Relajante', '🧘', 1),
  ('active', 'nature', 'Activo', '🏃', 2),
  ('view', 'nature', 'Vistas', '📸', 3),
  ('learn', 'culture', 'Aprender', '🧠', 1),
  ('art', 'culture', 'Arte', '🎨', 2),
  ('history', 'culture', 'Historia', '🏛️', 3),
  ('quality', 'services', 'Calidad', '⭐', 1),
  ('cheap_services', 'services', 'Económico', '💰', 2),
  ('intense', 'sport', 'Intenso', '🔥', 1),
  ('fun', 'sport', 'Divertido', '😆', 2),
  ('team', 'sport', 'En equipo', '🤝', 3),
  ('quiet', 'education', 'Silencio', '🤫', 1),
  ('group', 'education', 'Grupo', '👥', 2),
  ('wifi', 'education', 'Con WiFi', '📶', 3),
  ('action', 'cinema', 'Acción', '💥', 1),
  ('comedy', 'cinema', 'Comedia', '😂', 2),
  ('drama', 'cinema', 'Drama', '🎭', 3),
  ('discover', 'event', 'Descubrir', '✨', 1),
  ('weekend', 'event', 'Fin de semana', '🎉', 2),
  ('local', 'market', 'Local', '🥬', 1),
  ('deal', 'market', 'Gangas', '💸', 2),
  ('live_vibe', 'music', 'En vivo', '🎶', 1)
ON CONFLICT (category_id, id) DO UPDATE
SET
  category_id = EXCLUDED.category_id,
  label = EXCLUDED.label,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = true;

-- ============================================================================
-- REPORT CONFIRMATIONS / POLYMORPHIC IDS
-- ============================================================================

ALTER TABLE public.report_confirmations
  ADD COLUMN IF NOT EXISTS actor_key TEXT;

UPDATE public.report_confirmations
SET actor_key = COALESCE(
  actor_key,
  CASE
    WHEN user_id IS NOT NULL THEN 'user:' || user_id::TEXT
    WHEN anon_fingerprint IS NOT NULL THEN 'anon:' || anon_fingerprint
    ELSE NULL
  END
)
WHERE actor_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_confirm_actor
  ON public.report_confirmations(report_id, actor_key)
  WHERE actor_key IS NOT NULL;

ALTER TABLE public.saved_items
  ALTER COLUMN item_id TYPE TEXT USING item_id::TEXT;

-- ============================================================================
-- USER PREFERENCES
-- ============================================================================

ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS map_minimal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS gado_overlay_on BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS map_preset TEXT NOT NULL DEFAULT 'classic';

-- ============================================================================
-- PROVIDER PERSISTENCE
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_places_source_external
  ON public.places(source, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE public.community_reports
  DROP CONSTRAINT IF EXISTS fk_community_reports_report_type;

ALTER TABLE public.community_reports
  ADD CONSTRAINT fk_community_reports_report_type
  FOREIGN KEY (report_type)
  REFERENCES public.report_types(id)
  NOT VALID;
