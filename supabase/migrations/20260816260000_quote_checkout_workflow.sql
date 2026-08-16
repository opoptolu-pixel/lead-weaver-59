-- Quote delivery and payment-confirmed job creation for the managed agency.
ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS address_id uuid REFERENCES public.customer_addresses(id),
  ADD COLUMN IF NOT EXISTS scheduled_date date,
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS expected_duration_minutes integer,
  ADD COLUMN IF NOT EXISTS requirements text,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS payment_link_sent_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS quotes_stripe_session_unique ON public.quotes(stripe_checkout_session_id) WHERE stripe_checkout_session_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.finalize_agency_quote_payment(p_quote_id uuid,p_payment_reference text,p_payment_intent_id text DEFAULT NULL,p_provider text DEFAULT 'stripe')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_quote public.quotes%ROWTYPE; v_request public.service_requests%ROWTYPE; v_job_id uuid; v_area_id uuid; v_postcode text;
BEGIN
  IF auth.role()<>'service_role' AND NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Service or admin access required'; END IF;
  SELECT * INTO v_quote FROM public.quotes WHERE id=p_quote_id FOR UPDATE;
  IF v_quote.id IS NULL THEN RAISE EXCEPTION 'Quote not found'; END IF;
  IF p_provider NOT IN ('stripe','bank_transfer','card_terminal','cash','other') THEN RAISE EXCEPTION 'Unsupported payment provider'; END IF;
  IF nullif(btrim(p_payment_reference),'') IS NULL THEN RAISE EXCEPTION 'Payment reference is required'; END IF;
  SELECT id INTO v_job_id FROM public.jobs WHERE accepted_quote_id=p_quote_id;
  IF v_job_id IS NOT NULL THEN RETURN v_job_id; END IF;
  IF v_quote.status NOT IN ('sent','accepted') THEN RAISE EXCEPTION 'Quote is not payable'; END IF;
  IF v_quote.valid_until IS NOT NULL AND v_quote.valid_until<now() THEN RAISE EXCEPTION 'Quote has expired'; END IF;
  IF v_quote.address_id IS NULL OR v_quote.scheduled_date IS NULL OR v_quote.expected_duration_minutes IS NULL THEN RAISE EXCEPTION 'Quote booking details are incomplete'; END IF;
  SELECT * INTO v_request FROM public.service_requests WHERE id=v_quote.service_request_id FOR UPDATE;
  SELECT postcode INTO v_postcode FROM public.customer_addresses WHERE id=v_quote.address_id;
  SELECT id INTO v_area_id FROM public.service_areas WHERE slug='greater-manchester' LIMIT 1;
  INSERT INTO public.jobs(reference,service_request_id,accepted_quote_id,customer_id,address_id,service_type_id,service_area_id,scheduled_date,start_time,expected_duration_minutes,general_location,customer_amount_pence,cleaner_payout_pence,requirements)
  VALUES('JOB-'||to_char(now(),'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),v_request.id,v_quote.id,v_request.customer_id,v_quote.address_id,v_request.service_type_id,v_area_id,v_quote.scheduled_date,v_quote.start_time,v_quote.expected_duration_minutes,split_part(v_postcode,' ',1),v_quote.customer_amount_pence,v_quote.cleaner_payout_pence,v_quote.requirements) RETURNING id INTO v_job_id;
  UPDATE public.quotes SET status='accepted',accepted_at=now(),stripe_checkout_session_id=CASE WHEN p_provider='stripe' THEN p_payment_reference ELSE stripe_checkout_session_id END,updated_at=now() WHERE id=p_quote_id;
  UPDATE public.service_requests SET status='accepted',updated_at=now() WHERE id=v_request.id;
  INSERT INTO public.customer_payments(job_id,amount_pence,status,provider,provider_reference,paid_at)
    VALUES(v_job_id,v_quote.customer_amount_pence,'paid',p_provider,coalesce(p_payment_intent_id,p_payment_reference),now());
  INSERT INTO public.job_events(job_id,event_type,details) VALUES(v_job_id,'job_created_after_payment',jsonb_build_object('quote_id',p_quote_id,'provider',p_provider,'payment_reference',p_payment_reference,'payment_intent_id',p_payment_intent_id));
  RETURN v_job_id;
END $$;
REVOKE ALL ON FUNCTION public.finalize_agency_quote_payment(uuid,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.finalize_agency_quote_payment(uuid,text,text,text) TO authenticated,service_role;
INSERT INTO public.platform_schema_versions(version,description) VALUES('20260816260000','Quote email, Stripe checkout and payment-confirmed jobs') ON CONFLICT(version) DO UPDATE SET description=excluded.description;
NOTIFY pgrst,'reload schema';
