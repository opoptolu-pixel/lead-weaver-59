-- Backfill last_login for existing profiles that don't have it set
UPDATE public.profiles 
SET last_login = created_at 
WHERE last_login IS NULL;