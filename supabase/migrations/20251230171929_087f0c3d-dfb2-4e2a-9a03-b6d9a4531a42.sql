-- Create table to store advertising spend data
CREATE TABLE public.ad_spend (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL CHECK (platform IN ('google_ads', 'facebook_ads', 'tiktok_ads')),
  date DATE NOT NULL,
  spend_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'GBP',
  impressions INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(platform, date)
);

-- Enable RLS
ALTER TABLE public.ad_spend ENABLE ROW LEVEL SECURITY;

-- Only admins can view ad spend
CREATE POLICY "Admins can view ad spend"
ON public.ad_spend
FOR SELECT
USING (is_admin(auth.uid()));

-- Only admins can manage ad spend
CREATE POLICY "Admins can manage ad spend"
ON public.ad_spend
FOR ALL
USING (is_admin(auth.uid()));

-- Create index for faster date range queries
CREATE INDEX idx_ad_spend_date ON public.ad_spend(date DESC);
CREATE INDEX idx_ad_spend_platform_date ON public.ad_spend(platform, date DESC);

-- Create table for storing API credentials (encrypted references only)
CREATE TABLE public.ad_platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE CHECK (platform IN ('google_ads', 'facebook_ads', 'tiktok_ads')),
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  last_sync_at TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ad_platform_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view settings
CREATE POLICY "Admins can view ad platform settings"
ON public.ad_platform_settings
FOR SELECT
USING (is_admin(auth.uid()));

-- Only admins can manage settings
CREATE POLICY "Admins can manage ad platform settings"
ON public.ad_platform_settings
FOR ALL
USING (is_admin(auth.uid()));

-- Insert default platform settings
INSERT INTO public.ad_platform_settings (platform, is_enabled) VALUES
  ('google_ads', false),
  ('facebook_ads', false),
  ('tiktok_ads', false);

-- Add trigger for updated_at
CREATE TRIGGER update_ad_spend_updated_at
BEFORE UPDATE ON public.ad_spend
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ad_platform_settings_updated_at
BEFORE UPDATE ON public.ad_platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();