CREATE OR REPLACE FUNCTION public.cancel_ineligible_cleaner_job_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cleaner_job_notifications n
  SET status = 'cancelled',
      last_error = CASE
        WHEN sr.source = 'e2e_test_seed' THEN 'Test job notifications are disabled'
        ELSE 'Job is ' || NEW.status
      END,
      updated_at = now()
  FROM public.jobs j
  LEFT JOIN public.service_requests sr ON sr.id = j.service_request_id
  WHERE n.job_id = j.id
    AND j.id = NEW.id
    AND n.status IN ('pending', 'failed')
    AND (NEW.status IN ('completed', 'closed', 'cancelled', 'issue') OR sr.source = 'e2e_test_seed');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_ineligible_cleaner_job_notifications() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_ineligible_cleaner_job_notifications() TO service_role;

CREATE TRIGGER cancel_ineligible_cleaner_job_notifications
AFTER INSERT OR UPDATE OF status ON public.jobs
FOR EACH ROW
EXECUTE FUNCTION public.cancel_ineligible_cleaner_job_notifications();