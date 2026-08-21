GRANT SELECT, INSERT, UPDATE, DELETE ON
  public.service_areas, public.service_types, public.customers, public.customer_addresses,
  public.service_requests, public.quotes, public.cleaner_profiles,
  public.cleaner_service_capabilities, public.cleaner_service_areas,
  public.jobs, public.job_assignments, public.customer_payments,
  public.cleaner_payouts, public.job_events
TO authenticated;

GRANT SELECT ON public.service_areas, public.service_types TO anon;

GRANT ALL ON
  public.service_areas, public.service_types, public.customers, public.customer_addresses,
  public.service_requests, public.quotes, public.cleaner_profiles,
  public.cleaner_service_capabilities, public.cleaner_service_areas,
  public.jobs, public.job_assignments, public.customer_payments,
  public.cleaner_payouts, public.job_events, public.public_submission_rate_limits
TO service_role;

NOTIFY pgrst, 'reload schema';