-- Recreate the view with SECURITY INVOKER (default, but explicit for clarity)
DROP VIEW IF EXISTS public.available_leads;

CREATE VIEW public.available_leads 
WITH (security_invoker = true) AS
SELECT 
  id,
  postcode,
  job_type,
  display_value,
  date,
  created_at
FROM public.leads
WHERE is_unlocked = false;

-- Re-grant access to the view
GRANT SELECT ON public.available_leads TO anon;
GRANT SELECT ON public.available_leads TO authenticated;

COMMENT ON VIEW public.available_leads IS 'Public view of available leads without sensitive customer information';