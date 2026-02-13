

## Plan: Fix Old "Deep Clean" Branding and Password Reset Email

### Problem
1. **Password reset emails** show "Deep-Clean-Co-UK" as the sender name and come from `no-reply@auth.lovable.cloud` with a Lovable-branded link -- going to spam
2. The `admin_settings` database still has the old support email `support@deepcleanco.uk`

### Root Cause
The password reset uses the **built-in auth email system** (`supabase.auth.resetPasswordForEmail()`), which sends from the default auth infrastructure with the old project name. This cannot be customized directly. To fix this, we need to **replace it with a custom password reset flow** that sends branded emails through Resend (your verified `cleanda.co.uk` domain).

### What Will NOT Change
Service type names like "Deep Clean (3+ Rooms)", "One-Off Deep Clean", "Post-Construction Deep Clean" are **legitimate cleaning service descriptions**, not old branding. These stay as-is.

---

### Changes

#### 1. New Edge Function: `send-password-reset` 
A custom edge function that:
- Generates a password reset link using the admin API
- Sends a branded email through Resend using the existing `password_reset` email template
- Sends from `hello@cleanda.co.uk` (your verified domain) instead of `no-reply@auth.lovable.cloud`
- Sender name shows "Cleanda" not "Deep-Clean-Co-UK"

#### 2. Update `src/pages/Auth.tsx`
Replace the direct `supabase.auth.resetPasswordForEmail()` call with a call to the new `send-password-reset` edge function, so all password reset emails go through Resend.

#### 3. Update `supabase/config.toml`
Add the new `send-password-reset` function config with `verify_jwt = false`.

#### 4. Database Fix: Update `admin_settings`
Run a migration to update the `site_config` record, changing `supportEmail` from `support@deepcleanco.uk` to `hello@cleanda.co.uk`.

---

### Technical Details

**Custom Password Reset Flow:**

```text
User clicks "Forgot Password"
  --> Calls send-password-reset edge function
    --> Uses Supabase Admin API to generate reset link
    --> Sends branded email via Resend (hello@cleanda.co.uk)
    --> User receives email from "Cleanda" with cleanda.co.uk domain
      --> Clicks link, redirected to /auth to set new password
```

**Why this fixes the spam issue:**
- Emails will come from your verified `cleanda.co.uk` domain via Resend
- Proper DKIM/SPF/DMARC already configured for that domain
- No more `auth.lovable.cloud` sender that triggers spam filters
- Sender name will be "Cleanda" instead of "Deep-Clean-Co-UK"

