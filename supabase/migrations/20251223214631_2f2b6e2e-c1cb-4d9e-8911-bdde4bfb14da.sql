-- Create an atomic credit deduction function with row-level locking
-- This prevents race conditions by locking the row during the transaction
CREATE OR REPLACE FUNCTION public.deduct_credit_atomic(
  p_user_id UUID,
  p_lead_id UUID
)
RETURNS TABLE (
  success BOOLEAN,
  remaining_credits INTEGER,
  error_message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits INTEGER;
  v_is_suspended BOOLEAN;
  v_suspension_reason TEXT;
  v_lead_unlocked BOOLEAN;
  v_is_verified BOOLEAN;
  v_leads_purchased INTEGER;
BEGIN
  -- Lock the profile row for update (prevents concurrent modifications)
  SELECT credits, is_suspended, suspension_reason, is_verified, leads_purchased
  INTO v_credits, v_is_suspended, v_suspension_reason, v_is_verified, v_leads_purchased
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Check if profile exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Profile not found'::TEXT;
    RETURN;
  END IF;
  
  -- Check suspension status
  IF v_is_suspended THEN
    RETURN QUERY SELECT FALSE, v_credits, COALESCE(v_suspension_reason, 'Your account is suspended. Please contact support.')::TEXT;
    RETURN;
  END IF;
  
  -- Check verification limit for unverified users (max 3 leads)
  IF NOT v_is_verified AND v_leads_purchased >= 3 THEN
    RETURN QUERY SELECT FALSE, v_credits, 'You have reached the maximum of 3 leads for unverified businesses. Please complete verification to unlock more leads.'::TEXT;
    RETURN;
  END IF;
  
  -- Check credit balance
  IF v_credits < 1 THEN
    RETURN QUERY SELECT FALSE, v_credits, 'Insufficient credits. Please purchase more credits.'::TEXT;
    RETURN;
  END IF;
  
  -- Check if lead is already unlocked (with row lock)
  SELECT is_unlocked INTO v_lead_unlocked
  FROM leads
  WHERE id = p_lead_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, v_credits, 'Lead not found'::TEXT;
    RETURN;
  END IF;
  
  IF v_lead_unlocked THEN
    RETURN QUERY SELECT FALSE, v_credits, 'This lead has already been unlocked'::TEXT;
    RETURN;
  END IF;
  
  -- Atomically deduct credit and increment leads_purchased
  UPDATE profiles
  SET 
    credits = credits - 1,
    leads_purchased = leads_purchased + 1,
    updated_at = now()
  WHERE user_id = p_user_id;
  
  -- Atomically unlock the lead
  UPDATE leads
  SET 
    is_unlocked = TRUE,
    unlocked_by = p_user_id,
    unlocked_at = now(),
    lead_status = 'purchased',
    outcome_status = 'purchased',
    updated_at = now()
  WHERE id = p_lead_id;
  
  -- Return success with new credit balance
  RETURN QUERY SELECT TRUE, v_credits - 1, NULL::TEXT;
END;
$$;