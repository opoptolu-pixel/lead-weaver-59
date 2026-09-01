UPDATE public.cleaner_job_notifications n
SET status = 'cancelled',
    last_error = CASE
      WHEN sr.source = 'e2e_test_seed' THEN 'Test job notifications are disabled'
      ELSE 'Job is ' || j.status
    END,
    updated_at = now()
FROM public.jobs j
LEFT JOIN public.service_requests sr ON sr.id = j.service_request_id
WHERE n.job_id = j.id
  AND n.status IN ('pending', 'failed')
  AND (j.status IN ('completed', 'closed', 'cancelled', 'issue') OR sr.source = 'e2e_test_seed');