REVOKE ALL ON public.cleaner_job_notifications FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.cleaner_job_notifications TO authenticated;
GRANT ALL ON public.cleaner_job_notifications TO service_role;