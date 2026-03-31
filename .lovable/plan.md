

## Store Actual Amount Paid Per Lead + Price Change to £12

### Problem
Revenue calculations use a hardcoded `LEAD_PRICE = 20` constant. Changing it to 12 would retroactively misreport historical £20 sales. We need to store the actual price paid on each lead so accounting is always accurate.

### Approach

**Phase 1: Database — Add `amount_paid` column to `leads` table**

Add a new nullable integer column `amount_paid` (in pounds) to the `leads` table, defaulting to NULL. Then backfill all existing unlocked leads with `amount_paid = 20` (since every historical purchase was £20). Going forward, new purchases at £12 will store `amount_paid = 12`.

**Phase 2: Edge functions — Write `amount_paid` on purchase**

Update these 4 edge functions to set `amount_paid` when unlocking a lead:

| File | Change |
|------|--------|
| `supabase/functions/verify-payment/index.ts` | Add `amount_paid: 12` to the lead update; change log `"£20"` → `"£12"` |
| `supabase/functions/stripe-webhook/index.ts` | Add `amount_paid: 12` to the lead update; change log `"£20"` → `"£12"` |
| `supabase/functions/unlock-lead/index.ts` | Set `amount_paid: 12` on the lead update (credit-based unlock) |
| `supabase/functions/use-credit/index.ts` | Set `amount_paid: 12` on the lead update (if applicable) |

Also update `deduct_credit_atomic` DB function to set `amount_paid = 12` on the lead.

**Phase 3: Admin dashboards — Use `amount_paid` instead of constant**

| File | Change |
|------|--------|
| `AdminAccounting.tsx` | Replace `LEAD_PRICE` constant with `lead.amount_paid \|\| 20` fallback; sum actual amounts instead of `count * 20` |
| `AdminOverview.tsx` | Replace all `* 20` revenue/refund calculations with sum of `amount_paid` from query results |
| `AdminAnalytics.tsx` | Replace `* 20` spend calculations with sum of `amount_paid` |
| `AdminPayments.tsx` | Use `lead.amount_paid \|\| 20` instead of hardcoded `amount: 20` |
| `Billing.tsx` | Use `lead.amount_paid \|\| 20` instead of hardcoded `amount: 20` |
| `ConversionNotifications.tsx` | Use `amount_paid` from lead data instead of `"+£20"` |
| `LiveCheckoutsPanel.tsx` | Change `* 20` to `* 12` (checkout estimates, not historical) |

**Phase 4: Frontend pricing — Update £20 → £12 everywhere**

| File | Change |
|------|--------|
| `Pricing.tsx` | Pay As You Go: £12; 5-pack: £50 (£10/lead, save £10); 10-pack: £90 (£9/lead, save £30); new Stripe price IDs |
| `HeroSection.tsx` | "£20 Per Lead" → "£12 Per Lead" |
| `ServicesGrid.tsx` | "£20 to unlock" → "£12 to unlock" |
| `Leads.tsx` | All "£20" references → "£12" |
| `ForCleaners.tsx` | SEO/FAQ pricing text |
| `Dashboard.tsx` | Credit pack modal prices |
| `AdminLeads.tsx` | "Paid £20" → "Paid £12" |

**Phase 5: Stripe — New price objects**

Create 3 new Stripe prices:
- Pay As You Go: £12
- 5 Lead Bundle: £50
- 10 Lead Bundle: £90

Update `buy-credits/index.ts` and `unlock-lead/index.ts` with new price IDs.

**Phase 6: Fix existing build errors**

| File | Fix |
|------|-----|
| `ErrorBoundary.tsx` | `process.env.NODE_ENV` → `import.meta.env.DEV` |
| `useCheckoutActivity.ts` | `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` |
| `useLeadReservations.ts` | `NodeJS.Timeout` → `ReturnType<typeof setTimeout>` |

### Key detail
The `|| 20` fallback ensures any lead missing `amount_paid` (pre-migration edge case) still reports correctly. The backfill migration sets all existing unlocked leads to 20, so the fallback is just a safety net.

