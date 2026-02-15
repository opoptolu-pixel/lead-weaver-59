
CREATE OR REPLACE FUNCTION public.auto_enroll_onboarding_sequence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sequence_id UUID;
  v_first_step RECORD;
  v_user_email TEXT;
BEGIN
  -- Find the onboarding sequence
  SELECT id INTO v_sequence_id
  FROM email_sequences
  WHERE name = 'Incomplete Onboarding Follow-up' AND status = 'active'
  LIMIT 1;

  IF v_sequence_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get user email from auth.users
  SELECT email INTO v_user_email FROM auth.users WHERE id = NEW.user_id;

  IF v_user_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get the first step's delay
  SELECT delay_days, delay_hours INTO v_first_step
  FROM email_sequence_steps
  WHERE sequence_id = v_sequence_id AND step_order = 1 AND is_active = true
  LIMIT 1;

  IF v_first_step IS NULL THEN
    RETURN NEW;
  END IF;

  -- Enroll the user
  INSERT INTO email_sequence_enrollments (
    sequence_id, recipient_email, recipient_name, recipient_type, status, next_send_at
  ) VALUES (
    v_sequence_id,
    v_user_email,
    NEW.contact_name,
    'business',
    'active',
    now() + (v_first_step.delay_days * INTERVAL '1 day') + (v_first_step.delay_hours * INTERVAL '1 hour')
  );

  RETURN NEW;
END;
$function$;

CREATE TRIGGER auto_enroll_onboarding_reminder
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_enroll_onboarding_sequence();
