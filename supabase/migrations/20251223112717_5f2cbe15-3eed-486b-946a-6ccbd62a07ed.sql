-- Drop the insecure public access policy
DROP POLICY IF EXISTS "Anyone can view available leads" ON public.leads;

-- Create a secure view for public lead browsing (excludes sensitive PII)
CREATE OR REPLACE VIEW public.available_leads AS
SELECT 
  id,
  postcode,
  job_type,
  display_value,
  date,
  created_at
FROM public.leads
WHERE is_unlocked = false;

-- Grant access to the view for public browsing
GRANT SELECT ON public.available_leads TO anon;
GRANT SELECT ON public.available_leads TO authenticated;

-- Add comment for documentation
COMMENT ON VIEW public.available_leads IS 'Public view of available leads without sensitive customer information';