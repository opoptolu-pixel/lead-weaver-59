-- Cleanda managed-agency foundation.
-- This migration is intentionally additive: legacy marketplace tables remain intact.

CREATE TABLE public.service_areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
  country_code text NOT NULL DEFAULT 'GB',
  coverage_type text NOT NULL DEFAULT 'admin_district' CHECK (coverage_type IN ('admin_district', 'postcode_district')),
  coverage_values text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.service_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  slug text NOT NULL UNIQUE,
  description text,
  pricing_mode text NOT NULL DEFAULT 'manual_quote' CHECK (pricing_mode IN ('manual_quote', 'fixed', 'hourly')),
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_email_idx ON public.customers (lower(email));
CREATE INDEX customers_phone_idx ON public.customers (phone);

CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  address_line_1 text,
  address_line_2 text,
  city text,
  postcode text NOT NULL,
  service_area_id uuid REFERENCES public.service_areas(id),
  access_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  address_id uuid NOT NULL REFERENCES public.customer_addresses(id),
  service_type_id uuid NOT NULL REFERENCES public.service_types(id),
  service_area_id uuid NOT NULL REFERENCES public.service_areas(id),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'quoted', 'accepted', 'declined', 'lost', 'cancelled')),
  preferred_date_from date,
  preferred_date_to date,
  preferred_time text,
  property_type text,
  bedrooms text,
  bathrooms text,
  frequency text,
  customer_notes text,
  admin_notes text,
  source text,
  utm_data jsonb,
  contacted_at timestamptz,
  qualified_at timestamptz,
  lost_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX service_requests_status_created_idx ON public.service_requests (status, created_at DESC);
CREATE INDEX service_requests_customer_idx ON public.service_requests (customer_id);

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL REFERENCES public.service_requests(id),
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined', 'expired', 'cancelled')),
  customer_amount_pence integer NOT NULL CHECK (customer_amount_pence >= 0),
  cleaner_payout_pence integer NOT NULL CHECK (cleaner_payout_pence >= 0),
  currency text NOT NULL DEFAULT 'GBP',
  valid_until timestamptz,
  notes text,
  sent_at timestamptz,
  accepted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (service_request_id, version),
  CHECK (customer_amount_pence >= cleaner_payout_pence)
);

CREATE TABLE public.cleaner_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  postcode text,
  profile_photo_path text,
  experience_summary text,
  has_transport boolean,
  application_status text NOT NULL DEFAULT 'pending' CHECK (application_status IN ('pending', 'approved', 'rejected')),
  operational_status text NOT NULL DEFAULT 'inactive' CHECK (operational_status IN ('inactive', 'active', 'suspended')),
  verification_status text NOT NULL DEFAULT 'not_started' CHECK (verification_status IN ('not_started', 'pending', 'approved', 'rejected')),
  payout_status text NOT NULL DEFAULT 'not_configured' CHECK (payout_status IN ('not_configured', 'pending', 'ready', 'restricted')),
  admin_notes text,
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cleaner_service_capabilities (
  cleaner_id uuid NOT NULL REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  service_type_id uuid NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
  PRIMARY KEY (cleaner_id, service_type_id)
);

CREATE TABLE public.cleaner_service_areas (
  cleaner_id uuid NOT NULL REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  service_area_id uuid NOT NULL REFERENCES public.service_areas(id) ON DELETE CASCADE,
  PRIMARY KEY (cleaner_id, service_area_id)
);

CREATE TABLE public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  service_request_id uuid NOT NULL UNIQUE REFERENCES public.service_requests(id),
  accepted_quote_id uuid NOT NULL UNIQUE REFERENCES public.quotes(id),
  customer_id uuid NOT NULL REFERENCES public.customers(id),
  address_id uuid NOT NULL REFERENCES public.customer_addresses(id),
  service_type_id uuid NOT NULL REFERENCES public.service_types(id),
  service_area_id uuid NOT NULL REFERENCES public.service_areas(id),
  status text NOT NULL DEFAULT 'awaiting_assignment' CHECK (status IN ('awaiting_assignment', 'offered', 'assigned', 'in_progress', 'completed', 'quality_check', 'closed', 'cancelled', 'issue')),
  general_location text NOT NULL,
  scheduled_date date NOT NULL,
  start_time time,
  expected_duration_minutes integer,
  customer_amount_pence integer NOT NULL CHECK (customer_amount_pence >= 0),
  cleaner_payout_pence integer NOT NULL CHECK (cleaner_payout_pence >= 0),
  currency text NOT NULL DEFAULT 'GBP',
  requirements text,
  internal_notes text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (customer_amount_pence >= cleaner_payout_pence)
);
CREATE INDEX jobs_status_date_idx ON public.jobs (status, scheduled_date);

