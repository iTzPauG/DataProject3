-- 007: Add restaurant metadata to business profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS restaurant_place_id TEXT,
  ADD COLUMN IF NOT EXISTS restaurant_name      TEXT,
  ADD COLUMN IF NOT EXISTS restaurant_cuisine   TEXT;
