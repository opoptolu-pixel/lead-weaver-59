
-- Add is_closed and closed_at columns to profiles
ALTER TABLE public.profiles ADD COLUMN is_closed boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN closed_at timestamp with time zone DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN closed_reason text DEFAULT NULL;
