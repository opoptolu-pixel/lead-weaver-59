-- Create function to increment leads_purchased counter (used by verify-payment)
CREATE OR REPLACE FUNCTION public.increment_leads_purchased(user_uuid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET leads_purchased = leads_purchased + 1
  WHERE user_id = user_uuid;
END;
$$;

-- Update get_available_leads to only show published leads (not just is_unlocked = false)
-- This ensures leads go through admin approval before being visible to cleaners
CREATE OR REPLACE FUNCTION public.get_available_leads()
RETURNS TABLE(id uuid, postcode text, job_type text, display_value text, date date, created_at timestamp with time zone)
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
    AND (lead_status = 'published' OR lead_status = 'new' OR lead_status = 'approved')
  ORDER BY created_at DESC;
$$;