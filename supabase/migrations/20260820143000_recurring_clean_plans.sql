-- Recurring managed-clean plans. Each occurrence remains a normal Cleanda job,
-- payment and payout so scheduling, quality, refunds and audit history stay intact.

CREATE TABLE IF NOT EXISTS public.recurring_clean_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  address_id uuid NOT NULL REFERENCES public.customer_addresses(id),
  service_type_id uuid NOT NULL REFERENCES public.service_types(id),
  service_area_id uuid NOT NULL REFERENCES public.service_areas(id),
  status text NOT NULL DEFAULT 'payment_setup_required'
    CHECK (status IN ('payment_setup_required','active','paused','payment_failed','cancelled')),
  frequency text NOT NULL CHECK (frequency IN ('weekly','fortnightly','monthly')),
  interval_count integer NOT NULL DEFAULT 1 CHECK (interval_count BETWEEN 1 AND 12),
  weekday integer CHECK (weekday BETWEEN 0 AND 6),
  month_day integer CHECK (month_day BETWEEN 1 AND 31),
  start_date date NOT NULL,
  next_visit_date date NOT NULL,
  start_time time,
  expected_duration_minutes integer NOT NULL CHECK (expected_duration_minutes BETWEEN 30 AND 1440),
  customer_amount_pence integer NOT NULL CHECK (customer_amount_pence >= 0),
  cleaner_payout_pence integer NOT NULL CHECK (cleaner_payout_pence >= 0),
  currency text NOT NULL DEFAULT 'GBP',
  payment_collection_days_before integer NOT NULL DEFAULT 3 CHECK (payment_collection_days_before BETWEEN 0 AND 14),
  requirements text,
  internal_notes text,
  stripe_customer_id text,
  stripe_payment_method_id text,
  payment_setup_status text NOT NULL DEFAULT 'not_started'
    CHECK (payment_setup_status IN ('not_started','link_sent','ready','failed','revoked')),
  payment_setup_sent_at timestamptz,
  payment_setup_completed_at timestamptz,
  paused_at timestamptz,
  cancelled_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (customer_amount_pence >= cleaner_payout_pence),
  CHECK ((frequency = 'monthly' AND month_day IS NOT NULL) OR (frequency <> 'monthly' AND weekday IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS recurring_clean_plans_due_idx ON public.recurring_clean_plans(status,next_visit_date);
CREATE INDEX IF NOT EXISTS recurring_clean_plans_customer_idx ON public.recurring_clean_plans(customer_id,status);

CREATE TABLE IF NOT EXISTS public.recurring_clean_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES public.recurring_clean_plans(id) ON DELETE CASCADE,
  occurrence_number integer NOT NULL,
  scheduled_date date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','processing','paid','payment_failed','skipped','cancelled')),
  service_request_id uuid UNIQUE REFERENCES public.service_requests(id),
  quote_id uuid UNIQUE REFERENCES public.quotes(id),
  job_id uuid UNIQUE REFERENCES public.jobs(id),
  payment_intent_id text UNIQUE,
  payment_attempts integer NOT NULL DEFAULT 0,
  last_payment_error text,
  charged_at timestamptz,
  skipped_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(plan_id, scheduled_date),
  UNIQUE(plan_id, occurrence_number)
);
CREATE INDEX IF NOT EXISTS recurring_clean_visits_due_idx ON public.recurring_clean_visits(status,scheduled_date);

-- Keep recurring payment tokens out of the operational audit trail while still
-- recording plan and visit changes.
CREATE OR REPLACE FUNCTION public.agency_audit_redact(payload jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(payload, '{}'::jsonb) - ARRAY[
    'account_number','bank_account','bank_account_number','bank_account_holder',
    'sort_code','bank_sort_code','right_to_work_share_code','date_of_birth',
    'file_path','storage_path','provider_reference','provider_payment_id','metadata',
    'stripe_customer_id','stripe_payment_method_id','payment_intent_id'
  ];
$$;

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS recurring_plan_id uuid REFERENCES public.recurring_clean_plans(id);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS recurring_visit_id uuid UNIQUE REFERENCES public.recurring_clean_visits(id);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS recurring_plan_id uuid REFERENCES public.recurring_clean_plans(id);
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS recurring_visit_id uuid UNIQUE REFERENCES public.recurring_clean_visits(id);
ALTER TABLE public.customer_payments ADD COLUMN IF NOT EXISTS recurring_visit_id uuid UNIQUE REFERENCES public.recurring_clean_visits(id);

ALTER TABLE public.recurring_clean_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_clean_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage recurring clean plans" ON public.recurring_clean_plans FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Admins manage recurring clean visits" ON public.recurring_clean_visits FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP TRIGGER IF EXISTS update_recurring_clean_plans_updated_at ON public.recurring_clean_plans;
CREATE TRIGGER update_recurring_clean_plans_updated_at BEFORE UPDATE ON public.recurring_clean_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_recurring_clean_visits_updated_at ON public.recurring_clean_visits;
CREATE TRIGGER update_recurring_clean_visits_updated_at BEFORE UPDATE ON public.recurring_clean_visits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS agency_audit_recurring_clean_plans ON public.recurring_clean_plans;
CREATE TRIGGER agency_audit_recurring_clean_plans AFTER INSERT OR UPDATE OR DELETE ON public.recurring_clean_plans FOR EACH ROW EXECUTE FUNCTION public.capture_agency_audit_event();
DROP TRIGGER IF EXISTS agency_audit_recurring_clean_visits ON public.recurring_clean_visits;
CREATE TRIGGER agency_audit_recurring_clean_visits AFTER INSERT OR UPDATE OR DELETE ON public.recurring_clean_visits FOR EACH ROW EXECUTE FUNCTION public.capture_agency_audit_event();

CREATE OR REPLACE FUNCTION public.create_recurring_clean_plan(
  p_customer_id uuid, p_address_id uuid, p_service_type_id uuid, p_service_area_id uuid,
  p_frequency text, p_start_date date, p_start_time time, p_expected_duration_minutes integer,
  p_customer_amount_pence integer, p_cleaner_payout_pence integer,
  p_weekday integer DEFAULT NULL, p_month_day integer DEFAULT NULL,
  p_payment_collection_days_before integer DEFAULT 3, p_requirements text DEFAULT NULL,
  p_internal_notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_frequency NOT IN ('weekly','fortnightly','monthly') THEN RAISE EXCEPTION 'Choose weekly, fortnightly or monthly'; END IF;
  IF p_expected_duration_minutes < 30 OR p_customer_amount_pence < p_cleaner_payout_pence THEN RAISE EXCEPTION 'Plan amounts or duration are invalid'; END IF;
  IF (p_frequency='monthly' AND (p_month_day IS NULL OR p_month_day NOT BETWEEN 1 AND 31)) OR
     (p_frequency<>'monthly' AND (p_weekday IS NULL OR p_weekday NOT BETWEEN 0 AND 6)) THEN
    RAISE EXCEPTION 'The selected recurrence day is invalid';
  END IF;
  INSERT INTO public.recurring_clean_plans(
    customer_id,address_id,service_type_id,service_area_id,frequency,interval_count,weekday,month_day,
    start_date,next_visit_date,start_time,expected_duration_minutes,customer_amount_pence,cleaner_payout_pence,
    payment_collection_days_before,requirements,internal_notes,created_by
  ) VALUES (
    p_customer_id,p_address_id,p_service_type_id,p_service_area_id,p_frequency,
    CASE WHEN p_frequency='fortnightly' THEN 2 ELSE 1 END,p_weekday,p_month_day,
    p_start_date,p_start_date,p_start_time,p_expected_duration_minutes,p_customer_amount_pence,p_cleaner_payout_pence,
    p_payment_collection_days_before,nullif(trim(p_requirements),''),nullif(trim(p_internal_notes),''),auth.uid()
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_recurring_clean_plan(uuid,uuid,uuid,uuid,text,date,time,integer,integer,integer,integer,integer,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_recurring_clean_plan(uuid,uuid,uuid,uuid,text,date,time,integer,integer,integer,integer,integer,integer,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.pause_recurring_clean_plan(p_plan_id uuid, p_paused boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  UPDATE public.recurring_clean_plans
  SET status=CASE WHEN p_paused THEN 'paused' ELSE CASE WHEN payment_setup_status='ready' THEN 'active' ELSE 'payment_setup_required' END END,
      paused_at=CASE WHEN p_paused THEN now() ELSE NULL END, updated_at=now()
  WHERE id=p_plan_id AND status <> 'cancelled';
  IF NOT FOUND THEN RAISE EXCEPTION 'Recurring plan not found or cancelled'; END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.pause_recurring_clean_plan(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pause_recurring_clean_plan(uuid,boolean) TO authenticated;

INSERT INTO public.platform_schema_versions(version,description)
VALUES ('20260820143000','Recurring managed-clean plans, visits and safe per-occurrence payment records')
ON CONFLICT (version) DO UPDATE SET description=excluded.description;
NOTIFY pgrst,'reload schema';
