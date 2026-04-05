-- 004: Cloud SQL Migration
-- Adapts the schema for plain PostgreSQL (Cloud SQL).
-- Removes Supabase-specific: auth.users FK, RLS policies, Supabase-specific grants.
-- Run this AFTER 000_full_reset.sql on Cloud SQL.
-- ============================================================================

-- Drop Supabase auth trigger (auth.users does not exist in Cloud SQL)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Remove FK to auth.users on profiles (replace with standalone PK)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Remove FK to auth.users on push_tokens
ALTER TABLE public.push_tokens DROP CONSTRAINT IF EXISTS push_tokens_user_id_fkey;

-- Add password_hash column to profiles for local auth (Firebase handles auth,
-- but we keep a local user record linked by firebase_uid)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS firebase_uid TEXT UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_firebase_uid ON public.profiles(firebase_uid);

-- Drop all RLS policies (not needed without Supabase)
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.places DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.events DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.community_reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_confirmations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_votes DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences DISABLE ROW LEVEL SECURITY;

-- Create app user role if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gado_app') THEN
    CREATE ROLE gado_app LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO gado_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO gado_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO gado_app;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO gado_app;
