-- Weekly cleaner payments paid by Cleanda through business-bank transfers.
ALTER TABLE public.cleaner_profiles
  ADD COLUMN IF NOT EXISTS bank_account_holder text,
  ADD COLUMN IF NOT EXISTS bank_sort_code_last2 text,
  ADD COLUMN IF NOT EXISTS bank_account_last4 text,
  ADD COLUMN IF NOT EXISTS bank_details_status text NOT NULL DEFAULT 'not_provided';

ALTER TABLE public.cleaner_profiles DROP CONSTRAINT IF EXISTS cleaner_bank_details_status_check;
ALTER TABLE public.cleaner_profiles ADD CONSTRAINT cleaner_bank_details_status_check
  CHECK (bank_details_status IN ('not_provided','pending_review','verified','rejected'));

ALTER TABLE public.cleaner_payouts
  ADD COLUMN IF NOT EXISTS earning_week_start date,
  ADD COLUMN IF NOT EXISTS scheduled_pay_date date,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS held_reason text,
  ADD COLUMN IF NOT EXISTS bank_transfer_reference text;

UPDATE public.cleaner_payouts cp
SET earning_week_start = date_trunc('week', j.scheduled_date::timestamp)::date,
    scheduled_pay_date = (date_trunc('week', j.scheduled_date::timestamp)::date + 11)
FROM public.jobs j
WHERE j.id = cp.job_id
  AND (cp.earning_week_start IS NULL OR cp.scheduled_pay_date IS NULL);

CREATE OR REPLACE FUNCTION public.set_cleaner_payout_week()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_job_date date;
BEGIN
  SELECT scheduled_date INTO v_job_date FROM public.jobs WHERE id = NEW.job_id;
  NEW.earning_week_start := COALESCE(NEW.earning_week_start, date_trunc('week', v_job_date::timestamp)::date);
  NEW.scheduled_pay_date := COALESCE(NEW.scheduled_pay_date, NEW.earning_week_start + 11);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS set_cleaner_payout_week_trigger ON public.cleaner_payouts;
CREATE TRIGGER set_cleaner_payout_week_trigger
BEFORE INSERT OR UPDATE OF job_id ON public.cleaner_payouts
FOR EACH ROW EXECUTE FUNCTION public.set_cleaner_payout_week();

CREATE OR REPLACE FUNCTION public.mark_cleaner_payout_paid(
  p_payout_id uuid,
  p_bank_reference text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_payout public.cleaner_payouts%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF length(trim(p_bank_reference)) < 3 THEN RAISE EXCEPTION 'Bank transfer reference is required'; END IF;
  SELECT * INTO v_payout FROM public.cleaner_payouts WHERE id = p_payout_id FOR UPDATE;
  IF v_payout.id IS NULL THEN RAISE EXCEPTION 'Payout not found'; END IF;
  IF v_payout.status NOT IN ('approved','processing') THEN RAISE EXCEPTION 'Only approved payouts can be marked paid'; END IF;
  UPDATE public.cleaner_payouts SET status='paid', provider='bank_transfer',
    provider_reference=trim(p_bank_reference), bank_transfer_reference=trim(p_bank_reference),
    paid_at=now(), updated_at=now() WHERE id=p_payout_id;
  INSERT INTO public.job_events(job_id,actor_user_id,event_type,details)
    VALUES(v_payout.job_id,auth.uid(),'cleaner_payout_paid',jsonb_build_object('payout_id',p_payout_id,'bank_reference',trim(p_bank_reference)));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.mark_cleaner_payout_paid(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_cleaner_payout_paid(uuid,text) TO authenticated;

INSERT INTO public.platform_schema_versions(version, description)
VALUES ('20260816210000', 'Weekly cleaner pay cycle and bank-transfer reconciliation')
ON CONFLICT (version) DO NOTHING;
