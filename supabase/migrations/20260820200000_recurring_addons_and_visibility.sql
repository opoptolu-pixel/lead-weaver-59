-- Keep recurring add-ons as immutable plan snapshots, then copy them onto
-- each generated visit quote. This makes the cleaner checklist, payout and
-- customer charge agree even if the live add-on catalogue changes later.

CREATE TABLE IF NOT EXISTS public.recurring_clean_plan_addons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.recurring_clean_plans(id) ON DELETE CASCADE,
  addon_id uuid REFERENCES public.service_addons(id),
  addon_code text NOT NULL,
  addon_name text NOT NULL,
  category text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_customer_price_pence integer NOT NULL CHECK (unit_customer_price_pence >= 0),
  unit_cleaner_payout_pence integer NOT NULL CHECK (unit_cleaner_payout_pence >= 0),
  unit_duration_minutes integer NOT NULL DEFAULT 0 CHECK (unit_duration_minutes >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, addon_id),
  CHECK (unit_customer_price_pence >= unit_cleaner_payout_pence)
);

CREATE INDEX IF NOT EXISTS recurring_clean_plan_addons_plan_id_idx
  ON public.recurring_clean_plan_addons(plan_id);

ALTER TABLE public.recurring_clean_plan_addons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage recurring plan add-ons" ON public.recurring_clean_plan_addons;
CREATE POLICY "Admins manage recurring plan add-ons" ON public.recurring_clean_plan_addons
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP FUNCTION IF EXISTS public.create_recurring_clean_plan(uuid,uuid,uuid,uuid,text,text,date,time,integer,integer,integer,integer,integer,integer,text,text);
CREATE FUNCTION public.create_recurring_clean_plan(
  p_customer_id uuid, p_address_id uuid, p_service_type_id uuid, p_service_area_id uuid,
  p_frequency text, p_billing_frequency text, p_start_date date, p_start_time time,
  p_expected_duration_minutes integer, p_customer_amount_pence integer, p_cleaner_payout_pence integer,
  p_weekday integer DEFAULT NULL, p_month_day integer DEFAULT NULL,
  p_payment_collection_days_before integer DEFAULT 3, p_requirements text DEFAULT NULL,
  p_internal_notes text DEFAULT NULL, p_addons jsonb DEFAULT '[]'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_id uuid;
  v_addon_customer_amount integer := 0;
  v_addon_cleaner_payout integer := 0;
  v_addon_duration integer := 0;
  v_requested_count integer := 0;
  v_valid_count integer := 0;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_frequency NOT IN ('weekly','fortnightly','monthly') THEN RAISE EXCEPTION 'Choose weekly, fortnightly or monthly attendance'; END IF;
  IF p_billing_frequency NOT IN ('weekly','fortnightly','monthly') THEN RAISE EXCEPTION 'Choose weekly, fortnightly or monthly billing'; END IF;
  IF p_expected_duration_minutes < 30 OR p_customer_amount_pence < p_cleaner_payout_pence THEN RAISE EXCEPTION 'Plan amounts or duration are invalid'; END IF;
  IF (p_frequency='monthly' AND (p_month_day IS NULL OR p_month_day NOT BETWEEN 1 AND 31)) OR
     (p_frequency<>'monthly' AND (p_weekday IS NULL OR p_weekday NOT BETWEEN 0 AND 6)) THEN
    RAISE EXCEPTION 'The selected attendance day is invalid';
  END IF;
  IF jsonb_typeof(coalesce(p_addons, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'Recurring add-ons must be an array'; END IF;

  WITH requested AS (
    SELECT addon_id, quantity
    FROM jsonb_to_recordset(coalesce(p_addons, '[]'::jsonb)) AS item(addon_id uuid, quantity integer)
  ), aggregated AS (
    SELECT addon_id, sum(quantity)::integer AS quantity
    FROM requested
    WHERE addon_id IS NOT NULL AND quantity > 0
    GROUP BY addon_id
  )
  SELECT count(*) INTO v_requested_count FROM aggregated;

  WITH requested AS (
    SELECT addon_id, quantity
    FROM jsonb_to_recordset(coalesce(p_addons, '[]'::jsonb)) AS item(addon_id uuid, quantity integer)
  ), aggregated AS (
    SELECT addon_id, sum(quantity)::integer AS quantity
    FROM requested WHERE addon_id IS NOT NULL AND quantity > 0 GROUP BY addon_id
  )
  SELECT count(*), coalesce(sum(sa.customer_price_pence * aggregated.quantity), 0),
         coalesce(sum(sa.cleaner_payout_pence * aggregated.quantity), 0),
         coalesce(sum(sa.duration_minutes * aggregated.quantity), 0)
  INTO v_valid_count, v_addon_customer_amount, v_addon_cleaner_payout, v_addon_duration
  FROM aggregated JOIN public.service_addons sa ON sa.id = aggregated.addon_id
  WHERE sa.is_active AND aggregated.quantity <= sa.max_quantity;

  IF v_requested_count <> v_valid_count THEN RAISE EXCEPTION 'One or more selected add-ons are unavailable or exceed their quantity limit'; END IF;

  INSERT INTO public.recurring_clean_plans(
    customer_id,address_id,service_type_id,service_area_id,frequency,billing_frequency,interval_count,weekday,month_day,
    start_date,next_visit_date,next_billing_date,start_time,expected_duration_minutes,customer_amount_pence,cleaner_payout_pence,
    payment_collection_days_before,requirements,internal_notes,created_by
  ) VALUES (
    p_customer_id,p_address_id,p_service_type_id,p_service_area_id,p_frequency,p_billing_frequency,
    CASE WHEN p_frequency='fortnightly' THEN 2 ELSE 1 END,p_weekday,p_month_day,
    p_start_date,p_start_date,p_start_date,p_start_time,p_expected_duration_minutes + v_addon_duration,
    p_customer_amount_pence + v_addon_customer_amount,p_cleaner_payout_pence + v_addon_cleaner_payout,
    p_payment_collection_days_before,nullif(trim(p_requirements),''),nullif(trim(p_internal_notes),''),auth.uid()
  ) RETURNING id INTO v_id;

  INSERT INTO public.recurring_clean_plan_addons(
    plan_id,addon_id,addon_code,addon_name,category,quantity,unit_customer_price_pence,unit_cleaner_payout_pence,unit_duration_minutes
  )
  WITH requested AS (
    SELECT addon_id, quantity
    FROM jsonb_to_recordset(coalesce(p_addons, '[]'::jsonb)) AS item(addon_id uuid, quantity integer)
  ), aggregated AS (
    SELECT addon_id, sum(quantity)::integer AS quantity
    FROM requested WHERE addon_id IS NOT NULL AND quantity > 0 GROUP BY addon_id
  )
  SELECT v_id, sa.id, sa.code, sa.name, sa.category, aggregated.quantity,
         sa.customer_price_pence, sa.cleaner_payout_pence, sa.duration_minutes
  FROM aggregated JOIN public.service_addons sa ON sa.id = aggregated.addon_id
  WHERE sa.is_active AND aggregated.quantity <= sa.max_quantity;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_recurring_clean_plan(uuid,uuid,uuid,uuid,text,text,date,time,integer,integer,integer,integer,integer,integer,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_recurring_clean_plan(uuid,uuid,uuid,uuid,text,text,date,time,integer,integer,integer,integer,integer,integer,text,text,jsonb) TO authenticated;

INSERT INTO public.platform_schema_versions(version,description)
VALUES ('20260820200000','Recurring plan add-on snapshots copied to every generated visit')
ON CONFLICT(version) DO UPDATE SET description=excluded.description;
NOTIFY pgrst,'reload schema';
