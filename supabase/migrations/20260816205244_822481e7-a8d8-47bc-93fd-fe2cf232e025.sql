-- Admin dispatch workflow for the managed-agency job board.
-- Additive and idempotent; preserves all existing jobs and assignments.

CREATE OR REPLACE FUNCTION public.get_job_dispatch_candidates(p_job_id uuid)
RETURNS TABLE (
  cleaner_id uuid,
  full_name text,
  phone text,
  postcode text,
  has_transport boolean,
  available boolean,
  has_conflict boolean,
  active_job_count bigint,
  service_areas text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_job public.jobs%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id;
  IF v_job.id IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;

  RETURN QUERY
  SELECT cp.id, cp.full_name, cp.phone, cp.postcode, cp.has_transport,
    CASE WHEN v_job.scheduled_start_at IS NULL OR v_job.scheduled_end_at IS NULL THEN false
      ELSE public.cleaner_is_available_for_window(cp.id, v_job.scheduled_start_at, v_job.scheduled_end_at) END,
    CASE WHEN v_job.scheduled_start_at IS NULL OR v_job.scheduled_end_at IS NULL THEN false
      ELSE public.cleaner_has_schedule_conflict(cp.id, v_job.scheduled_start_at, v_job.scheduled_end_at, v_job.id) END,
    (SELECT count(*) FROM public.job_assignments ja JOIN public.jobs j ON j.id=ja.job_id
      WHERE ja.cleaner_id=cp.id AND ja.status IN ('offered','accepted') AND j.status NOT IN ('cancelled','closed')),
    COALESCE((SELECT array_agg(sa.name ORDER BY sa.name) FROM public.cleaner_service_areas csa JOIN public.service_areas sa ON sa.id=csa.service_area_id WHERE csa.cleaner_id=cp.id), ARRAY[]::text[])
  FROM public.cleaner_profiles cp
  WHERE cp.application_status='approved' AND cp.verification_status='approved' AND cp.operational_status='active'
  ORDER BY 6 DESC, 7 ASC, 8 ASC, cp.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.get_job_dispatch_candidates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_job_dispatch_candidates(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.dispatch_job_to_cleaner(p_job_id uuid, p_cleaner_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_job public.jobs%ROWTYPE; v_existing uuid; v_assignment uuid;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id=p_job_id FOR UPDATE;
  IF v_job.id IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.status NOT IN ('awaiting_assignment','offered') THEN RAISE EXCEPTION 'This job is no longer assignable'; END IF;
  IF v_job.scheduled_start_at IS NULL OR v_job.scheduled_end_at IS NULL THEN RAISE EXCEPTION 'Save the date, start time and duration before dispatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cleaner_profiles WHERE id=p_cleaner_id AND application_status='approved' AND verification_status='approved' AND operational_status='active') THEN RAISE EXCEPTION 'Cleaner is not approved and active'; END IF;
  IF NOT public.cleaner_is_available_for_window(p_cleaner_id,v_job.scheduled_start_at,v_job.scheduled_end_at) THEN RAISE EXCEPTION 'Job falls outside the cleaner''s declared availability'; END IF;
  IF public.cleaner_has_schedule_conflict(p_cleaner_id,v_job.scheduled_start_at,v_job.scheduled_end_at,p_job_id) THEN RAISE EXCEPTION 'Cleaner has time off or an overlapping accepted job'; END IF;

  SELECT cleaner_id INTO v_existing FROM public.job_assignments WHERE job_id=p_job_id AND status='offered' ORDER BY offered_at DESC LIMIT 1;
  IF v_existing IS NOT NULL AND v_existing <> p_cleaner_id AND length(trim(COALESCE(p_reason,''))) < 5 THEN
    RAISE EXCEPTION 'A reassignment reason of at least 5 characters is required';
  END IF;
  UPDATE public.job_assignments SET status='revoked',response_notes=left(NULLIF(trim(p_reason),''),1000),updated_at=now() WHERE job_id=p_job_id AND status='offered';
  INSERT INTO public.job_assignments(job_id,cleaner_id,status,assigned_by) VALUES(p_job_id,p_cleaner_id,'offered',auth.uid()) RETURNING id INTO v_assignment;
  UPDATE public.jobs SET status='offered',updated_at=now() WHERE id=p_job_id;
  INSERT INTO public.job_events(job_id,actor_user_id,event_type,details) VALUES(p_job_id,auth.uid(),CASE WHEN v_existing IS NULL THEN 'cleaner_offered' ELSE 'cleaner_reassigned' END,jsonb_build_object('assignment_id',v_assignment,'cleaner_id',p_cleaner_id,'previous_cleaner_id',v_existing,'reason',NULLIF(trim(p_reason),'')));
  RETURN jsonb_build_object('success',true,'assignment_id',v_assignment);
END;
$$;
REVOKE ALL ON FUNCTION public.dispatch_job_to_cleaner(uuid,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dispatch_job_to_cleaner(uuid,uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.withdraw_job_offer(p_job_id uuid,p_reason text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF length(trim(COALESCE(p_reason,''))) < 5 THEN RAISE EXCEPTION 'A withdrawal reason of at least 5 characters is required'; END IF;
  UPDATE public.job_assignments SET status='revoked',response_notes=left(trim(p_reason),1000),updated_at=now() WHERE job_id=p_job_id AND status='offered';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count=0 THEN RAISE EXCEPTION 'No active cleaner offer found'; END IF;
  UPDATE public.jobs SET status='awaiting_assignment',updated_at=now() WHERE id=p_job_id AND status='offered';
  INSERT INTO public.job_events(job_id,actor_user_id,event_type,details) VALUES(p_job_id,auth.uid(),'cleaner_offer_withdrawn',jsonb_build_object('reason',trim(p_reason)));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.withdraw_job_offer(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.withdraw_job_offer(uuid,text) TO authenticated;

INSERT INTO public.platform_schema_versions(version,description)
VALUES('20260816290000','Admin cleaner assignment candidates, conflict-safe dispatch and audited reassignment')
ON CONFLICT(version) DO UPDATE SET description=excluded.description;

NOTIFY pgrst, 'reload schema';