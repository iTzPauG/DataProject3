-- Fix item_votes.item_id: change from UUID to TEXT so Google Places IDs
-- (e.g. "ChIJxxxxxxxx") can be stored alongside internal UUIDs.
-- Existing UUID values are preserved as their text representation.
ALTER TABLE public.item_votes ALTER COLUMN item_id TYPE TEXT;
