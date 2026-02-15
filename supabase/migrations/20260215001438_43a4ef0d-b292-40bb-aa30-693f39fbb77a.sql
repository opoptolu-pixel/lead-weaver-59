-- Add utm_data JSONB column to store full attribution evidence
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS utm_data jsonb DEFAULT NULL;