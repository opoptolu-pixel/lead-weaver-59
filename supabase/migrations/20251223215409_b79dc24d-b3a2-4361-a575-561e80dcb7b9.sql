-- Create a function to check if lead access has expired (30 days after unlock)
CREATE OR REPLACE FUNCTION public.is_lead_access_expired(unlocked_at_param TIMESTAMP WITH TIME ZONE)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(unlocked_at_param, now()) < (now() - INTERVAL '30 days')
$$;

-- Create a view that masks sensitive customer data for expired leads
-- Users can still see the lead but contact details are masked
CREATE OR REPLACE FUNCTION public.get_user_leads_with_access_control(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  postcode TEXT,
  job_type TEXT,
  display_value TEXT,
  date DATE,
  unlocked_at TIMESTAMP WITH TIME ZONE,
  job_status TEXT,
  job_notes TEXT,
  job_completed_at TIMESTAMP WITH TIME ZONE,
  value INTEGER,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  access_expires_at TIMESTAMP WITH TIME ZONE,
  is_access_expired BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ACCESS_WINDOW_DAYS CONSTANT INTEGER := 30;
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
    -- Mask customer data if access has expired
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
    -- Calculate access expiration date
    (l.unlocked_at + (ACCESS_WINDOW_DAYS || ' days')::INTERVAL) AS access_expires_at,
    -- Flag if access has expired
    (l.unlocked_at < (now() - (ACCESS_WINDOW_DAYS || ' days')::INTERVAL)) AS is_access_expired
  FROM leads l
  WHERE l.unlocked_by = p_user_id
  ORDER BY l.unlocked_at DESC;
END;
$$;