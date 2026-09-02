-- PROPOSED, NOT APPLIED.
-- Corrective at-most-once inbound webhook + notification outbox design.
-- This file is deliberately stored outside supabase/migrations so that it cannot be
-- picked up or executed without explicit approval.

BEGIN;

-- 1. Receipt state machine ---------------------------------------------------

ALTER TABLE public.twilio_inbound_receipts
  DROP CONSTRAINT IF EXISTS twilio_inbound_receipts_status_check;

ALTER TABLE public.twilio_inbound_receipts
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS attempt_count integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS acknowledgement text,
  ADD COLUMN IF NOT EXISTS outcome_unknown_reason text;

UPDATE public.twilio_inbound_receipts SET status = 'failed_retryable' WHERE status = 'failed';

ALTER TABLE public.twilio_inbound_receipts
  ADD CONSTRAINT twilio_inbound_receipts_status_check
  CHECK (status IN ('processing', 'completed', 'failed_retryable', 'outcome_unknown', 'permanently_failed'));

-- 2. Notification outbox -----------------------------------------------------

CREATE TABLE IF NOT EXISTS public.notification_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid text NOT NULL,
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  recipient text NOT NULL,
  recipient_user_id uuid,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'claimed', 'dispatched', 'skipped', 'failed_retryable', 'outcome_unknown', 'permanently_failed')),
  attempt_count integer NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  dispatch_started_at timestamptz,
  dispatched_at timestamptz,
  provider_reference text,
  outcome_unknown_reason text,
  last_error text,
  attempt_history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notification_intents_business_key
    UNIQUE (message_sid, lead_id, notification_type, recipient)
);

GRANT ALL ON public.notification_intents TO service_role;
REVOKE ALL ON public.notification_intents FROM anon, authenticated;
ALTER TABLE public.notification_intents ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_notification_intents_updated_at ON public.notification_intents;
CREATE TRIGGER set_notification_intents_updated_at
  BEFORE UPDATE ON public.notification_intents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Receipt claim with lease recovery ---------------------------------------

