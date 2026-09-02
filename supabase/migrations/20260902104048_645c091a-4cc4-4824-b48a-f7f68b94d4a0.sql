BEGIN;

CREATE TABLE IF NOT EXISTS public.twilio_inbound_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processing_started_at timestamptz,
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  transition_status text CHECK (transition_status IN ('published', 'spam', 'cancelled', 'unchanged', 'unmatched', 'unclear', 'invalid')),
  response_kind text NOT NULL CHECK (response_kind IN ('confirmed', 'cancelled', 'already_confirmed', 'unmatched', 'unclear', 'invalid', 'error')),
  notification_dispatched boolean NOT NULL DEFAULT false,
  last_error text,
  retention_expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days'),
  CONSTRAINT twilio_inbound_receipts_message_sid_key UNIQUE (message_sid)
);

GRANT ALL ON public.twilio_inbound_receipts TO service_role;
REVOKE ALL ON public.twilio_inbound_receipts FROM anon, authenticated;
ALTER TABLE public.twilio_inbound_receipts ENABLE ROW LEVEL SECURITY;

COMMIT;