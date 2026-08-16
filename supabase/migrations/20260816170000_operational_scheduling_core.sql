-- Cleanda managed-agency operational scheduling core.
-- Additive and idempotent: preserves all existing requests, jobs and assignments.

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS scheduled_end_at timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS schedule_confirmed_at timestamptz;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS schedule_confirmed_by uuid REFERENCES auth.users(id);

UPDATE public.jobs
SET scheduled_start_at = (scheduled_date + start_time) AT TIME ZONE 'Europe/London',
    scheduled_end_at = ((scheduled_date + start_time) AT TIME ZONE 'Europe/London') + make_interval(mins => expected_duration_minutes),
    schedule_confirmed_at = COALESCE(schedule_confirmed_at, updated_at)
WHERE scheduled_start_at IS NULL
  AND start_time IS NOT NULL
  AND expected_duration_minutes IS NOT NULL;

ALTER TABLE public.jobs DROP CONSTRAINT IF EXISTS jobs_schedule_window_valid;
ALTER TABLE public.jobs ADD CONSTRAINT jobs_schedule_window_valid CHECK (
  (scheduled_start_at IS NULL AND scheduled_end_at IS NULL)
  OR (scheduled_start_at IS NOT NULL AND scheduled_end_at IS NOT NULL AND scheduled_end_at > scheduled_start_at)
);
CREATE INDEX IF NOT EXISTS jobs_schedule_window_idx ON public.jobs (scheduled_start_at, scheduled_end_at)
  WHERE status NOT IN ('cancelled', 'closed');

CREATE OR REPLACE FUNCTION public.sync_job_schedule_window()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.start_time IS NULL OR NEW.expected_duration_minutes IS NULL THEN
    NEW.scheduled_start_at := NULL;
    NEW.scheduled_end_at := NULL;
  ELSE
    NEW.scheduled_start_at := (NEW.scheduled_date + NEW.start_time) AT TIME ZONE 'Europe/London';
    NEW.scheduled_end_at := NEW.scheduled_start_at + make_interval(mins => NEW.expected_duration_minutes);
    IF TG_OP = 'INSERT' OR OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date OR OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.expected_duration_minutes IS DISTINCT FROM NEW.expected_duration_minutes THEN
      NEW.schedule_confirmed_at := now();
      NEW.schedule_confirmed_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_job_schedule_window_trigger ON public.jobs;
CREATE TRIGGER sync_job_schedule_window_trigger
BEFORE INSERT OR UPDATE OF scheduled_date, start_time, expected_duration_minutes ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.sync_job_schedule_window();

