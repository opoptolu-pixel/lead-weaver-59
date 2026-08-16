-- Central job pipeline, guarded admin overrides and payout synchronisation.

CREATE OR REPLACE FUNCTION public.admin_review_job_completion(
  p_job_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_cleaner_id uuid; v_bank_status text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_decision NOT IN ('approved','rework_required','issue') THEN RAISE EXCEPTION 'Invalid quality decision'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.jobs WHERE id=p_job_id AND status='quality_check' FOR UPDATE) THEN
    RAISE EXCEPTION 'Only jobs awaiting quality review can be reviewed';
  END IF;
  IF p_decision='approved' AND (
    NOT EXISTS(SELECT 1 FROM public.job_evidence WHERE job_id=p_job_id AND evidence_type='before') OR
    NOT EXISTS(SELECT 1 FROM public.job_evidence WHERE job_id=p_job_id AND evidence_type='after')
  ) THEN RAISE EXCEPTION 'Before and after evidence is required before approval'; END IF;

  SELECT ja.cleaner_id, cp.bank_details_status INTO v_cleaner_id, v_bank_status
  FROM public.job_assignments ja JOIN public.cleaner_profiles cp ON cp.id=ja.cleaner_id
  WHERE ja.job_id=p_job_id AND ja.status IN ('accepted','completed')
  ORDER BY ja.updated_at DESC LIMIT 1;

  IF p_decision='approved' THEN
    UPDATE public.jobs SET status='completed',quality_review_status='approved',quality_review_notes=left(p_notes,2000),quality_reviewed_at=now(),quality_reviewed_by=auth.uid(),updated_at=now() WHERE id=p_job_id;
    UPDATE public.job_assignments SET status='completed',updated_at=now() WHERE job_id=p_job_id AND cleaner_id=v_cleaner_id AND status IN ('accepted','completed');
    UPDATE public.cleaner_payouts SET
      status=CASE WHEN v_bank_status='verified' THEN 'approved' ELSE 'held' END,
      approved_at=CASE WHEN v_bank_status='verified' THEN now() ELSE NULL END,
      held_reason=CASE WHEN v_bank_status='verified' THEN NULL ELSE 'Cleaner bank details require verification' END,
      updated_at=now()
    WHERE job_id=p_job_id AND cleaner_id=v_cleaner_id AND status NOT IN ('paid','cancelled');
  ELSIF p_decision='rework_required' THEN
    UPDATE public.jobs SET status='in_progress',quality_review_status='rework_required',quality_review_notes=left(p_notes,2000),quality_reviewed_at=now(),quality_reviewed_by=auth.uid(),updated_at=now() WHERE id=p_job_id;
    UPDATE public.job_assignments SET status='accepted',updated_at=now() WHERE job_id=p_job_id AND cleaner_id=v_cleaner_id AND status='completed';
    UPDATE public.cleaner_payouts SET status='held',approved_at=NULL,held_reason='Rework required before payment',updated_at=now() WHERE job_id=p_job_id AND status NOT IN ('paid','cancelled');
  ELSE
    UPDATE public.jobs SET status='issue',quality_review_status='issue',quality_review_notes=left(p_notes,2000),quality_reviewed_at=now(),quality_reviewed_by=auth.uid(),updated_at=now() WHERE id=p_job_id;
    UPDATE public.cleaner_payouts SET status='held',approved_at=NULL,held_reason='Job issue under investigation',updated_at=now() WHERE job_id=p_job_id AND status NOT IN ('paid','cancelled');
  END IF;
  INSERT INTO public.job_events(job_id,actor_user_id,event_type,details)
  VALUES(p_job_id,auth.uid(),'quality_'||p_decision,jsonb_build_object('notes',left(p_notes,2000),'payout_bank_status',v_bank_status));
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_override_job_stage(
  p_job_id uuid,
  p_target_status text,
  p_reason text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_current text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF length(btrim(coalesce(p_reason,''))) < 5 THEN RAISE EXCEPTION 'An audit reason of at least 5 characters is required'; END IF;
  SELECT status INTO v_current FROM public.jobs WHERE id=p_job_id FOR UPDATE;
  IF v_current IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF p_target_status='completed' THEN RAISE EXCEPTION 'Use quality approval to complete a job'; END IF;
  IF NOT ((v_current='awaiting_assignment' AND p_target_status='cancelled') OR
          (v_current='offered' AND p_target_status IN ('awaiting_assignment','cancelled')) OR
          (v_current='assigned' AND p_target_status IN ('awaiting_assignment','in_progress','cancelled')) OR
          (v_current='in_progress' AND p_target_status IN ('quality_check','issue','cancelled')) OR
          (v_current='quality_check' AND p_target_status IN ('in_progress','issue')) OR
          (v_current='completed' AND p_target_status IN ('closed','issue')) OR
          (v_current='issue' AND p_target_status IN ('in_progress','closed','cancelled'))) THEN
    RAISE EXCEPTION 'Invalid job transition from % to %',v_current,p_target_status;
  END IF;
  UPDATE public.jobs SET status=p_target_status,updated_at=now() WHERE id=p_job_id;
  IF p_target_status IN ('issue','cancelled') THEN
    UPDATE public.cleaner_payouts SET status=CASE WHEN p_target_status='cancelled' THEN 'cancelled' ELSE 'held' END,
      held_reason=left(btrim(p_reason),1000),approved_at=NULL,updated_at=now()
    WHERE job_id=p_job_id AND status NOT IN ('paid','cancelled');
  END IF;
  INSERT INTO public.job_events(job_id,actor_user_id,event_type,details)
  VALUES(p_job_id,auth.uid(),'admin_stage_override',jsonb_build_object('from',v_current,'to',p_target_status,'reason',left(btrim(p_reason),1000)));
  RETURN true;
END;
$$;

-- Bank verification releases only earnings whose work has already passed quality review.
CREATE OR REPLACE FUNCTION public.review_cleaner_bank_details(p_cleaner_id uuid,p_decision text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_decision NOT IN ('verified','rejected') THEN RAISE EXCEPTION 'Decision must be verified or rejected'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.cleaner_bank_accounts WHERE cleaner_id=p_cleaner_id) THEN RAISE EXCEPTION 'Bank details not found'; END IF;
  UPDATE public.cleaner_bank_accounts SET reviewed_at=now(),reviewed_by=auth.uid(),updated_at=now() WHERE cleaner_id=p_cleaner_id;
  UPDATE public.cleaner_profiles SET bank_details_status=p_decision,payout_status=CASE WHEN p_decision='verified' THEN 'ready' ELSE 'restricted' END,updated_at=now() WHERE id=p_cleaner_id;
  IF p_decision='verified' THEN
    UPDATE public.cleaner_payouts cp SET status='approved',approved_at=now(),held_reason=NULL,updated_at=now()
    FROM public.jobs j WHERE cp.job_id=j.id AND cp.cleaner_id=p_cleaner_id AND cp.status='held'
      AND cp.held_reason='Cleaner bank details require verification' AND j.status='completed' AND j.quality_review_status='approved';
  END IF;
  RETURN true;
END; $$;

-- Reconcile existing jobs that reached quality/completed stages before this workflow.
UPDATE public.cleaner_payouts cp SET status='held',held_reason='Awaiting Cleanda quality review',approved_at=NULL,updated_at=now()
FROM public.jobs j WHERE cp.job_id=j.id AND j.status='quality_check' AND cp.status='pending';

UPDATE public.cleaner_payouts cp SET
  status=CASE WHEN profile.bank_details_status='verified' THEN 'approved' ELSE 'held' END,
  approved_at=CASE WHEN profile.bank_details_status='verified' THEN now() ELSE NULL END,
  held_reason=CASE WHEN profile.bank_details_status='verified' THEN NULL ELSE 'Cleaner bank details require verification' END,
  updated_at=now()
FROM public.jobs j, public.cleaner_profiles profile
WHERE cp.job_id=j.id AND cp.cleaner_id=profile.id AND j.status IN ('completed','closed')
  AND j.quality_review_status='approved' AND cp.status IN ('pending','held');

REVOKE ALL ON FUNCTION public.admin_review_job_completion(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.admin_override_job_stage(uuid,text,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.review_cleaner_bank_details(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_review_job_completion(uuid,text,text),public.admin_override_job_stage(uuid,text,text),public.review_cleaner_bank_details(uuid,text) TO authenticated;

INSERT INTO public.platform_schema_versions(version,description) VALUES('20260816230000','Automatic job pipeline and payout synchronisation')
ON CONFLICT(version) DO UPDATE SET description=excluded.description;
NOTIFY pgrst,'reload schema';
