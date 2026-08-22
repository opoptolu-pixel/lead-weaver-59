
-- 1. Lookup helpers
CREATE OR REPLACE FUNCTION public.is_closed_account_email(_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.profiles p ON p.user_id = u.id
    WHERE lower(u.email) = lower(trim(coalesce(_email, '')))
      AND coalesce(p.is_closed, false)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_closed_account_phone(_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE coalesce(p.is_closed, false)
      AND p.phone IS NOT NULL
      AND length(regexp_replace(p.phone, '\D', '', 'g')) >= 9
      AND right(regexp_replace(p.phone, '\D', '', 'g'), 9)
          = right(regexp_replace(coalesce(_phone, ''), '\D', '', 'g'), 9)
  );
$$;

REVOKE ALL ON FUNCTION public.is_closed_account_email(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_closed_account_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_closed_account_email(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_closed_account_phone(text) TO authenticated, service_role;

-- 2. Closure clean-up
CREATE OR REPLACE FUNCTION public.handle_account_closure()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT lower(u.email) INTO v_email FROM auth.users u WHERE u.id = NEW.user_id;
  IF v_email IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE public.email_subscribers
     SET is_active = false,
         unsubscribed_at = coalesce(unsubscribed_at, now()),
         updated_at = now()
   WHERE lower(email) = v_email
     AND is_active;

  INSERT INTO public.email_suppressions (email, reason, notes)
  SELECT v_email, 'account_closed', 'Business account closed - all communications blocked'
  WHERE NOT EXISTS (
    SELECT 1 FROM public.email_suppressions s WHERE lower(s.email) = v_email
  );

  UPDATE public.scheduled_emails
     SET status = 'cancelled',
         error_message = 'Recipient account closed',
         updated_at = now()
   WHERE lower(recipient_email) = v_email
     AND status = 'pending';

  UPDATE public.email_sequence_enrollments
     SET status = 'unsubscribed',
         next_send_at = NULL,
         updated_at = now()
   WHERE lower(recipient_email) = v_email
     AND status = 'active';

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_account_closure() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_handle_account_closure ON public.profiles;
CREATE TRIGGER trg_handle_account_closure
AFTER UPDATE OF is_closed ON public.profiles
FOR EACH ROW
WHEN (coalesce(NEW.is_closed, false) AND NOT coalesce(OLD.is_closed, false))
EXECUTE FUNCTION public.handle_account_closure();

-- 3. Backfill already-closed accounts
WITH closed AS (
  SELECT lower(u.email) AS email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.user_id
  WHERE coalesce(p.is_closed, false) AND u.email IS NOT NULL
)
UPDATE public.email_subscribers s
   SET is_active = false,
       unsubscribed_at = coalesce(s.unsubscribed_at, now()),
       updated_at = now()
  FROM closed c
 WHERE lower(s.email) = c.email AND s.is_active;

INSERT INTO public.email_suppressions (email, reason, notes)
SELECT DISTINCT lower(u.email), 'account_closed', 'Business account closed - all communications blocked'
FROM public.profiles p
JOIN auth.users u ON u.id = p.user_id
WHERE coalesce(p.is_closed, false)
  AND u.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.email_suppressions s WHERE lower(s.email) = lower(u.email));

UPDATE public.scheduled_emails se
   SET status = 'cancelled',
       error_message = 'Recipient account closed',
       updated_at = now()
 WHERE se.status = 'pending'
   AND EXISTS (
     SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
     WHERE coalesce(p.is_closed, false) AND lower(u.email) = lower(se.recipient_email)
   );

UPDATE public.email_sequence_enrollments e
   SET status = 'unsubscribed',
       next_send_at = NULL,
       updated_at = now()
 WHERE e.status = 'active'
   AND EXISTS (
     SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.user_id
     WHERE coalesce(p.is_closed, false) AND lower(u.email) = lower(e.recipient_email)
   );
