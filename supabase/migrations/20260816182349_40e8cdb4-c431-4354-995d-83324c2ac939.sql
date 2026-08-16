-- Audited customer collections and a hard collection gate for cleaner payouts.

CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_payment_id uuid,
  p_method text,
  p_reference text,
  p_paid_at timestamptz DEFAULT now()
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_payment public.customer_payments%ROWTYPE; v_job public.jobs%ROWTYPE; v_bank_status text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_method NOT IN ('bank_transfer','cash','card_terminal','stripe','other') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF length(btrim(coalesce(p_reference,''))) < 3 THEN RAISE EXCEPTION 'A payment reference is required'; END IF;
  IF p_paid_at > now() + interval '5 minutes' THEN RAISE EXCEPTION 'Payment date cannot be in the future'; END IF;
  SELECT * INTO v_payment FROM public.customer_payments WHERE id=p_payment_id FOR UPDATE;
  IF v_payment.id IS NULL THEN RAISE EXCEPTION 'Customer payment not found'; END IF;
  IF v_payment.status IN ('refunded','partially_refunded') THEN RAISE EXCEPTION 'A refunded payment cannot be marked paid'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id=v_payment.job_id;
  UPDATE public.customer_payments SET status='paid',provider=p_method,provider_reference=left(btrim(p_reference),255),paid_at=p_paid_at,updated_at=now() WHERE id=p_payment_id;
  SELECT cp.bank_details_status INTO v_bank_status FROM public.job_assignments ja JOIN public.cleaner_profiles cp ON cp.id=ja.cleaner_id
    WHERE ja.job_id=v_payment.job_id AND ja.status IN ('accepted','completed') ORDER BY ja.updated_at DESC LIMIT 1;
  IF v_job.status IN ('completed','closed') AND v_job.quality_review_status='approved' THEN
    UPDATE public.cleaner_payouts SET status=CASE WHEN v_bank_status='verified' THEN 'approved' ELSE 'held' END,
      approved_at=CASE WHEN v_bank_status='verified' THEN now() ELSE NULL END,
      held_reason=CASE WHEN v_bank_status='verified' THEN NULL ELSE 'Cleaner bank details require verification' END,updated_at=now()
      WHERE job_id=v_payment.job_id AND status NOT IN ('paid','cancelled');
  END IF;
  INSERT INTO public.job_events(job_id,actor_user_id,event_type,details) VALUES(v_payment.job_id,auth.uid(),'customer_payment_recorded',
    jsonb_build_object('payment_id',p_payment_id,'method',p_method,'reference',left(btrim(p_reference),255),'amount_pence',v_payment.amount_pence,'paid_at',p_paid_at));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.approve_cleaner_payout(p_payout_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_payout public.cleaner_payouts%ROWTYPE; v_job public.jobs%ROWTYPE; v_bank_status text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_payout FROM public.cleaner_payouts WHERE id=p_payout_id FOR UPDATE;
  IF v_payout.id IS NULL THEN RAISE EXCEPTION 'Cleaner payout not found'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id=v_payout.job_id;
  SELECT bank_details_status INTO v_bank_status FROM public.cleaner_profiles WHERE id=v_payout.cleaner_id;
  IF v_job.status NOT IN ('completed','closed') OR v_job.quality_review_status<>'approved' THEN RAISE EXCEPTION 'Job must pass quality review before payout approval'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.customer_payments WHERE job_id=v_payout.job_id AND status='paid') THEN RAISE EXCEPTION 'Customer payment must be collected before cleaner payout approval'; END IF;
  IF v_bank_status<>'verified' THEN RAISE EXCEPTION 'Cleaner bank details must be verified before payout approval'; END IF;
  IF v_payout.status IN ('paid','cancelled') THEN RAISE EXCEPTION 'This payout cannot be approved'; END IF;
  UPDATE public.cleaner_payouts SET status='approved',approved_at=now(),held_reason=NULL,updated_at=now() WHERE id=p_payout_id;
  INSERT INTO public.job_events(job_id,actor_user_id,event_type,details) VALUES(v_payout.job_id,auth.uid(),'cleaner_payout_approved',jsonb_build_object('payout_id',p_payout_id,'amount_pence',v_payout.amount_pence));
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_job_completion(p_job_id uuid,p_decision text,p_notes text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_cleaner_id uuid; v_bank_status text; v_customer_paid boolean;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_decision NOT IN ('approved','rework_required','issue') THEN RAISE EXCEPTION 'Invalid quality decision'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.jobs WHERE id=p_job_id AND status='quality_check' FOR UPDATE) THEN RAISE EXCEPTION 'Only jobs awaiting quality review can be reviewed'; END IF;
  IF p_decision='approved' AND (NOT EXISTS(SELECT 1 FROM public.job_evidence WHERE job_id=p_job_id AND evidence_type='before') OR NOT EXISTS(SELECT 1 FROM public.job_evidence WHERE job_id=p_job_id AND evidence_type='after')) THEN RAISE EXCEPTION 'Before and after evidence is required before approval'; END IF;
  SELECT ja.cleaner_id,cp.bank_details_status INTO v_cleaner_id,v_bank_status FROM public.job_assignments ja JOIN public.cleaner_profiles cp ON cp.id=ja.cleaner_id WHERE ja.job_id=p_job_id AND ja.status IN ('accepted','completed') ORDER BY ja.updated_at DESC LIMIT 1;
  SELECT EXISTS(SELECT 1 FROM public.customer_payments WHERE job_id=p_job_id AND status='paid') INTO v_customer_paid;
  IF p_decision='approved' THEN
    UPDATE public.jobs SET status='completed',quality_review_status='approved',quality_review_notes=left(p_notes,2000),quality_reviewed_at=now(),quality_reviewed_by=auth.uid(),updated_at=now() WHERE id=p_job_id;
    UPDATE public.job_assignments SET status='completed',updated_at=now() WHERE job_id=p_job_id AND cleaner_id=v_cleaner_id AND status IN ('accepted','completed');
    UPDATE public.cleaner_payouts SET status=CASE WHEN NOT v_customer_paid OR v_bank_status<>'verified' THEN 'held' ELSE 'approved' END,
      approved_at=CASE WHEN v_customer_paid AND v_bank_status='verified' THEN now() ELSE NULL END,
      held_reason=CASE WHEN NOT v_customer_paid THEN 'Customer payment has not been collected' WHEN v_bank_status<>'verified' THEN 'Cleaner bank details require verification' ELSE NULL END,updated_at=now()
      WHERE job_id=p_job_id AND cleaner_id=v_cleaner_id AND status NOT IN ('paid','cancelled');
  ELSIF p_decision='rework_required' THEN
    UPDATE public.jobs SET status='in_progress',quality_review_status='rework_required',quality_review_notes=left(p_notes,2000),quality_reviewed_at=now(),quality_reviewed_by=auth.uid(),updated_at=now() WHERE id=p_job_id;
    UPDATE public.job_assignments SET status='accepted',updated_at=now() WHERE job_id=p_job_id AND cleaner_id=v_cleaner_id AND status='completed';
    UPDATE public.cleaner_payouts SET status='held',approved_at=NULL,held_reason='Rework required before payment',updated_at=now() WHERE job_id=p_job_id AND status NOT IN ('paid','cancelled');
  ELSE
    UPDATE public.jobs SET status='issue',quality_review_status='issue',quality_review_notes=left(p_notes,2000),quality_reviewed_at=now(),quality_reviewed_by=auth.uid(),updated_at=now() WHERE id=p_job_id;
    UPDATE public.cleaner_payouts SET status='held',approved_at=NULL,held_reason='Job issue under investigation',updated_at=now() WHERE job_id=p_job_id AND status NOT IN ('paid','cancelled');
  END IF;
  INSERT INTO public.job_events(job_id,actor_user_id,event_type,details) VALUES(p_job_id,auth.uid(),'quality_'||p_decision,jsonb_build_object('notes',left(p_notes,2000),'payout_bank_status',v_bank_status,'customer_paid',v_customer_paid));
  RETURN true;
