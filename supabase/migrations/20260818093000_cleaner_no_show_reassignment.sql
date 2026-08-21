-- Audited cleaner no-show handling and conflict-safe reassignment.
-- This migration creates functions only; it does not alter existing business records.

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
    (SELECT count(*) FROM public.job_assignments ja JOIN public.jobs j ON j.id = ja.job_id
      WHERE ja.cleaner_id = cp.id AND ja.status IN ('offered', 'accepted') AND j.status NOT IN ('cancelled', 'closed')),
    COALESCE((SELECT array_agg(sa.name ORDER BY sa.name) FROM public.cleaner_service_areas csa JOIN public.service_areas sa ON sa.id = csa.service_area_id WHERE csa.cleaner_id = cp.id), ARRAY[]::text[])
  FROM public.cleaner_profiles cp
  WHERE cp.application_status = 'approved'
    AND cp.verification_status = 'approved'
    AND cp.operational_status = 'active'
    AND NOT EXISTS (
      SELECT 1
      FROM public.job_events event
      WHERE event.job_id = p_job_id
        AND event.event_type = 'cleaner_no_show'
        AND event.details ->> 'cleaner_id' = cp.id::text
    )
  ORDER BY 6 DESC, 7 ASC, 8 ASC, cp.full_name;
END;
$$;
REVOKE ALL ON FUNCTION public.get_job_dispatch_candidates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_job_dispatch_candidates(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_cleaner_no_show(
  p_job_id uuid,
  p_reason text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_job public.jobs%ROWTYPE;
  v_assignment public.job_assignments%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF length(trim(COALESCE(p_reason, ''))) < 5 THEN
    RAISE EXCEPTION 'A no-show reason of at least 5 characters is required';
  END IF;

  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF v_job.id IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.status <> 'assigned' THEN
    RAISE EXCEPTION 'Only an assigned job can be marked as a cleaner no-show';
  END IF;

  SELECT * INTO v_assignment
  FROM public.job_assignments
  WHERE job_id = p_job_id AND status = 'accepted'
  ORDER BY responded_at DESC NULLS LAST, updated_at DESC
  LIMIT 1
  FOR UPDATE;
  IF v_assignment.id IS NULL THEN
    RAISE EXCEPTION 'No accepted cleaner assignment found for this job';
  END IF;

  UPDATE public.job_assignments
  SET status = 'revoked',
      response_notes = left(trim(p_reason), 1000),
      updated_at = now()
  WHERE id = v_assignment.id;

  -- The assignment trigger cancels outstanding reminders for the revoked cleaner.
  UPDATE public.cleaner_payouts
  SET status = 'cancelled',
      approved_at = NULL,
      held_reason = 'Cleaner no-show — reassignment required',
      updated_at = now()
  WHERE job_id = p_job_id
    AND cleaner_id = v_assignment.cleaner_id
    AND status NOT IN ('paid', 'cancelled');

  UPDATE public.jobs
  SET status = 'awaiting_assignment', updated_at = now()
  WHERE id = p_job_id;

  INSERT INTO public.job_events(job_id, actor_user_id, event_type, details)
  VALUES (
    p_job_id,
    auth.uid(),
    'cleaner_no_show',
    jsonb_build_object(
      'assignment_id', v_assignment.id,
      'cleaner_id', v_assignment.cleaner_id,
      'reason', left(trim(p_reason), 1000),
      'previous_status', v_job.status,
      'next_status', 'awaiting_assignment'
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'assignment_id', v_assignment.id,
    'cleaner_id', v_assignment.cleaner_id,
    'status', 'awaiting_assignment'
  );
END;
$$;
REVOKE ALL ON FUNCTION public.mark_cleaner_no_show(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_cleaner_no_show(uuid, text) TO authenticated;

INSERT INTO public.platform_schema_versions(version, description)
VALUES ('20260818093000', 'Audited cleaner no-show handling and reassignment safeguards')
ON CONFLICT(version) DO UPDATE SET description = excluded.description;

NOTIFY pgrst, 'reload schema';
