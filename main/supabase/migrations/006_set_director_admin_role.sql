-- Ensure the role column exists on profiles (in case this runs before backend migrations)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'user';

-- Mark Director@whim.app as admin by firebase_uid
UPDATE public.profiles
SET role = 'admin', updated_at = now()
WHERE firebase_uid = '5duJR57R28cOaVgKQBv9EyAClXp2';
