-- Create a function to detect and flag suspicious lead unlock patterns
CREATE OR REPLACE FUNCTION public.check_suspicious_lead_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unlocks_last_hour INTEGER;
  v_unlocks_last_day INTEGER;
  v_user_id UUID;
BEGIN
  v_user_id := NEW.unlocked_by;
  
  -- Skip if not being unlocked
  IF NEW.unlocked_by IS NULL OR OLD.unlocked_by IS NOT NULL THEN
    RETURN NEW;
  END IF;
  
  -- Count unlocks in the last hour
  SELECT COUNT(*) INTO v_unlocks_last_hour
  FROM leads
  WHERE unlocked_by = v_user_id
    AND unlocked_at > (now() - INTERVAL '1 hour');
  
  -- Count unlocks in the last 24 hours
  SELECT COUNT(*) INTO v_unlocks_last_day
  FROM leads
  WHERE unlocked_by = v_user_id
    AND unlocked_at > (now() - INTERVAL '24 hours');
  
  -- Flag if more than 5 unlocks in an hour (potential harvesting)
  IF v_unlocks_last_hour > 5 THEN
    INSERT INTO fraud_flags (
      user_id,
      lead_id,
      flag_type,
      description,
      status
    ) VALUES (
      v_user_id,
      NEW.id,
      'rapid_unlocking',
      'User unlocked ' || v_unlocks_last_hour || ' leads in the last hour. Potential data harvesting.',
      'pending'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  -- Flag if more than 15 unlocks in a day
  IF v_unlocks_last_day > 15 THEN
    INSERT INTO fraud_flags (
      user_id,
      lead_id,
      flag_type,
      description,
      status
    ) VALUES (
      v_user_id,
      NEW.id,
      'high_volume_unlocking',
      'User unlocked ' || v_unlocks_last_day || ' leads in the last 24 hours. Review for potential abuse.',
      'pending'
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for suspicious activity detection
DROP TRIGGER IF EXISTS check_suspicious_lead_unlock ON leads;
CREATE TRIGGER check_suspicious_lead_unlock
  AFTER UPDATE ON leads
  FOR EACH ROW
  WHEN (OLD.unlocked_by IS NULL AND NEW.unlocked_by IS NOT NULL)
  EXECUTE FUNCTION public.check_suspicious_lead_activity();

-- Add unique constraint to prevent duplicate fraud flags
ALTER TABLE fraud_flags 
ADD CONSTRAINT unique_fraud_flag_per_lead 
UNIQUE NULLS NOT DISTINCT (user_id, lead_id, flag_type);

-- Create function to enforce strict rate limiting on lead unlocking
CREATE OR REPLACE FUNCTION public.enforce_lead_unlock_rate_limit(p_user_id uuid)
RETURNS TABLE(allowed boolean, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_unlocks_last_minute INTEGER;
  v_unlocks_last_hour INTEGER;
BEGIN
  -- Check unlocks in the last minute (max 2)
  SELECT COUNT(*) INTO v_unlocks_last_minute
  FROM leads
  WHERE unlocked_by = p_user_id
    AND unlocked_at > (now() - INTERVAL '1 minute');
  
  IF v_unlocks_last_minute >= 2 THEN
    RETURN QUERY SELECT FALSE, 'Please wait a moment before unlocking another lead.'::TEXT;
    RETURN;
  END IF;
  
  -- Check unlocks in the last hour (max 10)
  SELECT COUNT(*) INTO v_unlocks_last_hour
  FROM leads
  WHERE unlocked_by = p_user_id
    AND unlocked_at > (now() - INTERVAL '1 hour');
  
  IF v_unlocks_last_hour >= 10 THEN
    RETURN QUERY SELECT FALSE, 'You have reached the hourly limit for unlocking leads. Please try again later.'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;