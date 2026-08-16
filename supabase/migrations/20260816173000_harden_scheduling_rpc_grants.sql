-- Lovable Cloud applies permissive function default privileges.
-- Explicitly keep scheduling RPCs unavailable to anonymous callers.

REVOKE ALL ON FUNCTION public.offer_job_to_cleaner(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.replace_my_cleaner_availability(jsonb) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleaner_has_schedule_conflict(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cleaner_is_available_for_window(uuid, timestamptz, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.respond_to_job_assignment(uuid, text, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.offer_job_to_cleaner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.replace_my_cleaner_availability(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_has_schedule_conflict(uuid, timestamptz, timestamptz, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_is_available_for_window(uuid, timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_job_assignment(uuid, text, text) TO authenticated;

INSERT INTO public.platform_schema_versions(version, description)
VALUES ('20260816173000', 'Restrict operational scheduling RPCs to authenticated users')
ON CONFLICT (version) DO UPDATE SET description = excluded.description;

NOTIFY pgrst, 'reload schema';