CREATE OR REPLACE FUNCTION public.twilio_claim_inbound_receipt(
  p_message_sid text,
  p_lease_seconds integer DEFAULT 120
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.twilio_inbound_receipts;
  v_claimed boolean := false;
BEGIN
  INSERT INTO public.twilio_inbound_receipts (
    message_sid, status, response_kind, processing_started_at, lease_expires_at, attempt_count
  )
  VALUES (
    p_message_sid, 'processing', 'error', now(), now() + make_interval(secs => p_lease_seconds), 1
  )
  ON CONFLICT (message_sid) DO NOTHING
  RETURNING * INTO v_row;

  IF v_row.id IS NOT NULL THEN
    RETURN jsonb_build_object('claimed', true, 'recovered', false, 'receipt', to_jsonb(v_row));
  END IF;

  SELECT * INTO v_row
  FROM public.twilio_inbound_receipts
  WHERE message_sid = p_message_sid
  FOR UPDATE;

  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'receipt lookup failed for %', p_message_sid;
  END IF;

  -- Abandoned-lease recovery: only expired 'processing' or 'failed_retryable'
  -- receipts may be reclaimed. 'completed', 'outcome_unknown' and
  -- 'permanently_failed' are terminal for automatic processing.
  IF (v_row.status = 'processing' AND coalesce(v_row.lease_expires_at, v_row.processing_started_at) < now())
     OR v_row.status = 'failed_retryable' THEN
    UPDATE public.twilio_inbound_receipts
    SET status = 'processing',
        lease_expires_at = now() + make_interval(secs => p_lease_seconds),
        attempt_count = v_row.attempt_count + 1
    WHERE id = v_row.id
    RETURNING * INTO v_row;
    v_claimed := true;
  END IF;

  RETURN jsonb_build_object('claimed', v_claimed, 'recovered', v_claimed, 'receipt', to_jsonb(v_row));
END;
$$;

-- 4. Atomic lead transition + notification intent creation -------------------

CREATE OR REPLACE FUNCTION public.twilio_transition_lead_and_create_intents(
  p_message_sid text,
  p_lead_id uuid,
  p_new_status text,
  p_confirmation_response text,
  p_notification_type text,
  p_recipients jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated uuid;
  v_recipient jsonb;
  v_intents jsonb;
BEGIN
  IF p_new_status NOT IN ('published', 'spam') THEN
    RAISE EXCEPTION 'unsupported transition target %', p_new_status;
  END IF;

  UPDATE public.leads
  SET lead_status = p_new_status,
      confirmation_response = p_confirmation_response,
      published_at = CASE WHEN p_new_status = 'published' THEN now() ELSE published_at END
  WHERE id = p_lead_id
    AND lead_status = 'pending_confirmation'
  RETURNING id INTO v_updated;

  -- Only the transaction that actually moved the lead out of pending_confirmation
  -- may create notification intents.
  IF v_updated IS NULL THEN
    RETURN jsonb_build_object('transitioned', false, 'intents', '[]'::jsonb);
  END IF;

  INSERT INTO public.activity_logs (user_id, entity_type, entity_id, action, details)
  VALUES (
    '00000000-0000-0000-0000-000000000000',
    'lead', p_lead_id, 'customer_response',
    jsonb_build_object(
      'previous_status', 'pending_confirmation',
      'new_status', p_new_status,
      'is_positive', p_new_status = 'published',
      'method', 'sms',
      'message_sid', p_message_sid
    )
  );

  IF p_new_status = 'published' THEN
    FOR v_recipient IN SELECT * FROM jsonb_array_elements(coalesce(p_recipients, '[]'::jsonb))
    LOOP
      INSERT INTO public.notification_intents (
        message_sid, lead_id, notification_type, recipient, recipient_user_id
      )
      VALUES (
        p_message_sid,
        p_lead_id,
        p_notification_type,
        v_recipient->>'recipient',
        nullif(v_recipient->>'recipient_user_id', '')::uuid
      )
      ON CONFLICT ON CONSTRAINT notification_intents_business_key DO NOTHING;
    END LOOP;
  END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.recipient), '[]'::jsonb)
  INTO v_intents
  FROM public.notification_intents n
  WHERE n.message_sid = p_message_sid
    AND n.lead_id = p_lead_id
    AND n.notification_type = p_notification_type;

  RETURN jsonb_build_object('transitioned', true, 'intents', v_intents);
END;
$$;

-- 5. Intent claim / outcome recording ----------------------------------------