END $$;

-- Bank verification may only release quality-approved earnings after collection.
CREATE OR REPLACE FUNCTION public.review_cleaner_bank_details(p_cleaner_id uuid,p_decision text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_decision NOT IN ('verified','rejected') THEN RAISE EXCEPTION 'Decision must be verified or rejected'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.cleaner_bank_accounts WHERE cleaner_id=p_cleaner_id) THEN RAISE EXCEPTION 'Bank details not found'; END IF;
  UPDATE public.cleaner_bank_accounts SET reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() WHERE cleaner_id=p_cleaner_id;
  UPDATE public.cleaner_profiles SET bank_details_status=p_decision,payout_status=CASE WHEN p_decision='verified' THEN 'ready' ELSE 'restricted' END,updated_at=now() WHERE id=p_cleaner_id;
  IF p_decision='verified' THEN
    UPDATE public.cleaner_payouts cp SET status='approved',approved_at=now(),held_reason=NULL,updated_at=now() FROM public.jobs j
      WHERE cp.job_id=j.id AND cp.cleaner_id=p_cleaner_id AND cp.status='held' AND cp.held_reason='Cleaner bank details require verification'
      AND j.status IN ('completed','closed') AND j.quality_review_status='approved' AND EXISTS(SELECT 1 FROM public.customer_payments pay WHERE pay.job_id=j.id AND pay.status='paid');
  END IF;
  RETURN true;
END $$;

-- Reconcile only unpaid payouts; historical paid records are immutable.
UPDATE public.cleaner_payouts cp SET status='held',approved_at=NULL,held_reason='Customer payment has not been collected',updated_at=now()
WHERE cp.status IN ('pending','approved') AND NOT EXISTS(SELECT 1 FROM public.customer_payments pay WHERE pay.job_id=cp.job_id AND pay.status='paid');

REVOKE ALL ON FUNCTION public.record_customer_payment(uuid,text,text,timestamptz),public.approve_cleaner_payout(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.record_customer_payment(uuid,text,text,timestamptz),public.approve_cleaner_payout(uuid) TO authenticated;
INSERT INTO public.platform_schema_versions(version,description) VALUES('20260816250000','Customer collection workflow and payout collection gate') ON CONFLICT(version) DO UPDATE SET description=excluded.description;
NOTIFY pgrst,'reload schema';