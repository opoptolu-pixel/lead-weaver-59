-- Add Commercial Cleaning as a managed agency service. It is manually scoped and
-- quoted by Cleanda after the customer enquiry; this does not alter existing jobs.

INSERT INTO public.service_types (name, slug, pricing_mode, sort_order)
VALUES ('Commercial Cleaning', 'commercial-cleaning', 'manual_quote', 160)
ON CONFLICT (slug) DO UPDATE
SET name = EXCLUDED.name,
    pricing_mode = EXCLUDED.pricing_mode,
    sort_order = EXCLUDED.sort_order,
    is_active = true,
    updated_at = now();

-- Add the new offer to the default full service selection without overriding an
-- administrator's deliberately customised selection.
UPDATE public.admin_settings
SET value = jsonb_set(
      value,
      '{serviceSlugs}',
      (value->'serviceSlugs') || '["commercial-cleaning"]'::jsonb
    ),
    updated_at = now()
WHERE key = 'request_form_services'
  AND jsonb_typeof(value->'serviceSlugs') = 'array'
  AND NOT (value->'serviceSlugs' ? 'commercial-cleaning')
  AND value->'serviceSlugs' @> '["end-of-tenancy","move-in-move-out","one-off-deep","weekly-routine","post-construction","airbnb-short-let","carpet-2-3-rooms","sofa-carpet","sofa-mattress","carpet-mattress","deep-clean-3-plus-rooms","post-tenancy-carpet-upholstery","office-carpet-upholstery","large-property-window-interior","multi-room-upholstery","student-accommodation"]'::jsonb;
