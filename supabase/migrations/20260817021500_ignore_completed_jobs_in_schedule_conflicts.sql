-- Completed work must not continue to reserve a cleaner's future calendar.
-- This is especially important for test jobs that may be completed before their
-- scheduled date. Accepted assignments and explicit time off remain blocking.

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
      AND ja.status = 'accepted'
      AND j.status NOT IN ('cancelled', 'closed', 'completed')
      AND (p_exclude_job_id IS NULL OR j.id <> p_exclude_job_id)
      AND j.scheduled_start_at < p_end
      AND j.scheduled_end_at > p_start
  ) OR EXISTS (
    SELECT 1
    FROM public.cleaner_time_off cto
    WHERE cto.cleaner_id = p_cleaner_id
      AND cto.starts_at < p_end
      AND cto.ends_at > p_start
  );
$$;

REVOKE ALL ON FUNCTION public.cleaner_has_schedule_conflict(uuid,timestamptz,timestamptz,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cleaner_has_schedule_conflict(uuid,timestamptz,timestamptz,uuid) TO authenticated;

INSERT INTO public.platform_schema_versions(version, description)
VALUES (
  '20260817021500',
  'Stop completed assignments from creating false future schedule conflicts'
)
ON CONFLICT (version) DO UPDATE SET description = excluded.description;

NOTIFY pgrst, 'reload schema';
