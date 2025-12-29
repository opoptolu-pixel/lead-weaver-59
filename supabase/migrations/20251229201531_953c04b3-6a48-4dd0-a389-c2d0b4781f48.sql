-- Create a trigger function to log new business signups
CREATE OR REPLACE FUNCTION public.log_new_business_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log when business_name is set (meaning they completed onboarding)
  IF NEW.business_name IS NOT NULL THEN
    INSERT INTO activity_logs (
      user_id,
      entity_type,
      entity_id,
      action,
      details
    ) VALUES (
      NEW.user_id,
      'business',
      NEW.user_id,
      'signup',
      jsonb_build_object(
        'business_name', NEW.business_name,
        'contact_name', NEW.contact_name,
        'postcode', NEW.postcode,
        'phone', NEW.phone,
        'whatsapp_optin', NEW.whatsapp_optin
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new profile insertions (when user first registers)
CREATE TRIGGER on_profile_created_log_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  WHEN (NEW.business_name IS NOT NULL)
  EXECUTE FUNCTION public.log_new_business_signup();

-- Create trigger for profile updates (when user completes onboarding)
CREATE OR REPLACE FUNCTION public.log_business_onboarding()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log when business_name is first set (was null, now has value)
  IF OLD.business_name IS NULL AND NEW.business_name IS NOT NULL THEN
    INSERT INTO activity_logs (
      user_id,
      entity_type,
      entity_id,
      action,
      details
    ) VALUES (
      NEW.user_id,
      'business',
      NEW.user_id,
      'signup',
      jsonb_build_object(
        'business_name', NEW.business_name,
        'contact_name', NEW.contact_name,
        'postcode', NEW.postcode,
        'phone', NEW.phone,
        'whatsapp_optin', NEW.whatsapp_optin
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for onboarding completion
CREATE TRIGGER on_profile_onboarded_log_signup
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  WHEN (OLD.business_name IS NULL AND NEW.business_name IS NOT NULL)
  EXECUTE FUNCTION public.log_business_onboarding();

-- Backfill: Add signup logs for existing businesses that don't have one
INSERT INTO activity_logs (user_id, entity_type, entity_id, action, details, created_at)
SELECT 
  p.user_id,
  'business',
  p.user_id,
  'signup',
  jsonb_build_object(
    'business_name', p.business_name,
    'contact_name', p.contact_name,
    'postcode', p.postcode,
    'phone', p.phone,
    'whatsapp_optin', p.whatsapp_optin
  ),
  p.created_at
FROM profiles p
WHERE p.business_name IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM activity_logs al 
    WHERE al.user_id = p.user_id 
    AND al.action = 'signup' 
    AND al.entity_type = 'business'
  );