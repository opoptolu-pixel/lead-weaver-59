ALTER TABLE public.recurring_clean_plans
  ADD COLUMN IF NOT EXISTS billing_frequency text,
  ADD COLUMN IF NOT EXISTS next_billing_date date;

UPDATE public.recurring_clean_plans
SET billing_frequency = CASE
  WHEN frequency IN ('weekly', 'fortnightly', 'monthly') THEN frequency
  ELSE 'monthly'
END,
    next_billing_date = COALESCE(next_billing_date, next_visit_date)
WHERE billing_frequency IS NULL OR next_billing_date IS NULL;

ALTER TABLE public.recurring_clean_plans
  ALTER COLUMN billing_frequency SET NOT NULL,
  ALTER COLUMN next_billing_date SET NOT NULL;

ALTER TABLE public.recurring_clean_plans
  DROP CONSTRAINT IF EXISTS recurring_clean_plans_billing_frequency_check;
ALTER TABLE public.recurring_clean_plans
  ADD CONSTRAINT recurring_clean_plans_billing_frequency_check
  CHECK (billing_frequency IN ('weekly', 'fortnightly', 'monthly'));

CREATE INDEX IF NOT EXISTS recurring_clean_plans_billing_due_idx
  ON public.recurring_clean_plans(status, next_billing_date);

CREATE TABLE IF NOT EXISTS public.recurring_clean_billing_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.recurring_clean_plans(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  scheduled_charge_date date NOT NULL,
  amount_pence integer NOT NULL CHECK (amount_pence >= 0),
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','processing','paid','payment_failed','cancelled')),
  payment_intent_id text UNIQUE,
  payment_attempts integer NOT NULL DEFAULT 0,
  paid_at timestamptz,
  last_payment_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, period_start),
  CHECK (period_end >= period_start)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_clean_billing_cycles TO authenticated;
GRANT ALL ON public.recurring_clean_billing_cycles TO service_role;

CREATE INDEX IF NOT EXISTS recurring_clean_billing_cycles_due_idx
  ON public.recurring_clean_billing_cycles(status, scheduled_charge_date);

ALTER TABLE public.recurring_clean_visits
  ADD COLUMN IF NOT EXISTS billing_cycle_id uuid REFERENCES public.recurring_clean_billing_cycles(id);
ALTER TABLE public.customer_payments
  ADD COLUMN IF NOT EXISTS recurring_billing_cycle_id uuid REFERENCES public.recurring_clean_billing_cycles(id);

ALTER TABLE public.recurring_clean_billing_cycles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage recurring clean billing cycles" ON public.recurring_clean_billing_cycles;
CREATE POLICY "Admins manage recurring clean billing cycles"
  ON public.recurring_clean_billing_cycles FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS update_recurring_clean_billing_cycles_updated_at ON public.recurring_clean_billing_cycles;
CREATE TRIGGER update_recurring_clean_billing_cycles_updated_at
  BEFORE UPDATE ON public.recurring_clean_billing_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS agency_audit_recurring_clean_billing_cycles ON public.recurring_clean_billing_cycles;
CREATE TRIGGER agency_audit_recurring_clean_billing_cycles
  AFTER INSERT OR UPDATE OR DELETE ON public.recurring_clean_billing_cycles
  FOR EACH ROW EXECUTE FUNCTION public.capture_agency_audit_event();

DROP FUNCTION IF EXISTS public.create_recurring_clean_plan(uuid,uuid,uuid,uuid,text,date,time,integer,integer,integer,integer,integer,integer,text,text);
CREATE FUNCTION public.create_recurring_clean_plan(
  p_customer_id uuid, p_address_id uuid, p_service_type_id uuid, p_service_area_id uuid,
  p_frequency text, p_billing_frequency text, p_start_date date, p_start_time time,
  p_expected_duration_minutes integer, p_customer_amount_pence integer, p_cleaner_payout_pence integer,
  p_weekday integer DEFAULT NULL, p_month_day integer DEFAULT NULL,
  p_payment_collection_days_before integer DEFAULT 3, p_requirements text DEFAULT NULL,
  p_internal_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_frequency NOT IN ('weekly','fortnightly','monthly') THEN RAISE EXCEPTION 'Choose weekly, fortnightly or monthly attendance'; END IF;
  IF p_billing_frequency NOT IN ('weekly','fortnightly','monthly') THEN RAISE EXCEPTION 'Choose weekly, fortnightly or monthly billing'; END IF;
  IF p_expected_duration_minutes < 30 OR p_customer_amount_pence < p_cleaner_payout_pence THEN RAISE EXCEPTION 'Plan amounts or duration are invalid'; END IF;
  IF (p_frequency='monthly' AND (p_month_day IS NULL OR p_month_day NOT BETWEEN 1 AND 31)) OR
     (p_frequency<>'monthly' AND (p_weekday IS NULL OR p_weekday NOT BETWEEN 0 AND 6)) THEN
    RAISE EXCEPTION 'The selected attendance day is invalid';
  END IF;
  INSERT INTO public.recurring_clean_plans(
    customer_id,address_id,service_type_id,service_area_id,frequency,billing_frequency,interval_count,weekday,month_day,
    start_date,next_visit_date,next_billing_date,start_time,expected_duration_minutes,customer_amount_pence,cleaner_payout_pence,
    payment_collection_days_before,requirements,internal_notes,created_by
  ) VALUES (
    p_customer_id,p_address_id,p_service_type_id,p_service_area_id,p_frequency,p_billing_frequency,
    CASE WHEN p_frequency='fortnightly' THEN 2 ELSE 1 END,p_weekday,p_month_day,
    p_start_date,p_start_date,p_start_date,p_start_time,p_expected_duration_minutes,p_customer_amount_pence,p_cleaner_payout_pence,
    p_payment_collection_days_before,nullif(trim(p_requirements),''),nullif(trim(p_internal_notes),''),auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_recurring_clean_plan(uuid,uuid,uuid,uuid,text,text,date,time,integer,integer,integer,integer,integer,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_recurring_clean_plan(uuid,uuid,uuid,uuid,text,text,date,time,integer,integer,integer,integer,integer,integer,text,text) TO authenticated;

INSERT INTO public.platform_schema_versions(version,description)
VALUES ('20260820170000','Separates recurring cleaner attendance from customer billing cycles')
ON CONFLICT(version) DO UPDATE SET description=excluded.description;
NOTIFY pgrst,'reload schema';