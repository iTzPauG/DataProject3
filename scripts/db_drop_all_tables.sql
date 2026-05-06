-- Reset completo + schema 005
-- Elimina todas las tablas del schema public y las recrea desde cero

-- Drop todo en orden correcto (dependencias primero)
DROP TABLE IF EXISTS public.item_votes CASCADE;
DROP TABLE IF EXISTS public.saved_items CASCADE;
DROP TABLE IF EXISTS public.report_confirmations CASCADE;
DROP TABLE IF EXISTS public.community_reports CASCADE;
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.places CASCADE;
DROP TABLE IF EXISTS public.restaurant_tags CASCADE;
DROP TABLE IF EXISTS public.restaurants CASCADE;
DROP TABLE IF EXISTS public.category_moods CASCADE;
DROP TABLE IF EXISTS public.category_subcategories CASCADE;
DROP TABLE IF EXISTS public.report_types CASCADE;
DROP TABLE IF EXISTS public.user_preferences CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;

-- Funciones
DROP FUNCTION IF EXISTS public.update_places_search_vector() CASCADE;
DROP FUNCTION IF EXISTS public.update_report_confirmations_count() CASCADE;
