-- Add attempt tracking columns to phone_verification_codes table
ALTER TABLE public.phone_verification_codes 
ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS locked_until timestamp with time zone;

-- Create index for efficient lookup during lockout checks
CREATE INDEX IF NOT EXISTS idx_phone_verification_codes_user_lockout 
ON public.phone_verification_codes (user_id, locked_until);