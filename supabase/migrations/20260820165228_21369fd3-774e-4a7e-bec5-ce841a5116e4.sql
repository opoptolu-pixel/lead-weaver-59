-- Allow administrators to choose the exact services presented on Step 1 of the
-- public cleaning-request form, and add the managed student accommodation offer.

INSERT INTO public.service_types (name, slug, pricing_mode, sort_order)
VALUES ('Student Accommodation Cleaning', 'student-accommodation', 'manual_quote', 70)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    pricing_mode = EXCLUDED.pricing_mode,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = now();

INSERT INTO public.admin_settings (key, value, description)
VALUES (
  'request_form_services',
  '{"serviceSlugs":["end-of-tenancy","move-in-move-out","one-off-deep","weekly-routine","post-construction","airbnb-short-let","student-accommodation"]}'::jsonb,
  'Controls which active services are visible on Step 1 of the customer request form'
)
ON CONFLICT (key) DO NOTHING;

CREATE POLICY "Public can read request form service selection"
ON public.admin_settings
FOR SELECT
USING (key = 'request_form_services');