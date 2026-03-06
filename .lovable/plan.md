

## Investigation Findings

I investigated the database, Stripe payments, and accounting code. Here is what I found:

### Issue 1: Three £20 credit purchases (£60 total) are not reflected in accounting

There are 3 recent successful Stripe payments of £20 each from customer `cus_U4jkmVuUPS2Qd7`, but:
- **Zero** `credits_purchased` activity logs exist in the database
- **Zero** `verify-credits` edge function logs exist (the function was never called)
- The `stripe-webhook` function has **no logs at all** -- meaning it has never received any events from Stripe

This means the customer paid £60 via Stripe but the credits were never added to their account. The `verify-credits` function (called client-side from `/credits-success`) apparently failed silently, and the webhook backup never fired because `checkout.session.completed` is not configured on the Stripe webhook endpoint.

### Issue 2: The £20 refund is not showing in accounting

The lead `a3cd7898` was refunded (activity log confirms `auto_refund_duplicate` with `refund_success: true` and `refund_id: pyr_1T1cBnHaP2wEKuykl59342kH`), but the lead's `refunded_at` column is still `NULL`. The accounting page determines refund status by checking `refunded_at`, so this refund is invisible.

### Plan

**1. Fix the missing refund on lead `a3cd7898`**
- Run a data update to set `refunded_at` and `outcome_status = 'refunded'` on the lead that was already refunded in Stripe but not updated in the database.

**2. Add credit purchase handling to the `checkout.session.completed` webhook**
- The current webhook handler only unlocks leads (checks for `lead_id` in metadata). It does not handle credit purchases (which have `credits` in metadata instead of `lead_id`).
- Add logic: if `session.metadata.credits` exists and `session.metadata.user_id` exists, add the credits to the user's profile and log a `credits_purchased` activity -- the same thing `verify-credits` does, but as a server-side fallback.

**3. Add credit purchase tracking to the accounting page**
- The accounting page currently only tracks lead transactions. It does not query or display credit purchase revenue separately.
- Add a query for `credits_purchased` activity logs and include credit pack purchases as revenue line items, so the £40 (or £60) in credit purchases shows up in the financial overview.

**4. Configure Stripe webhook**
- You still need to add `checkout.session.completed` to your Stripe webhook endpoint at `dashboard.stripe.com`. Without this, the server-side fallback will never fire.

### Immediate data fix needed
- Update lead `a3cd7898` to set `refunded_at` and `outcome_status`
- Manually verify and add the 3 credit purchases to the correct user's profile if they haven't been applied

