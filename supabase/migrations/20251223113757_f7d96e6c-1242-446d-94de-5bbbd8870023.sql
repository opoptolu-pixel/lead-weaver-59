-- Drop the security definer view
DROP VIEW IF EXISTS public.available_leads;

-- Create a security definer function instead (recommended pattern)
CREATE OR REPLACE FUNCTION public.get_available_leads()
RETURNS TABLE (
  id uuid,
  postcode text,
  job_type text,
  display_value text,
  date date,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    postcode,
    job_type,
    display_value,
    date,
    created_at
  FROM public.leads
  WHERE is_unlocked = false
  ORDER BY created_at DESC;
$$;

-- Grant execute to public roles
GRANT EXECUTE ON FUNCTION public.get_available_leads() TO anon;
GRANT EXECUTE ON FUNCTION public.get_available_leads() TO authenticated;

COMMENT ON FUNCTION public.get_available_leads() IS 'Returns available leads with only non-sensitive fields exposed. Customer PII is protected.';