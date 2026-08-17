INSERT INTO public.platform_schema_versions(version, description)
VALUES ('20260817214500', 'Add booked add-ons to cleaner job checklists')
ON CONFLICT DO NOTHING;