CREATE OR REPLACE FUNCTION public.twilio_claim_notification_intent(
  p_intent_id uuid,
  p_lease_seconds integer DEFAULT 120
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  -- Only never-started ('pending') or definitively-rejected ('failed_retryable')
  -- intents may be claimed. A 'claimed' row already has dispatch_started_at set and
  -- is never automatically reclaimed; 'outcome_unknown' and 'dispatched' are terminal.
  UPDATE public.notification_intents
  SET status = 'claimed',
      attempt_count = attempt_count + 1,
      dispatch_started_at = now(),
      lease_expires_at = now() + make_interval(secs => p_lease_seconds),
      attempt_history = attempt_history || jsonb_build_object('claimed_at', now())
  WHERE id = p_intent_id
    AND status IN ('pending', 'failed_retryable')
  RETURNING id INTO v_id;

  RETURN v_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.twilio_record_notification_outcome(
  p_intent_id uuid,
  p_status text,
  p_provider_reference text DEFAULT NULL,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('dispatched', 'skipped', 'failed_retryable', 'outcome_unknown', 'permanently_failed') THEN
    RAISE EXCEPTION 'unsupported notification outcome %', p_status;
  END IF;

  UPDATE public.notification_intents
  SET status = p_status,
      dispatched_at = CASE WHEN p_status = 'dispatched' THEN now() ELSE dispatched_at END,
      provider_reference = coalesce(p_provider_reference, provider_reference),
      outcome_unknown_reason = CASE WHEN p_status = 'outcome_unknown'
        THEN left(coalesce(p_error, 'indeterminate provider response'), 500) ELSE outcome_unknown_reason END,
      last_error = CASE WHEN p_status IN ('failed_retryable', 'permanently_failed', 'outcome_unknown')
        THEN left(coalesce(p_error, ''), 1000) ELSE NULL END,
      lease_expires_at = NULL,
      attempt_history = attempt_history || jsonb_build_object('outcome', p_status, 'at', now(), 'reference', p_provider_reference)
  WHERE id = p_intent_id;
END;
$$;

-- 6. Receipt completion ------------------------------------------------------

CREATE OR REPLACE FUNCTION public.twilio_finalize_inbound_receipt(
  p_receipt_id uuid,
  p_status text,
  p_lead_id uuid DEFAULT NULL,
  p_transition_status text DEFAULT NULL,
  p_response_kind text DEFAULT NULL,
  p_acknowledgement text DEFAULT NULL,
  p_notification_dispatched boolean DEFAULT false,
  p_error text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('completed', 'failed_retryable', 'outcome_unknown', 'permanently_failed') THEN
    RAISE EXCEPTION 'unsupported receipt status %', p_status;
  END IF;

  UPDATE public.twilio_inbound_receipts
  SET status = p_status,
      completed_at = CASE WHEN p_status = 'completed' THEN now() ELSE completed_at END,
      lead_id = coalesce(p_lead_id, lead_id),
      transition_status = coalesce(p_transition_status, transition_status),
      response_kind = coalesce(p_response_kind, response_kind),
      acknowledgement = coalesce(p_acknowledgement, acknowledgement),
      notification_dispatched = p_notification_dispatched,
      outcome_unknown_reason = CASE WHEN p_status = 'outcome_unknown'
        THEN left(coalesce(p_error, 'indeterminate provider response'), 500) ELSE outcome_unknown_reason END,
      last_error = CASE WHEN p_status = 'completed' THEN NULL ELSE left(coalesce(p_error, ''), 1000) END,
      lease_expires_at = NULL
  WHERE id = p_receipt_id;
END;
$$;

-- 7. Recipient resolution ----------------------------------------------------
--
-- LEGACY MARKETPLACE ONLY. Recipients are cleaning businesses in public.profiles.
-- The managed-agency tables (cleaner_profiles, cleaner_service_areas,
-- cleaner_service_capabilities) are contained and must NOT be referenced here:
-- doing so would re-couple the legacy dispatch path to the Manchester project.
--
-- Phone numbers are normalised to a UK E.164 digit string so that one physical
-- handset can never receive two notifications for the same lead, whatever
-- format each profile stored.

CREATE OR REPLACE FUNCTION public.lead_notification_recipients(p_lead_id uuid)
RETURNS TABLE(recipient text, recipient_user_id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH normalised AS (
    SELECT
      CASE
        WHEN regexp_replace(p.phone, '\D', '', 'g') LIKE '44%'
          THEN regexp_replace(p.phone, '\D', '', 'g')
        WHEN regexp_replace(p.phone, '\D', '', 'g') LIKE '0%'
          THEN '44' || substr(regexp_replace(p.phone, '\D', '', 'g'), 2)
        ELSE '44' || regexp_replace(p.phone, '\D', '', 'g')
      END AS recipient,
      p.user_id AS recipient_user_id
    FROM public.profiles p
    WHERE p.whatsapp_optin = true
      AND p.phone IS NOT NULL
      AND length(regexp_replace(p.phone, '\D', '', 'g')) >= 10
      AND p.postcode IS NOT NULL
      AND coalesce(p.is_closed, false) = false
      AND coalesce(p.is_suspended, false) = false
      AND EXISTS (
        SELECT 1 FROM public.leads l
        WHERE l.id = p_lead_id AND l.lead_status = 'published'
      )
  )
  SELECT DISTINCT ON (recipient) recipient, recipient_user_id
  FROM normalised
  ORDER BY recipient, recipient_user_id;
$$;

REVOKE ALL ON FUNCTION public.twilio_claim_inbound_receipt(text, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.twilio_transition_lead_and_create_intents(text, uuid, text, text, text, jsonb) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.twilio_claim_notification_intent(uuid, integer) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.twilio_record_notification_outcome(uuid, text, text, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.twilio_finalize_inbound_receipt(uuid, text, uuid, text, text, text, boolean, text) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.lead_notification_recipients(uuid) FROM anon, authenticated;

COMMIT;
