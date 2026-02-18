
# Skip Email Confirmation — Auto Sign In After Signup

## The Problem

Right now, when a user clicks "Create Account", the flow is:
1. Edge function creates user with `email_confirm: false`
2. Sends a branded confirmation email via Resend
3. User must go to their inbox, open the email, click the link
4. Only then do they get signed in and land on onboarding

You want: click "Create Account" → immediately signed in → straight to `/onboarding`. No email detour.

## What Changes

### 1. `supabase/functions/signup-with-confirmation/index.ts` — Auto-confirm + sign in

Instead of creating the user with `email_confirm: false` and generating a link, we:
- Create the user with `email_confirm: true` so they're immediately active
- Sign them in server-side and return a `session` (access token + refresh token) back to the client
- Still send a **welcome email** via Resend (not a confirmation gate — just a "Welcome to Cleanda" message)

```typescript
// Create user with email auto-confirmed
const { data: userData, error } = await supabaseAdmin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,  // ← changed from false
});

// Sign them in immediately to get a session
const { data: sessionData } = await supabaseAdmin.auth.admin.signInWithPassword({ email, password });

// Return session to client
return Response({ session: sessionData.session, userId: userData.user.id })
```

### 2. `src/pages/Auth.tsx` — Use returned session to log user in instantly

After the edge function succeeds, instead of showing "check your email" toast, we:
- Take the `session` object returned from the edge function
- Call `supabase.auth.setSession({ access_token, refresh_token })` to sign the user in on the client
- Navigate directly to `/onboarding`

```typescript
const { session } = data;
if (session) {
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  trackCleanerSignup();
  navigate("/onboarding");
}
```

### 3. Welcome email (not a gate)

The email sent via Resend becomes a **welcome/receipt email** — it arrives in their inbox as confirmation that the account was created, but they don't need to click anything in it. The subject line and body will be updated to reflect this (e.g. "Welcome to Cleanda — you're all set!").

The `confirm-signup` mode and token verification logic in `Auth.tsx` can remain as-is for any old links that may still be in inboxes — they'll just redirect to dashboard if valid. No removal needed.

## User Experience After This Change

```text
Fill email + password → Click "Create Account"
        ↓
Account created instantly (auto-confirmed)
        ↓
Signed in immediately (no email required)
        ↓
→ /onboarding (collect name, business, phone, postcode)
        ↓
→ /dashboard (gated — only after all 4 fields are complete)

Meanwhile, a welcome email arrives in inbox (no action needed)
```

## Files to Edit

1. `supabase/functions/signup-with-confirmation/index.ts`
   - Set `email_confirm: true`
   - Sign the user in and return the session
   - Update the email from a "confirm gate" to a "welcome" email

2. `src/pages/Auth.tsx`
   - After successful signup response, call `supabase.auth.setSession()` with the returned tokens
   - Navigate to `/onboarding` instead of showing "check your email" toast
   - Remove the "Account created! Please check your email" message

## What Does NOT Change

- The dashboard and leads gating we already implemented remains fully in place
- Login flow is completely unchanged
- Password reset flow is completely unchanged
- Magic link flow is completely unchanged
- Admin auth is completely unchanged
- Duplicate email detection (409 handling) remains the same
