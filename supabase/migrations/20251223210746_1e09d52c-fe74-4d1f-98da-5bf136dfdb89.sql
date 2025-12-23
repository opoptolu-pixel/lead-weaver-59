-- Update get_available_leads to return only the outward code (first part) of the postcode
CREATE OR REPLACE FUNCTION public.get_available_leads()
 RETURNS TABLE(id uuid, postcode text, job_type text, display_value text, date date, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    id,
    -- Extract only the outward code (first part before space, or first 3-4 chars if no space)
    CASE 
      WHEN position(' ' in postcode) > 0 THEN split_part(postcode, ' ', 1)
      ELSE left(postcode, length(postcode) - 3)
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