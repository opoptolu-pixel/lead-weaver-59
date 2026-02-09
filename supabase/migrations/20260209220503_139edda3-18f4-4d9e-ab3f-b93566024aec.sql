
CREATE OR REPLACE FUNCTION public.deduct_credit_atomic(p_user_id uuid, p_lead_id uuid)
 RETURNS TABLE(success boolean, remaining_credits integer, error_message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_credits INTEGER;
  v_granted_credits INTEGER;
  v_is_suspended BOOLEAN;
  v_suspension_reason TEXT;
  v_lead_unlocked BOOLEAN;
  v_is_verified BOOLEAN;
  v_verification_status TEXT;
  v_leads_purchased INTEGER;
  v_credit_type TEXT;
BEGIN
  -- Lock the profile row for update (prevents concurrent modifications)
  SELECT credits, granted_credits, is_suspended, suspension_reason, is_verified, leads_purchased, verification_status
  INTO v_credits, v_granted_credits, v_is_suspended, v_suspension_reason, v_is_verified, v_leads_purchased, v_verification_status
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Check if profile exists
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Profile not found'::TEXT;
    RETURN;
  END IF;
  
  -- Default granted_credits to 0 if null
  v_granted_credits := COALESCE(v_granted_credits, 0);
  
  -- Check suspension status
  IF v_is_suspended THEN
    RETURN QUERY SELECT FALSE, v_credits, COALESCE(v_suspension_reason, 'Your account is suspended. Please contact support.')::TEXT;
    RETURN;
  END IF;
  
  -- Block purchases when re-verification is required
  IF v_verification_status = 'reverification_required' THEN
    RETURN QUERY SELECT FALSE, v_credits, 'Your account requires re-verification. Please re-upload the requested documents before purchasing leads.'::TEXT;
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
  
  -- Determine if using granted or purchased credit
  IF v_granted_credits > 0 THEN
    v_credit_type := 'granted';
    UPDATE profiles
    SET 
      credits = credits - 1,
      granted_credits = granted_credits - 1,
      leads_purchased = leads_purchased + 1,
      updated_at = now()
    WHERE user_id = p_user_id;
  ELSE
    v_credit_type := 'purchased';
    UPDATE profiles
    SET 
      credits = credits - 1,
      leads_purchased = leads_purchased + 1,
      updated_at = now()
    WHERE user_id = p_user_id;
  END IF;
  
  -- Atomically unlock the lead with credit_type
  UPDATE leads
  SET 
    is_unlocked = TRUE,
    unlocked_by = p_user_id,
    unlocked_at = now(),
    lead_status = 'purchased',
    outcome_status = 'purchased',
    credit_type = v_credit_type,
    updated_at = now()
  WHERE id = p_lead_id;
  
  -- Return success with new credit balance
  RETURN QUERY SELECT TRUE, v_credits - 1, NULL::TEXT;
END;
$function$;
