# Legacy isolation release audit

## Scope and identity

- Product: Cleanda legacy marketplace
- Domain: `https://cleanda.co.uk`
- Repository: `opoptolu-pixel/lead-weaver-59`
- Live backend project: `jqyhiekqqcffiwpctzsi`
- Observable published deployment: `e2b349e3-5ecf-44e5-9b78-e5ae0b5e912c`
- Published commit SHA: unknown; the available deployment metadata does not expose a commit mapping. Frontend publication is therefore blocked.
- Expected pre-work HEAD: `58d8a0b`
- Inspected commit for the type-syntax question: `2b3b513e8897cf45c8c6346fa9ac6a223331d2cb` (present on `origin/main`)
- Current local HEAD at time of writing: `90018ca`, three commits ahead of `origin/main`, working tree clean

## Commit inspection

`2b3b513` changes exactly one file: `src/integrations/supabase/types.ts`.
It makes ten type-syntax additions and ten removals, wrapping the conditional type in parentheses for `Tables`, `TablesInsert`, `TablesUpdate`, `Enums`, and `CompositeTypes`. It does not add or remove table fields. `legacy_cleanup_snapshots` is already present in the generated types at the parent commit, so this commit solely changes generated TypeScript syntax and does not alter runtime application behaviour or represent a new containment migration.

## Authoritative live evidence collected read-only

- Project identity: `jqyhiekqqcffiwpctzsi`.
- Containment migration snapshot batch: `legacy_managed_agency_cleanup_20260901`, previously verified with 28 records.
- Contained cron jobs remain inactive: `process-cleaner-job-notifications-every-5min`, `process-cleaner-compliance-reminders-daily`, `recurring-clean-billing-daily`.
- Contained enqueue triggers remain disabled, including `schedule_cleaner_right_to_work_reminders_trigger`; the other two expected names are part of the previously verified containment batch.
- Legacy cron jobs remain active: `process-scheduled-emails`, `auto-publish-leads-hourly`, `insurance-expiry-reminder-daily`, `sync-google-ads-hourly`, `sync-facebook-ads-every-2-hours`, `process-email-sequences-every-5min`, `send-booking-reminders-daily`, `daily-facebook-ads-sync`, and `daily-google-ads-sync`.
- Public routines found for agency/notification/reminder filters: `queue_cleaner_job_notifications` and `reschedule_cleaner_job_notifications` trigger functions.
- The available Lovable Cloud deployment metadata endpoint exposes production identity but not deployed function names, versions, or per-function JWT settings. No function endpoint was invoked to compensate.

## Repository source inventory and classification

Required legacy marketplace source is present for: `submit-cleaning-request`, `customer-confirmation`, `twilio-webhook`, `auto-publish-leads`, `send-sms-notification`, `unlock-lead`, `verify-payment`, `buy-credits`, `verify-credits`, `use-credit`, `stripe-webhook`, `send-email`, `process-email-sequences`, `process-scheduled-emails`, `send-booking-reminders`, and `insurance-expiry-reminder`.

`process-cleaner-job-notifications` is the only conclusively verified agency-only function with repository source and has been changed locally to a non-mutating HTTP 410 gate. The other named agency-only functions (`process-cleaner-compliance-reminders`, `process-recurring-clean-visits`, `send-agency-quote`, `submit-service-request`, `resolve-no-show-customer`, `process-agency-balances`, `send-recurring-payment-setup`, and `send-inbox-email`) were not present in repository source, and no gate is proposed without authoritative deployed metadata. Their classification remains ambiguous at the deployment level.

## Inbound receipt migration (APPLIED to the live legacy project)

Filename: `20260902104048_645c091a-4cc4-4824-b48a-f7f68b94d4a0.sql`

This migration was applied to the live legacy project during this release by the managed migration tool. It must not be reapplied. The live table was verified read-only: RLS enabled, no policies, `anon` and `authenticated` have no SELECT privilege, `service_role` does. Automated retention cleanup for `retention_expires_at` is not yet implemented.


```sql
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
```

Safety properties: unique `MessageSid` claim, service-role-only access, no message body, no notification trigger, retention metadata, and no client reads or writes.

## Local test plan and rollback

- Signature tests cover valid, missing, tampered, and payload-mismatch signatures.
- Reply tests cover YES/NO and ambiguous text.
- Idempotency tests cover concurrent same-SID claim and one completion.
- Known test gaps: no in-handler signature-header test, no in-flight duplicate test against the real claim path, and no URL/query-string signature variant test.
- No test contacts Twilio, Resend, Stripe, postcodes.io, WhatsApp, or any external provider.
- Remaining backend-only deployment scope: `twilio-webhook`, the 410 gate for `process-cleaner-job-notifications`, the isolation check, mocked tests, and this audit document. The receipt migration is already live and must not be reapplied. No frontend publication.
- Rollback: for local-only work, revert the files. After a future approved deployment, restore the prior `twilio-webhook` and gate sources; leave the receipt table in place for audit history, or remove it only through a separately approved migration after confirming no receipts are needed.
