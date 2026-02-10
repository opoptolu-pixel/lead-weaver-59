
DROP FUNCTION IF EXISTS public.get_user_leads_with_access_control(uuid);

CREATE FUNCTION public.get_user_leads_with_access_control(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  postcode text,
  job_type text,
  display_value text,
  date date,
  unlocked_at timestamp with time zone,
  job_status text,
  job_notes text,
  job_completed_at timestamp with time zone,
  value integer,
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_address text,
  access_expires_at timestamp with time zone,
  is_access_expired boolean,
  property_type text,
  bedrooms text,
  frequency text,
  booked_date date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ACCESS_WINDOW_DAYS CONSTANT INTEGER := 90;
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.postcode,
    l.job_type,
    l.display_value,
    l.date,
    l.unlocked_at,
    l.job_status,
    l.job_notes,
    l.job_completed_at,
    l.value,
    CASE 
      WHEN l.unlocked_at < (now() - (ACCESS_WINDOW_DAYS || ' days')::INTERVAL) 
      THEN '*** Access Expired ***'
      ELSE l.customer_name
    END AS customer_name,
    CASE 
      WHEN l.unlocked_at < (now() - (ACCESS_WINDOW_DAYS || ' days')::INTERVAL) 
      THEN '***@***.***'
      ELSE l.customer_email
    END AS customer_email,
    CASE 
      WHEN l.unlocked_at < (now() - (ACCESS_WINDOW_DAYS || ' days')::INTERVAL) 
      THEN '***** ******'
      ELSE l.customer_phone
    END AS customer_phone,
    CASE 
      WHEN l.unlocked_at < (now() - (ACCESS_WINDOW_DAYS || ' days')::INTERVAL) 
      THEN '*** Address Hidden ***'
      ELSE l.customer_address
    END AS customer_address,
    (l.unlocked_at + (ACCESS_WINDOW_DAYS || ' days')::INTERVAL) AS access_expires_at,
    (l.unlocked_at < (now() - (ACCESS_WINDOW_DAYS || ' days')::INTERVAL)) AS is_access_expired,
    l.property_type,
    l.bedrooms,
    l.frequency,
    l.booked_date
  FROM public.leads l
  WHERE l.unlocked_by = p_user_id
    AND l.is_unlocked = true
  ORDER BY l.unlocked_at DESC;
END;
$$;