CREATE TABLE public.job_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  cleaner_id uuid NOT NULL REFERENCES public.cleaner_profiles(id),
  status text NOT NULL DEFAULT 'offered' CHECK (status IN ('offered', 'accepted', 'declined', 'revoked', 'completed')),
  offered_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  response_notes text,
  assigned_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX job_assignments_one_active_idx ON public.job_assignments (job_id)
  WHERE status IN ('offered', 'accepted');

CREATE TABLE public.customer_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id),
  amount_pence integer NOT NULL CHECK (amount_pence >= 0),
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized', 'paid', 'failed', 'partially_refunded', 'refunded')),
  provider text,
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cleaner_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id),
  cleaner_id uuid NOT NULL REFERENCES public.cleaner_profiles(id),
  amount_pence integer NOT NULL CHECK (amount_pence >= 0),
  currency text NOT NULL DEFAULT 'GBP',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processing', 'paid', 'held', 'failed', 'cancelled')),
  provider text,
  provider_reference text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.job_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Service-role-only counter used by public Edge Functions to limit anonymous spam.
CREATE TABLE public.public_submission_rate_limits (
  key_hash text NOT NULL,
  action text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 1 CHECK (request_count > 0),
  PRIMARY KEY (key_hash, action, window_start)
);

-- Updated-at triggers reuse the existing function.
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'service_areas', 'service_types', 'customers', 'customer_addresses',
    'service_requests', 'quotes', 'cleaner_profiles', 'jobs', 'job_assignments',
    'customer_payments', 'cleaner_payouts'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()',
      table_name, table_name
    );
  END LOOP;
END $$;

-- RLS: operational data is admin-managed; cleaners only see their own profile/assignments.
ALTER TABLE public.service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_service_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_service_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_submission_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active service areas" ON public.service_areas FOR SELECT USING (status = 'active');
CREATE POLICY "Public can view active service types" ON public.service_types FOR SELECT USING (is_active);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'service_areas', 'service_types', 'customers', 'customer_addresses',
    'service_requests', 'quotes', 'cleaner_profiles', 'cleaner_service_capabilities',
    'cleaner_service_areas', 'jobs', 'job_assignments', 'customer_payments',
    'cleaner_payouts', 'job_events'
  ] LOOP
    EXECUTE format('CREATE POLICY "Admins manage %s" ON public.%I FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()))', table_name, table_name);
  END LOOP;
END $$;

