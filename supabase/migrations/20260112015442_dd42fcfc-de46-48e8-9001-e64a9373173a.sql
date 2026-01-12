
-- Add granted_credits column to track how many granted credits a user has
-- This allows us to automatically determine credit_type when unlocking leads
ALTER TABLE public.profiles 
ADD COLUMN granted_credits integer NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.granted_credits IS 'Number of granted (free) credits available. When unlocking leads, granted credits are used first, then purchased credits.';
