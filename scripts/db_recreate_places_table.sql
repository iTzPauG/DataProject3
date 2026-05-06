-- Recrear tabla places con schema 005 correcto
-- Elimina la tabla vieja (sin geography, sin jsonb) y la recrea

BEGIN;

-- Eliminar dependencias primero
DROP TABLE IF EXISTS public.saved_items CASCADE;
DROP TABLE IF EXISTS public.item_votes CASCADE;
DROP TABLE IF EXISTS public.places CASCADE;

-- Recrear places con schema 005
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

ALTER TABLE public.places ADD CONSTRAINT places_external_id_unique UNIQUE (external_id);
CREATE INDEX idx_places_location ON public.places USING GIST(location);
CREATE INDEX idx_places_category ON public.places(category_id);
CREATE INDEX idx_places_fts ON public.places USING GIN(search_vector);

-- Recrear saved_items
CREATE TABLE public.saved_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.profiles(id),
  item_type  TEXT NOT NULL CHECK (item_type IN ('place', 'event', 'report')),
  item_id    UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

-- Recrear item_votes
CREATE TABLE public.item_votes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES public.profiles(id),
  item_type  TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  vote       SMALLINT NOT NULL CHECK (vote IN (-1, 1)),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, item_type, item_id)
);

-- Trigger search_vector
CREATE OR REPLACE FUNCTION public.update_places_search_vector()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector := to_tsvector('spanish',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.subcategory, '') || ' ' ||
    coalesce(NEW.address, '') || ' ' ||
    coalesce(NEW.description, '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_places_search_vector
  BEFORE INSERT OR UPDATE ON public.places
  FOR EACH ROW EXECUTE FUNCTION public.update_places_search_vector();

GRANT ALL ON public.places TO gado_app;
GRANT ALL ON public.saved_items TO gado_app;
GRANT ALL ON public.item_votes TO gado_app;

COMMIT;
