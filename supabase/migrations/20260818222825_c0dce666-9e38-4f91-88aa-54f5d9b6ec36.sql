REVOKE EXECUTE ON FUNCTION public.mark_cleaner_no_show(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_job_dispatch_candidates(uuid) FROM anon;
NOTIFY pgrst, 'reload schema';