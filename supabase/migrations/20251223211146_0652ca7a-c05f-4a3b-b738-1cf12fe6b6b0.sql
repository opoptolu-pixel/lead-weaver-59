-- Fix get_available_leads to handle postcodes that are already just the outward code
CREATE OR REPLACE FUNCTION public.get_available_leads()
 RETURNS TABLE(id uuid, postcode text, job_type text, display_value text, date date, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    id,
    -- Extract outward code: if has space take first part, if length > 4 remove last 3, otherwise keep as is
    CASE 
      WHEN position(' ' in postcode) > 0 THEN split_part(postcode, ' ', 1)
      WHEN length(postcode) > 4 THEN left(postcode, length(postcode) - 3)
      ELSE postcode
    END as postcode,
    job_type,
    display_value,
    date,
    created_at
  FROM public.leads
  WHERE is_unlocked = false
    AND (lead_status = 'published' OR lead_status = 'new' OR lead_status = 'approved')
  ORDER BY created_at DESC;
$function$;