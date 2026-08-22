-- Record successful booking-confirmation email delivery and make webhook
-- retries idempotent. The webhook claims this timestamp before sending and
-- clears it if delivery fails so Stripe can retry safely.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS payment_confirmation_sent_at timestamptz;

INSERT INTO public.platform_schema_versions(version, description)
VALUES (
  '20260816280000',
  'Idempotent customer email after agency Stripe payment confirmation'
)
ON CONFLICT (version) DO UPDATE SET description = excluded.description;

NOTIFY pgrst, 'reload schema';