CREATE POLICY "Cleaners view own profile" ON public.cleaner_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Cleaners view own capabilities" ON public.cleaner_service_capabilities FOR SELECT TO authenticated
  USING (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Cleaners view own service areas" ON public.cleaner_service_areas FOR SELECT TO authenticated
  USING (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Cleaners view own assignments" ON public.job_assignments FOR SELECT TO authenticated
  USING (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Cleaners view offered or assigned jobs" ON public.jobs FOR SELECT TO authenticated
  USING (id IN (
    SELECT ja.job_id FROM public.job_assignments ja
    JOIN public.cleaner_profiles cp ON cp.id = ja.cleaner_id
    WHERE cp.user_id = auth.uid() AND ja.status IN ('offered', 'accepted', 'completed')
  ));

CREATE POLICY "Accepted cleaners view job customers" ON public.customers FOR SELECT TO authenticated
  USING (id IN (
    SELECT j.customer_id FROM public.jobs j
    JOIN public.job_assignments ja ON ja.job_id = j.id
    JOIN public.cleaner_profiles cp ON cp.id = ja.cleaner_id
    WHERE cp.user_id = auth.uid() AND ja.status IN ('accepted', 'completed')
  ));
CREATE POLICY "Accepted cleaners view job addresses" ON public.customer_addresses FOR SELECT TO authenticated
  USING (id IN (
    SELECT j.address_id FROM public.jobs j
    JOIN public.job_assignments ja ON ja.job_id = j.id
    JOIN public.cleaner_profiles cp ON cp.id = ja.cleaner_id
    WHERE cp.user_id = auth.uid() AND ja.status IN ('accepted', 'completed')
  ));

CREATE OR REPLACE FUNCTION public.respond_to_job_assignment(
  p_assignment_id uuid,
  p_response text,
  p_notes text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  IF p_response NOT IN ('accepted', 'declined') THEN
    RAISE EXCEPTION 'Invalid assignment response';
  END IF;

  UPDATE public.job_assignments ja
  SET status = p_response,
      responded_at = now(),
      response_notes = left(p_notes, 1000),
      updated_at = now()
  FROM public.cleaner_profiles cp
  WHERE ja.id = p_assignment_id
    AND ja.cleaner_id = cp.id
    AND cp.user_id = auth.uid()
    AND ja.status = 'offered'
  RETURNING ja.job_id INTO v_job_id;

  IF v_job_id IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.jobs
  SET status = CASE WHEN p_response = 'accepted' THEN 'assigned' ELSE 'awaiting_assignment' END,
      updated_at = now()
  WHERE id = v_job_id;

  INSERT INTO public.job_events (job_id, actor_user_id, event_type, details)
  VALUES (v_job_id, auth.uid(), 'cleaner_' || p_response, jsonb_build_object('assignment_id', p_assignment_id));

  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_job_assignment(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_job_assignment(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_assigned_job(p_assignment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
BEGIN
  SELECT ja.job_id INTO v_job_id
  FROM public.job_assignments ja
  JOIN public.cleaner_profiles cp ON cp.id = ja.cleaner_id
  JOIN public.jobs j ON j.id = ja.job_id
  WHERE ja.id = p_assignment_id
    AND cp.user_id = auth.uid()
    AND ja.status = 'accepted'
    AND j.status IN ('assigned', 'in_progress');

  IF v_job_id IS NULL THEN RETURN false; END IF;

  UPDATE public.job_assignments SET status = 'completed', updated_at = now() WHERE id = p_assignment_id;
  UPDATE public.jobs SET status = 'quality_check', completed_at = now(), updated_at = now() WHERE id = v_job_id;
  INSERT INTO public.job_events (job_id, actor_user_id, event_type)
  VALUES (v_job_id, auth.uid(), 'cleaner_marked_complete');
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_assigned_job(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_assigned_job(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_public_submission_rate_limit(
  p_key_hash text,
  p_action text,
  p_max_requests integer DEFAULT 10,
  p_window_minutes integer DEFAULT 60
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start timestamptz;
  v_request_count integer;
BEGIN
  IF p_key_hash IS NULL OR length(p_key_hash) < 16 OR p_action IS NULL OR p_window_minutes < 1 THEN
    RETURN false;
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM now()) / (p_window_minutes * 60)) * (p_window_minutes * 60)
  );

  INSERT INTO public.public_submission_rate_limits (key_hash, action, window_start, request_count)
  VALUES (p_key_hash, p_action, v_window_start, 1)
  ON CONFLICT (key_hash, action, window_start)
  DO UPDATE SET request_count = public.public_submission_rate_limits.request_count + 1
  RETURNING request_count INTO v_request_count;

  DELETE FROM public.public_submission_rate_limits
  WHERE window_start < now() - interval '2 days';

  RETURN v_request_count <= p_max_requests;
END;
$$;

REVOKE ALL ON FUNCTION public.check_public_submission_rate_limit(text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_public_submission_rate_limit(text, text, integer, integer) TO service_role;

-- Greater Manchester is defined by its ten local-authority districts. Full postcodes
-- are resolved through postcodes.io before requests are accepted.
INSERT INTO public.service_areas (name, slug, status, coverage_type, coverage_values)
VALUES (
  'Greater Manchester',
  'greater-manchester',
  'active',
  'admin_district',
  ARRAY['Manchester','Salford','Trafford','Stockport','Tameside','Oldham','Rochdale','Bury','Bolton','Wigan']
);

INSERT INTO public.service_types (name, slug, pricing_mode, sort_order) VALUES
  ('End of Tenancy Cleaning', 'end-of-tenancy', 'manual_quote', 10),
  ('Move-In / Move-Out Cleaning', 'move-in-move-out', 'manual_quote', 20),
  ('One-Off Deep Cleaning', 'one-off-deep', 'manual_quote', 30),
  ('Weekly Routine Cleaning', 'weekly-routine', 'manual_quote', 40),
  ('Post-Construction Deep Cleaning', 'post-construction', 'manual_quote', 50),
  ('Airbnb / Short-Let Cleaning', 'airbnb-short-let', 'manual_quote', 60);