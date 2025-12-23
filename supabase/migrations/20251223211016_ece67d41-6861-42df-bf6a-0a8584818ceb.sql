-- Fix get_available_leads to properly extract outward code for all postcode formats
CREATE OR REPLACE FUNCTION public.get_available_leads()
 RETURNS TABLE(id uuid, postcode text, job_type text, display_value text, date date, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    id,
    -- Extract outward code: if space exists use first part, otherwise remove last 3 chars (inward code)
    CASE 
      WHEN position(' ' in postcode) > 0 THEN split_part(postcode, ' ', 1)
      WHEN length(postcode) > 3 THEN left(postcode, length(postcode) - 3)
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