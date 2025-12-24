-- Create admin_settings table for persistent site configuration
CREATE TABLE public.admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  description text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Only admins can view settings
CREATE POLICY "Admins can view settings"
ON public.admin_settings FOR SELECT
USING (is_admin(auth.uid()));

-- Only admins can update settings
CREATE POLICY "Admins can update settings"
ON public.admin_settings FOR UPDATE
USING (is_admin(auth.uid()));

-- Only admins can insert settings
CREATE POLICY "Admins can insert settings"
ON public.admin_settings FOR INSERT
WITH CHECK (is_admin(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_admin_settings_updated_at
BEFORE UPDATE ON public.admin_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.admin_settings (key, value, description) VALUES
('site_config', '{"siteName": "Deep Clean UK", "supportEmail": "support@deepcleanuk.com", "leadPrice": "5", "creditPackSmall": "10", "creditPackMedium": "25", "creditPackLarge": "50"}', 'Site configuration settings'),
('system_preferences', '{"emailNotifications": true, "whatsappNotifications": true, "autoApproveVerified": false, "maintenanceMode": false, "newUserSignups": true}', 'System preference toggles');

-- Add email column to profiles via JOIN with auth.users (we need to fetch separately)
-- This requires a function to get user emails for admin purposes
CREATE OR REPLACE FUNCTION public.get_user_email(user_uuid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = user_uuid LIMIT 1;
$$;