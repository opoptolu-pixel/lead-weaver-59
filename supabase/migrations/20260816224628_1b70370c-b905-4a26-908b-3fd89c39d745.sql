CREATE OR REPLACE FUNCTION public.ensure_cleaner_assignment_payout()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_customer_paid boolean;
  v_bank_verified boolean;
  v_status text;
  v_held_reason text;
BEGIN
  IF NEW.status NOT IN ('accepted', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = NEW.job_id;
  IF v_job.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.customer_payments
    WHERE job_id = NEW.job_id AND status = 'paid'
  ) INTO v_customer_paid;

  SELECT COALESCE(bank_details_status = 'verified', false)
  INTO v_bank_verified
  FROM public.cleaner_profiles
  WHERE id = NEW.cleaner_id;

  IF v_job.status = 'quality_check' THEN
    v_status := 'held';
    v_held_reason := 'Awaiting Cleanda quality review';
  ELSIF v_job.status = 'issue' THEN
    v_status := 'held';
    v_held_reason := 'Job issue under investigation';
  ELSIF v_job.status IN ('completed', 'closed')
    AND v_job.quality_review_status = 'approved' THEN
    IF NOT v_customer_paid THEN
      v_status := 'held';
      v_held_reason := 'Customer payment has not been collected';
    ELSIF NOT v_bank_verified THEN
      v_status := 'held';
      v_held_reason := 'Cleaner bank details require verification';
    ELSE
      v_status := 'approved';
      v_held_reason := NULL;
    END IF;
  ELSE
    v_status := 'pending';
    v_held_reason := NULL;
  END IF;

  INSERT INTO public.cleaner_payouts (
    job_id, cleaner_id, amount_pence, currency, status, held_reason, approved_at
  ) VALUES (
    NEW.job_id,
    NEW.cleaner_id,
    v_job.cleaner_payout_pence,
    v_job.currency,
    v_status,
    v_held_reason,
    CASE WHEN v_status = 'approved' THEN now() ELSE NULL END
  )
  ON CONFLICT (job_id, cleaner_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ensure_cleaner_assignment_payout_trigger
  ON public.job_assignments;
CREATE TRIGGER ensure_cleaner_assignment_payout_trigger
AFTER INSERT OR UPDATE OF status ON public.job_assignments
FOR EACH ROW
EXECUTE FUNCTION public.ensure_cleaner_assignment_payout();

INSERT INTO public.cleaner_payouts (
  job_id, cleaner_id, amount_pence, currency, status, held_reason, approved_at
)
SELECT
  ja.job_id,
  ja.cleaner_id,
  j.cleaner_payout_pence,
  j.currency,
  CASE
    WHEN j.status = 'quality_check' THEN 'held'
    WHEN j.status = 'issue' THEN 'held'
    WHEN j.status IN ('completed', 'closed')
      AND j.quality_review_status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.customer_payments pay
        WHERE pay.job_id = j.id AND pay.status = 'paid'
      )
      AND cp.bank_details_status = 'verified' THEN 'approved'
    WHEN j.status IN ('completed', 'closed')
      AND j.quality_review_status = 'approved' THEN 'held'
    ELSE 'pending'
  END,
  CASE
    WHEN j.status = 'quality_check' THEN 'Awaiting Cleanda quality review'
    WHEN j.status = 'issue' THEN 'Job issue under investigation'
    WHEN j.status IN ('completed', 'closed')
      AND j.quality_review_status = 'approved'
      AND NOT EXISTS (
        SELECT 1 FROM public.customer_payments pay
        WHERE pay.job_id = j.id AND pay.status = 'paid'
      ) THEN 'Customer payment has not been collected'
    WHEN j.status IN ('completed', 'closed')
      AND j.quality_review_status = 'approved'
      AND cp.bank_details_status <> 'verified'
      THEN 'Cleaner bank details require verification'
    ELSE NULL
  END,
  CASE
    WHEN j.status IN ('completed', 'closed')
      AND j.quality_review_status = 'approved'
      AND EXISTS (
        SELECT 1 FROM public.customer_payments pay
        WHERE pay.job_id = j.id AND pay.status = 'paid'
      )
      AND cp.bank_details_status = 'verified' THEN now()
    ELSE NULL
  END
FROM public.job_assignments ja
JOIN public.jobs j ON j.id = ja.job_id
JOIN public.cleaner_profiles cp ON cp.id = ja.cleaner_id
WHERE ja.status IN ('accepted', 'completed')
ON CONFLICT (job_id, cleaner_id) DO NOTHING;

INSERT INTO public.platform_schema_versions(version, description)
VALUES (
  '20260816314000',
  'Guaranteed cleaner payout ledgers with safe missing-record backfill'
)
ON CONFLICT (version) DO UPDATE SET description = excluded.description;

NOTIFY pgrst, 'reload schema';