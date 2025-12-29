
-- Fix reserve_lead function - qualify expires_at column references
CREATE OR REPLACE FUNCTION public.reserve_lead(p_lead_id uuid, p_visitor_id text)
 RETURNS TABLE(success boolean, message text, reservation_id uuid, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_reservation RECORD;
  v_lead_unlocked BOOLEAN;
  v_new_reservation_id UUID;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Check if lead is already unlocked/purchased
  SELECT is_unlocked INTO v_lead_unlocked FROM leads WHERE id = p_lead_id;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'Lead not found'::TEXT, NULL::UUID, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  IF v_lead_unlocked THEN
    RETURN QUERY SELECT FALSE, 'Lead already purchased'::TEXT, NULL::UUID, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  -- Check for existing active reservation (not expired, not by this visitor)
  SELECT * INTO v_existing_reservation
  FROM lead_reservations lr
  WHERE lr.lead_id = p_lead_id
    AND lr.status = 'active'
    AND lr.expires_at > now()
    AND lr.visitor_id != p_visitor_id
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT FALSE, 'Lead is being checked out by someone else'::TEXT, NULL::UUID, v_existing_reservation.expires_at;
    RETURN;
  END IF;
  
  -- Check if this visitor already has an active reservation for this lead
  SELECT * INTO v_existing_reservation
  FROM lead_reservations lr
  WHERE lr.lead_id = p_lead_id
    AND lr.visitor_id = p_visitor_id
    AND lr.status = 'active'
    AND lr.expires_at > now()
  LIMIT 1;
  
  IF FOUND THEN
    -- Return existing reservation
    RETURN QUERY SELECT TRUE, 'Reservation already exists'::TEXT, v_existing_reservation.id, v_existing_reservation.expires_at;
    RETURN;
  END IF;
  
  -- Expire any old reservations for this lead
  UPDATE lead_reservations
  SET status = 'expired'
  WHERE lead_id = p_lead_id AND status = 'active' AND lead_reservations.expires_at <= now();
  
  -- Create new reservation
  v_expires_at := now() + INTERVAL '5 minutes';
  INSERT INTO lead_reservations (lead_id, visitor_id, expires_at)
  VALUES (p_lead_id, p_visitor_id, v_expires_at)
  RETURNING id INTO v_new_reservation_id;
  
  RETURN QUERY SELECT TRUE, 'Lead reserved successfully'::TEXT, v_new_reservation_id, v_expires_at;
END;
$function$;

-- Fix check_lead_reservation function - qualify expires_at column references
CREATE OR REPLACE FUNCTION public.check_lead_reservation(p_lead_id uuid, p_visitor_id text)
 RETURNS TABLE(is_reserved boolean, reserved_by_me boolean, expires_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_reservation RECORD;
BEGIN
  SELECT * INTO v_reservation
  FROM lead_reservations lr
  WHERE lr.lead_id = p_lead_id
    AND lr.status = 'active'
    AND lr.expires_at > now()
  ORDER BY lr.reserved_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, (v_reservation.visitor_id = p_visitor_id), v_reservation.expires_at;
END;
$function$;
