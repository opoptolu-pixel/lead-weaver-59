-- Remove the overly permissive policy that exposes all columns
DROP POLICY IF EXISTS "Anyone can view available leads via view" ON public.leads;

-- Recreate the view as SECURITY DEFINER so it runs with owner privileges
-- This allows public access to the view while the underlying table remains protected
DROP VIEW IF EXISTS public.available_leads;

CREATE VIEW public.available_leads 
WITH (security_barrier = true) AS
SELECT 
  id,
  postcode,
  job_type,
  display_value,
  date,
  created_at
FROM public.leads
WHERE is_unlocked = false;

-- Make it security definer by changing ownership and granting execute
ALTER VIEW public.available_leads OWNER TO postgres;

-- Grant access to the view (not the underlying table)
GRANT SELECT ON public.available_leads TO anon;
GRANT SELECT ON public.available_leads TO authenticated;

COMMENT ON VIEW public.available_leads IS 'Public view of available leads - only non-sensitive fields exposed. Underlying table remains protected by RLS.';