CREATE TABLE IF NOT EXISTS public.cleaner_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id uuid NOT NULL REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  weekday smallint NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time),
  UNIQUE (cleaner_id, weekday, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS public.cleaner_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id uuid NOT NULL REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS cleaner_availability_lookup_idx ON public.cleaner_availability(cleaner_id, weekday);
CREATE INDEX IF NOT EXISTS cleaner_time_off_lookup_idx ON public.cleaner_time_off(cleaner_id, starts_at, ends_at);

ALTER TABLE public.cleaner_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_time_off ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaner_availability TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cleaner_time_off TO authenticated;
GRANT ALL ON public.cleaner_availability TO service_role;
GRANT ALL ON public.cleaner_time_off TO service_role;

DROP POLICY IF EXISTS "Admins manage cleaner availability" ON public.cleaner_availability;
CREATE POLICY "Admins manage cleaner availability" ON public.cleaner_availability FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Cleaners manage own availability" ON public.cleaner_availability;
CREATE POLICY "Cleaners manage own availability" ON public.cleaner_availability FOR ALL TO authenticated
  USING (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id = auth.uid()))
  WITH CHECK (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Admins manage cleaner time off" ON public.cleaner_time_off;
CREATE POLICY "Admins manage cleaner time off" ON public.cleaner_time_off FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Cleaners manage own time off" ON public.cleaner_time_off;
CREATE POLICY "Cleaners manage own time off" ON public.cleaner_time_off FOR ALL TO authenticated
  USING (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id = auth.uid()))
  WITH CHECK (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.replace_my_cleaner_availability(p_windows jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_cleaner_id uuid;
BEGIN
  SELECT id INTO v_cleaner_id FROM public.cleaner_profiles WHERE user_id = auth.uid();
  IF v_cleaner_id IS NULL THEN RAISE EXCEPTION 'Cleaner profile not found'; END IF;
  IF jsonb_typeof(p_windows) <> 'array' OR jsonb_array_length(p_windows) > 14 THEN RAISE EXCEPTION 'Invalid availability schedule'; END IF;
  DELETE FROM public.cleaner_availability WHERE cleaner_id = v_cleaner_id;
  INSERT INTO public.cleaner_availability(cleaner_id, weekday, start_time, end_time)
  SELECT v_cleaner_id, w.weekday, w.start_time, w.end_time
  FROM jsonb_to_recordset(p_windows) AS w(weekday smallint, start_time time, end_time time);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_my_cleaner_availability(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_my_cleaner_availability(jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.cleaner_has_schedule_conflict(
  p_cleaner_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_exclude_job_id uuid DEFAULT NULL
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.job_assignments ja
    JOIN public.jobs j ON j.id = ja.job_id
    WHERE ja.cleaner_id = p_cleaner_id
      AND ja.status IN ('accepted', 'completed')
      AND j.status NOT IN ('cancelled', 'closed')
      AND (p_exclude_job_id IS NULL OR j.id <> p_exclude_job_id)
      AND j.scheduled_start_at < p_end
      AND j.scheduled_end_at > p_start
  ) OR EXISTS (
    SELECT 1 FROM public.cleaner_time_off cto
    WHERE cto.cleaner_id = p_cleaner_id
      AND cto.starts_at < p_end AND cto.ends_at > p_start
  );
$$;
REVOKE ALL ON FUNCTION public.cleaner_has_schedule_conflict(uuid,timestamptz,timestamptz,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleaner_has_schedule_conflict(uuid,timestamptz,timestamptz,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.cleaner_is_available_for_window(p_cleaner_id uuid, p_start timestamptz, p_end timestamptz)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cleaner_availability ca
    WHERE ca.cleaner_id = p_cleaner_id
      AND ca.weekday = extract(dow FROM p_start AT TIME ZONE 'Europe/London')::smallint
      AND ca.start_time <= (p_start AT TIME ZONE 'Europe/London')::time
      AND ca.end_time >= (p_end AT TIME ZONE 'Europe/London')::time
      AND (p_start AT TIME ZONE 'Europe/London')::date = (p_end AT TIME ZONE 'Europe/London')::date
  );
$$;
REVOKE ALL ON FUNCTION public.cleaner_is_available_for_window(uuid,timestamptz,timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleaner_is_available_for_window(uuid,timestamptz,timestamptz) TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_assigned_job_schedule_conflict()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_cleaner_id uuid;
BEGIN
  SELECT cleaner_id INTO v_cleaner_id FROM public.job_assignments WHERE job_id = NEW.id AND status = 'accepted';
  IF v_cleaner_id IS NOT NULL AND public.cleaner_has_schedule_conflict(v_cleaner_id, NEW.scheduled_start_at, NEW.scheduled_end_at, NEW.id) THEN
    RAISE EXCEPTION 'Updated schedule overlaps the accepted cleaner''s existing job or time off';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS z_enforce_assigned_job_schedule_conflict_trigger ON public.jobs;
CREATE TRIGGER z_enforce_assigned_job_schedule_conflict_trigger
BEFORE UPDATE OF scheduled_date, start_time, expected_duration_minutes ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.enforce_assigned_job_schedule_conflict();

CREATE OR REPLACE FUNCTION public.offer_job_to_cleaner(p_job_id uuid, p_cleaner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_job public.jobs%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  SELECT * INTO v_job FROM public.jobs WHERE id = p_job_id FOR UPDATE;
  IF v_job.id IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
  IF v_job.scheduled_start_at IS NULL OR v_job.scheduled_end_at IS NULL THEN RAISE EXCEPTION 'Confirm the job date, start time and duration before dispatch'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cleaner_profiles WHERE id = p_cleaner_id AND application_status = 'approved' AND verification_status = 'approved' AND operational_status = 'active') THEN
    RAISE EXCEPTION 'Cleaner is not approved and active';
  END IF;
  IF NOT public.cleaner_is_available_for_window(p_cleaner_id, v_job.scheduled_start_at, v_job.scheduled_end_at) THEN
    RAISE EXCEPTION 'Job falls outside the cleaner''s declared availability';
  END IF;
  IF public.cleaner_has_schedule_conflict(p_cleaner_id, v_job.scheduled_start_at, v_job.scheduled_end_at, p_job_id) THEN
    RAISE EXCEPTION 'Cleaner is unavailable or has an overlapping accepted job';
  END IF;
  UPDATE public.job_assignments SET status = 'revoked', updated_at = now()
    WHERE job_id = p_job_id AND status = 'offered';
  INSERT INTO public.job_assignments(job_id, cleaner_id, status, assigned_by)
    VALUES (p_job_id, p_cleaner_id, 'offered', auth.uid());
  UPDATE public.jobs SET status = 'offered', updated_at = now() WHERE id = p_job_id;
  INSERT INTO public.job_events(job_id, actor_user_id, event_type, details)
    VALUES (p_job_id, auth.uid(), 'cleaner_offered', jsonb_build_object('cleaner_id', p_cleaner_id));
  RETURN jsonb_build_object('success', true);
END;
$$;
REVOKE ALL ON FUNCTION public.offer_job_to_cleaner(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.offer_job_to_cleaner(uuid,uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.respond_to_job_assignment(p_assignment_id uuid, p_response text, p_notes text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_job public.jobs%ROWTYPE; v_cleaner_id uuid;
BEGIN
  IF p_response NOT IN ('accepted', 'declined') THEN RAISE EXCEPTION 'Invalid assignment response'; END IF;
  SELECT j, ja.cleaner_id INTO v_job, v_cleaner_id
  FROM public.job_assignments ja JOIN public.cleaner_profiles cp ON cp.id = ja.cleaner_id JOIN public.jobs j ON j.id = ja.job_id
  WHERE ja.id = p_assignment_id AND cp.user_id = auth.uid() AND ja.status = 'offered' FOR UPDATE OF ja, j;
  IF v_job.id IS NULL THEN RETURN false; END IF;
  IF p_response = 'accepted' AND NOT public.cleaner_is_available_for_window(v_cleaner_id, v_job.scheduled_start_at, v_job.scheduled_end_at) THEN
    RAISE EXCEPTION 'This job is outside your current declared availability';
  END IF;
  IF p_response = 'accepted' AND public.cleaner_has_schedule_conflict(v_cleaner_id, v_job.scheduled_start_at, v_job.scheduled_end_at, v_job.id) THEN
    RAISE EXCEPTION 'This time now conflicts with another accepted job or time off';
  END IF;
  UPDATE public.job_assignments SET status = p_response, responded_at = now(), response_notes = left(p_notes,1000), updated_at = now() WHERE id = p_assignment_id;
  UPDATE public.jobs SET status = CASE WHEN p_response='accepted' THEN 'assigned' ELSE 'awaiting_assignment' END, updated_at=now() WHERE id=v_job.id;
  INSERT INTO public.job_events(job_id,actor_user_id,event_type,details) VALUES(v_job.id,auth.uid(),'cleaner_'||p_response,jsonb_build_object('assignment_id',p_assignment_id));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.respond_to_job_assignment(uuid,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_job_assignment(uuid,text,text) TO authenticated;

INSERT INTO public.platform_schema_versions(version, description)
VALUES ('20260816170000', 'Operational scheduling, availability and conflict-safe dispatch')
ON CONFLICT (version) DO UPDATE SET description = excluded.description;

NOTIFY pgrst, 'reload schema';
