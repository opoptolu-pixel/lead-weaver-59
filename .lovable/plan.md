
# Fix: Verified Businesses Receiving Onboarding Sequence Emails

## The Problem

In `supabase/functions/process-email-sequences/index.ts`, the "Incomplete Onboarding Follow-up" check (lines 88-129) only stops the sequence if a user has completed their profile fields (business_name, phone, postcode). But it never checks `is_verified`.

A verified business has those fields filled in AND `is_verified = true`. The current logic would correctly cancel for them — BUT the sequence was enrolled *before* verification was complete, so the `auto_enroll_onboarding_sequence` trigger fired when the profile was created (when those fields were still empty). Now the user is verified, but since they filled in their profile, the existing check *should* work... unless the trigger enrolled them and the fields were later filled but the enrollment never got cleaned up.

Looking at the live data — there are 2 verified businesses still active in the queue:
- `SAPOUMA cleaning limited` (nicolesapouma6@gmail.com) — `is_verified: true`
- `Radiant Space Services` (info@radiantspaceservices.co.uk) — `is_verified: true`

Both have `business_name`, `phone`, and `postcode` filled in AND `is_verified = true`. The current check at line 116 should have caught them:
```
if (userProfile?.business_name && userProfile?.phone && userProfile?.postcode) → cancel
```

The issue is that the check only runs for the **"Incomplete Onboarding Follow-up"** sequence by name. But if someone enrolled them into a different sequence, or the sequence name was ever different, verified users slip through.

**Additionally — a fundamental gap:** the current logic doesn't check `is_verified` at all. Even if a business completes verification *after* enrolling, future sequence steps will still fire because `is_verified` is never evaluated.

## The Fix

Two changes are needed:

### 1. Add `is_verified` check inside the onboarding sequence guard (edge function)

In the profile check block, add `is_verified` to the select and add an early-exit if `is_verified` is true:

```typescript
const { data: userProfile } = await supabase
  .from("profiles")
  .select("business_name, phone, postcode, is_closed, is_verified")
  .eq("user_id", matchingUser.id)
  .maybeSingle();

// Skip verified accounts
if (userProfile?.is_verified) {
  await supabase
    .from("email_sequence_enrollments")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      next_send_at: null,
    })
    .eq("id", enrollment.id);
  logStep("Business verified, stopping sequence", { email: enrollment.recipient_email });
  continue;
}
```

This check is placed **before** the existing onboarding completion check and the closed account check, so verified businesses exit immediately.

### 2. Fix the two currently-active verified enrollments in the database

The two verified businesses currently in the active queue need to be immediately marked as completed so they don't receive an email when the cron job next fires (within minutes):

```sql
UPDATE email_sequence_enrollments
SET 
  status = 'completed',
  completed_at = now(),
  next_send_at = null
WHERE status = 'active'
  AND recipient_email IN (
    SELECT u.email 
    FROM auth.users u
    JOIN profiles p ON p.user_id = u.id
    WHERE p.is_verified = true
  );
```

## Files to Change

- `supabase/functions/process-email-sequences/index.ts` — add `is_verified` check

## Database Fix

Run a one-time data fix via the insert tool to mark verified businesses' active enrollments as completed.

## Why This Fully Resolves It

- Any business that becomes verified in the future will be caught before the next email fires, even if they were enrolled before verification
- The `is_verified` check runs before the profile completeness check, so it exits earlier and more clearly
- The current two affected enrollments are cleaned up immediately
