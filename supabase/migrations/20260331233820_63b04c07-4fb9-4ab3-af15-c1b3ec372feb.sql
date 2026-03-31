
-- Add amount_paid column to leads table
ALTER TABLE public.leads ADD COLUMN amount_paid integer NULL;

-- Backfill all existing unlocked leads with £20
UPDATE public.leads SET amount_paid = 20 WHERE is_unlocked = true AND amount_paid IS NULL;

-- Update deduct_credit_atomic to set amount_paid = 12 when unlocking via credits
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
  SELECT credits, granted_credits, is_suspended, suspension_reason, is_verified, leads_purchased, verification_status
  INTO v_credits, v_granted_credits, v_is_suspended, v_suspension_reason, v_is_verified, v_leads_purchased, v_verification_status
  FROM profiles
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Profile not found'::TEXT;
    RETURN;
  END IF;
  
  v_granted_credits := COALESCE(v_granted_credits, 0);
  
  IF v_is_suspended THEN
    RETURN QUERY SELECT FALSE, v_credits, COALESCE(v_suspension_reason, 'Your account is suspended. Please contact support.')::TEXT;
    RETURN;
  END IF;
  
  IF v_verification_status = 'reverification_required' THEN
    RETURN QUERY SELECT FALSE, v_credits, 'Your account requires re-verification. Please re-upload the requested documents before purchasing leads.'::TEXT;
    RETURN;
  END IF;
  
  IF NOT v_is_verified AND v_leads_purchased >= 3 THEN
    RETURN QUERY SELECT FALSE, v_credits, 'You have reached the maximum of 3 leads for unverified businesses. Please complete verification to unlock more leads.'::TEXT;
    RETURN;
  END IF;
  
  IF v_credits < 1 THEN
    RETURN QUERY SELECT FALSE, v_credits, 'Insufficient credits. Please purchase more credits.'::TEXT;
    RETURN;
  END IF;
  
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
  
  UPDATE leads
  SET 
    is_unlocked = TRUE,
    unlocked_by = p_user_id,
    unlocked_at = now(),
    lead_status = 'purchased',
    outcome_status = 'purchased',
    credit_type = v_credit_type,
    amount_paid = 12,
    updated_at = now()
  WHERE id = p_lead_id;
  
  RETURN QUERY SELECT TRUE, v_credits - 1, NULL::TEXT;
END;
$function$;
