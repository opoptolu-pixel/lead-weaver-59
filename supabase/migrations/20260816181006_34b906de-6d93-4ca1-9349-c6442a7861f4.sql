REVOKE ALL ON public.job_issues FROM authenticated;
REVOKE ALL ON public.job_issue_events FROM authenticated;
REVOKE ALL ON public.job_issues, public.job_issue_events FROM anon, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON public.job_issues TO authenticated;
GRANT SELECT ON public.job_issue_events TO authenticated;
GRANT ALL ON public.job_issues, public.job_issue_events TO service_role;