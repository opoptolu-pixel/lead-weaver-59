-- Add unique constraint on platform and date for upsert operations
ALTER TABLE public.ad_spend 
ADD CONSTRAINT ad_spend_platform_date_unique UNIQUE (platform, date);