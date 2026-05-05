-- 006: Add role to profiles + deals table

-- 1. Role field on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user'
  CHECK (role IN ('user', 'business', 'admin'));

-- 2. Deals table (source of truth)
CREATE TABLE IF NOT EXISTS public.deals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id TEXT NOT NULL,
  owner_uid     TEXT NOT NULL,          -- firebase_uid of the business account
  price         NUMERIC(8,2) NOT NULL,
  cuisine       TEXT NOT NULL,
  available_at  TIMESTAMPTZ NOT NULL,
  seats         INT NOT NULL CHECK (seats >= 0),
  description   TEXT,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_deals_owner ON public.deals(owner_uid);
CREATE INDEX IF NOT EXISTS idx_deals_active ON public.deals(is_active, available_at);
