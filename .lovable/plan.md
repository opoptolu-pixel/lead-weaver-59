

## Fix: Auto-Use Saved Payment Methods for Lead Unlocks

### Problem

When a user unlocks a lead directly (not via credits), the `unlock-lead` edge function creates a Stripe Checkout session without linking to the user's existing Stripe customer record. This forces them to re-enter card details every time, even if they already have a saved card.

The `buy-credits` function already handles this correctly -- it looks up the Stripe customer by email and passes `customer: customerId` to the session.

### Fix

Update `supabase/functions/unlock-lead/index.ts` to look up the existing Stripe customer (by email) and pass it to the checkout session, just like `buy-credits` does.

### Technical Details

**File: `supabase/functions/unlock-lead/index.ts`**

When creating the Stripe Checkout session (around line 169), add customer lookup logic:

1. If the user is authenticated, retrieve their email from the auth user object
2. Look up the existing Stripe customer by email: `stripe.customers.list({ email, limit: 1 })`
3. If found, pass `customer: customerId` to the checkout session
4. If not found, pass `customer_email: userEmail` instead of `customer_creation: "always"`
5. Remove the unconditional `customer_creation: "always"` line

This ensures:
- Returning customers see their saved cards pre-filled in Stripe Checkout
- New customers still get prompted to enter their details
- The behavior matches the `buy-credits` function exactly

