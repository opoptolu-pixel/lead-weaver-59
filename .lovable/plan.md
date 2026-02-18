
# Bounced Emails Blacklist

## What We're Building

A suppression list system that automatically blocks future emails to addresses that have permanently bounced, protecting your domain reputation with email providers like Gmail and Outlook. Sending to known bad addresses is one of the top reasons domains get flagged as spam.

## How It Works

```text
Email bounces (hard bounce)
        │
        ▼
Resend Webhook fires "email.bounced"
        │
        ▼
resend-webhook function detects hard bounce
        │
        ▼
Auto-adds email to "email_suppressions" table
        │
        ▼
send-email / process-email-sequences /        
process-scheduled-emails all check table     
        │
        ▼
Email is silently skipped — domain stays clean
```

## Changes Required

### 1. New Database Table: `email_suppressions`
A new table to store suppressed/blacklisted email addresses with the reason and timestamp.

```
email_suppressions
├── id (uuid)
├── email (text, unique)
├── reason (text) — "hard_bounce", "complained", "manual"
├── bounce_type (text) — "permanent", "temporary", etc.
├── source_resend_id (text) — which email caused it
├── suppressed_at (timestamp)
├── notes (text) — admin notes
└── created_at (timestamp)
```

RLS: Admins only (read/write). Service role for webhook inserts.

### 2. Update `resend-webhook` Function
When a **hard/permanent bounce** event arrives from Resend, automatically insert the email into `email_suppressions`. The webhook already receives `data.bounce.type` — we'll use this to distinguish:
- `permanent` → add to blacklist
- `temporary` (soft bounce like mailbox full) → log only, don't suppress

For `email.complained` events, also add to suppressions with reason `complained`.

### 3. Update All 3 Email-Sending Functions
Add a suppression check before sending in each function:

- **`send-email/index.ts`** — Already checks unsubscribe list. Add parallel check on `email_suppressions`.
- **`process-email-sequences/index.ts`** — Currently has no suppression check. Add it before the Resend API call.
- **`process-scheduled-emails/index.ts`** — Currently only checks unsubscribes. Add suppression check.

### 4. New Admin UI: `EmailSuppressionsPanel` Component
A new tab in the Email Templates admin page ("Suppressions") showing:
- Table of all suppressed emails with reason, date, and source
- Ability to manually add an email to the suppression list
- Ability to remove an email from the list (un-suppress) with a confirmation dialog
- Badge counts: hard bounces vs complaints vs manual

### 5. Add "Suppressions" Tab to `AdminEmailTemplates.tsx`
Add a fourth tab alongside Templates / Scheduled / Delivery Tracking.

## Technical Detail

**Bounce type detection in the webhook:**
Resend sends `data.bounce.type` as one of:
- `"permanent"` — hard bounce, address doesn't exist → suppress
- `"temporary"` — soft bounce, transient issue → don't suppress
- `null` / unknown → treat as hard bounce to be safe

**No duplicate inserts:** The `email` column will have a UNIQUE constraint, so if the same address bounces multiple times the insert will use `ON CONFLICT DO NOTHING` (no errors, just silently ignored).

**Impact on existing unsubscribe flow:** The suppression check is independent of the unsubscribe list — both will be checked. A suppressed address cannot receive email even if somehow still "subscribed".

## Files to Create / Modify

| File | Action |
|---|---|
| Database migration | Create `email_suppressions` table + RLS |
| `supabase/functions/resend-webhook/index.ts` | Auto-add hard bounces & complaints to suppressions |
| `supabase/functions/send-email/index.ts` | Check suppressions before sending |
| `supabase/functions/process-email-sequences/index.ts` | Check suppressions before sending |
| `supabase/functions/process-scheduled-emails/index.ts` | Check suppressions before sending |
| `src/components/admin/EmailSuppressionsPanel.tsx` | New component — suppression list UI |
| `src/pages/admin/AdminEmailTemplates.tsx` | Add "Suppressions" tab |
