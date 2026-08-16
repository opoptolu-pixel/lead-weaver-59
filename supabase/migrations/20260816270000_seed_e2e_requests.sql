-- Ten non-production-labelled requests for exercising the complete agency flow.
-- Re-running this migration is safe: the fixed references prevent duplicates.
DO $$
DECLARE
  v_customer_id uuid;
  v_address_id uuid;
  v_area_id uuid;
  v_service_type_id uuid;
  v_index integer;
BEGIN
  SELECT id
    INTO v_customer_id
    FROM public.customers
   ORDER BY created_at
   LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Cannot seed E2E requests: no existing test customer found';
  END IF;

  SELECT id
    INTO v_address_id
    FROM public.customer_addresses
   WHERE customer_id = v_customer_id
   ORDER BY created_at
   LIMIT 1;

  IF v_address_id IS NULL THEN
    RAISE EXCEPTION 'Cannot seed E2E requests: the test customer has no address';
  END IF;

  SELECT id
    INTO v_area_id
    FROM public.service_areas
   WHERE slug = 'greater-manchester'
   LIMIT 1;

  IF v_area_id IS NULL THEN
    RAISE EXCEPTION 'Cannot seed E2E requests: Greater Manchester service area is missing';
  END IF;

  FOR v_index IN 1..10 LOOP
    SELECT id
      INTO v_service_type_id
      FROM public.service_types
     WHERE is_active = true
     ORDER BY sort_order, name
     OFFSET ((v_index - 1) % 6)
     LIMIT 1;

    IF v_service_type_id IS NULL THEN
      RAISE EXCEPTION 'Cannot seed E2E requests: active service types are missing';
    END IF;

    INSERT INTO public.service_requests (
      reference,
      customer_id,
      address_id,
      service_type_id,
      service_area_id,
      status,
      preferred_date_from,
      preferred_date_to,
      preferred_time,
      property_type,
      bedrooms,
      bathrooms,
      frequency,
      customer_notes,
      admin_notes,
      source,
      utm_data,
      created_at,
      updated_at
    ) VALUES (
      'TEST-E2E-20260816-' || lpad(v_index::text, 2, '0'),
      v_customer_id,
      v_address_id,
      v_service_type_id,
      v_area_id,
      'new',
      current_date + (v_index + 2),
      current_date + (v_index + 4),
      CASE (v_index % 3)
        WHEN 0 THEN 'Morning'
        WHEN 1 THEN 'Afternoon'
        ELSE 'Flexible'
      END,
      CASE (v_index % 4)
        WHEN 0 THEN 'Flat'
        WHEN 1 THEN 'Terraced house'
        WHEN 2 THEN 'Semi-detached house'
        ELSE 'Apartment'
      END,
      ((v_index % 4) + 1)::text,
      ((v_index % 2) + 1)::text,
      CASE WHEN v_index % 3 = 0 THEN 'weekly' ELSE 'one_off' END,
      'E2E TEST REQUEST ' || lpad(v_index::text, 2, '0') ||
        ' — safe test data for quote, payment, scheduling and cleaner workflow checks.',
      'TEST DATA — do not treat as a live customer booking.',
      'e2e_test_seed',
      jsonb_build_object('test_data', true, 'seed_batch', '20260816-agency-e2e'),
      now() - make_interval(mins => 11 - v_index),
      now()
    )
    ON CONFLICT (reference) DO NOTHING;
  END LOOP;
END $$;

INSERT INTO public.platform_schema_versions(version, description)
VALUES ('20260816270000', 'Seed ten labelled agency end-to-end test requests')
ON CONFLICT (version) DO UPDATE SET description = excluded.description;

NOTIFY pgrst, 'reload schema';
