-- Create lead_reservations table for tracking checkout attempts
CREATE TABLE public.lead_reservations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL,
  reserved_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + INTERVAL '5 minutes'),
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_lead_reservations_lead_id ON public.lead_reservations(lead_id);
CREATE INDEX idx_lead_reservations_status_expires ON public.lead_reservations(status, expires_at);

-- Enable RLS
ALTER TABLE public.lead_reservations ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view active reservations (needed to check if lead is reserved)
CREATE POLICY "Anyone can view active reservations"
ON public.lead_reservations
FOR SELECT
USING (status = 'active' AND expires_at > now());

-- Allow anyone to insert reservations (visitor_id tracks who)
CREATE POLICY "Anyone can create reservations"
ON public.lead_reservations
FOR INSERT
WITH CHECK (true);

-- Allow updating own reservations
CREATE POLICY "Anyone can update own reservations"
ON public.lead_reservations
FOR UPDATE
USING (true);

-- Create function to reserve a lead atomically
CREATE OR REPLACE FUNCTION public.reserve_lead(p_lead_id UUID, p_visitor_id TEXT)
RETURNS TABLE(success BOOLEAN, message TEXT, reservation_id UUID, expires_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  FROM lead_reservations
  WHERE lead_id = p_lead_id
    AND status = 'active'
    AND expires_at > now()
    AND visitor_id != p_visitor_id
  LIMIT 1;
  
  IF FOUND THEN
    RETURN QUERY SELECT FALSE, 'Lead is being checked out by someone else'::TEXT, NULL::UUID, v_existing_reservation.expires_at;
    RETURN;
  END IF;
  
  -- Check if this visitor already has an active reservation for this lead
  SELECT * INTO v_existing_reservation
  FROM lead_reservations
  WHERE lead_id = p_lead_id
    AND visitor_id = p_visitor_id
    AND status = 'active'
    AND expires_at > now()
  LIMIT 1;
  
  IF FOUND THEN
    -- Return existing reservation
    RETURN QUERY SELECT TRUE, 'Reservation already exists'::TEXT, v_existing_reservation.id, v_existing_reservation.expires_at;
    RETURN;
  END IF;
  
  -- Expire any old reservations for this lead
  UPDATE lead_reservations
  SET status = 'expired'
  WHERE lead_id = p_lead_id AND status = 'active' AND expires_at <= now();
  
  -- Create new reservation
  v_expires_at := now() + INTERVAL '5 minutes';
  INSERT INTO lead_reservations (lead_id, visitor_id, expires_at)
  VALUES (p_lead_id, p_visitor_id, v_expires_at)
  RETURNING id INTO v_new_reservation_id;
  
  RETURN QUERY SELECT TRUE, 'Lead reserved successfully'::TEXT, v_new_reservation_id, v_expires_at;
END;
$$;

-- Create function to check if a lead is reserved by someone else
CREATE OR REPLACE FUNCTION public.check_lead_reservation(p_lead_id UUID, p_visitor_id TEXT)
RETURNS TABLE(is_reserved BOOLEAN, reserved_by_me BOOLEAN, expires_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_reservation RECORD;
BEGIN
  SELECT * INTO v_reservation
  FROM lead_reservations
  WHERE lead_id = p_lead_id
    AND status = 'active'
    AND lead_reservations.expires_at > now()
  ORDER BY reserved_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, (v_reservation.visitor_id = p_visitor_id), v_reservation.expires_at;
END;
$$;

-- Create function to complete a reservation (called after successful payment)
CREATE OR REPLACE FUNCTION public.complete_lead_reservation(p_lead_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE lead_reservations
  SET status = 'completed'
  WHERE lead_id = p_lead_id AND status = 'active';
END;
$$;