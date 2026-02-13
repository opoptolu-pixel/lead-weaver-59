

## Add Meta Pixel Purchase Event on Payment Success Pages

### Why fire every purchase
The `Purchase` event is Meta's primary revenue signal. Each firing tells Meta "this ad click generated GBP X in revenue," enabling accurate ROAS measurement, conversion optimization, and lookalike audience building from paying customers. Firing only once would hide repeat purchases from Meta's algorithm.

### What changes (2 files)

**1. `src/pages/PaymentSuccess.tsx` -- after successful verification (~line 62)**
Right after `trackLeadUnlock(...)`, fire:

```typescript
if (window.fbq) {
  window.fbq('track', 'Purchase', {
    content_name: 'lead_unlock',
    content_category: 'lead',
    value: parseFloat(data.lead.display_value?.replace(/[^0-9.]/g, '') || '20'),
    currency: 'GBP',
  });
}
```

**2. `src/pages/CreditsSuccess.tsx` -- after successful verification (~line 46)**
Right after `trackCreditPurchase(...)`, fire:

```typescript
if (window.fbq) {
  window.fbq('track', 'Purchase', {
    content_name: `credit_pack_${data.creditsAdded}`,
    content_category: 'credits',
    value: data.amountPaid || data.creditsAdded * 1,
    currency: 'GBP',
  });
}
```

### Technical details
- Event: `Purchase` (standard Meta event)
- Fires only after Stripe payment is verified server-side (not on page load alone)
- Values are dynamic based on actual payment data returned from the backend
- Both success pages are already in the Meta Pixel excluded routes list, but `window.fbq` may still be available from the prior page session -- the `if (window.fbq)` guard handles either case safely
- No database changes needed
- No new files needed

