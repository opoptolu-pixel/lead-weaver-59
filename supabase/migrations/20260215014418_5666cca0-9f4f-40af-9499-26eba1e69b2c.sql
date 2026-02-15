
CREATE OR REPLACE FUNCTION public.auto_enroll_onboarding_sequence()
RETURNS TRIGGER AS $$
DECLARE
  v_sequence_id uuid;
  v_first_step_delay_days int;
  v_first_step_delay_hours int;
  v_user_email text;
  v_contact_name text;
  v_existing_enrollment_id uuid;
BEGIN
  -- Skip closed accounts
  IF NEW.is_closed = true THEN
    RETURN NEW;
  END IF;

  -- Only trigger when profile is missing key onboarding fields
  IF NEW.business_name IS NOT NULL AND NEW.phone IS NOT NULL AND NEW.postcode IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Find the onboarding sequence
  SELECT id INTO v_sequence_id
  FROM public.email_sequences
  WHERE name = 'Incomplete Onboarding Follow-up'
    AND status = 'active'
  LIMIT 1;

  IF v_sequence_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get user email
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = NEW.user_id;

  IF v_user_email IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if already enrolled
  SELECT id INTO v_existing_enrollment_id
  FROM public.email_sequence_enrollments
  WHERE sequence_id = v_sequence_id
    AND recipient_email = v_user_email
    AND status = 'active'
  LIMIT 1;

  IF v_existing_enrollment_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get first step delay
  SELECT delay_days, delay_hours INTO v_first_step_delay_days, v_first_step_delay_hours
  FROM public.email_sequence_steps
  WHERE sequence_id = v_sequence_id
    AND step_order = 1
    AND is_active = true
  LIMIT 1;

  IF v_first_step_delay_days IS NULL THEN
    v_first_step_delay_days := 1;
    v_first_step_delay_hours := 0;
  END IF;

  v_contact_name := COALESCE(NEW.contact_name, split_part(v_user_email, '@', 1));

  INSERT INTO public.email_sequence_enrollments (
    sequence_id, recipient_email, recipient_name, recipient_type, status, next_send_at
  ) VALUES (
    v_sequence_id, v_user_email, v_contact_name, 'business', 'active',
    now() + (v_first_step_delay_days || ' days')::interval + (v_first_step_delay_hours || ' hours')::interval
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
