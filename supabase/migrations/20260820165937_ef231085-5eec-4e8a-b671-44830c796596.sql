INSERT INTO public.service_types (name, slug, pricing_mode, sort_order) VALUES
  ('Carpet Cleaning (2–3 Rooms)', 'carpet-2-3-rooms', 'manual_quote', 70),
  ('Sofa + Carpet Cleaning', 'sofa-carpet', 'manual_quote', 80),
  ('Sofa + Mattress Cleaning', 'sofa-mattress', 'manual_quote', 90),
  ('Carpet + Mattress Cleaning', 'carpet-mattress', 'manual_quote', 100),
  ('Deep Clean (3+ Rooms)', 'deep-clean-3-plus-rooms', 'manual_quote', 110),
  ('Post-Tenancy Carpet & Upholstery', 'post-tenancy-carpet-upholstery', 'manual_quote', 120),
  ('Office Carpet + Upholstery Clean', 'office-carpet-upholstery', 'manual_quote', 130),
  ('Large Property Window + Interior', 'large-property-window-interior', 'manual_quote', 140),
  ('Multi-Room + Upholstery Deep Clean', 'multi-room-upholstery', 'manual_quote', 150)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    pricing_mode = EXCLUDED.pricing_mode,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = now();

UPDATE public.admin_settings
SET value = '{"serviceSlugs":["end-of-tenancy","move-in-move-out","one-off-deep","weekly-routine","post-construction","airbnb-short-let","carpet-2-3-rooms","sofa-carpet","sofa-mattress","carpet-mattress","deep-clean-3-plus-rooms","post-tenancy-carpet-upholstery","office-carpet-upholstery","large-property-window-interior","multi-room-upholstery","student-accommodation"]}'::jsonb,
    updated_at = now()
WHERE key = 'request_form_services'
  AND value = '{"serviceSlugs":["end-of-tenancy","move-in-move-out","one-off-deep","weekly-routine","post-construction","airbnb-short-let","student-accommodation"]}'::jsonb;