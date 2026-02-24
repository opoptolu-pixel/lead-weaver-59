
-- Add public read policy for request_form_variant setting
CREATE POLICY "Public can read form variant setting"
ON public.admin_settings
FOR SELECT
USING (key = 'request_form_variant');

-- Insert default setting
INSERT INTO public.admin_settings (key, value, description)
VALUES ('request_form_variant', '{"variant": "full"}', 'Controls which Step 1 variant is shown on the request cleaning form (full or simplified)')
ON CONFLICT DO NOTHING;
