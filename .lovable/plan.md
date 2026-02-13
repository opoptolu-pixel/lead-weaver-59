

## Google Ads / GA4 Event Audit and Fix

### Current Status

Google Analytics 4 (GA4) **is installed** in `index.html` with measurement ID `G-DECLEHV54G`. The core gtag script loads correctly and a utility file (`src/lib/analytics.ts`) provides helper functions for firing events.

### Event Comparison: Meta Pixel vs GA4

| Event | Meta Pixel | GA4 | Status |
|-------|-----------|-----|--------|
| PageView (public pages) | Tracked | Tracked | OK |
| Lead (cleaning request submitted) | Tracked | Tracked | OK |
| CompleteRegistration (cleaner signup) | Tracked | Tracked | OK |
| InitiateCheckout (unlock/credit click) | Tracked in 3 places | **Not tracked** | MISSING |
| Purchase - Lead Unlock | Tracked | Tracked | OK |
| Purchase - Credit Pack | Tracked | Tracked | OK |
| Enquiry (contact form) | Not tracked | Tracked | Minor gap (FB side) |

### What Needs Fixing

**1. Add `InitiateCheckout` GA4 event** -- This is the only significant missing event. Meta Pixel fires `InitiateCheckout` in three places when users click to unlock a lead or buy credits, but GA4 has no equivalent.

I will:
- Add a `trackInitiateCheckout` function to `src/lib/analytics.ts`
- Call it alongside the existing `fbq('track', 'InitiateCheckout')` calls in:
  - `src/pages/Leads.tsx` (lead unlock button)
  - `src/pages/Dashboard.tsx` (credit purchase button)
  - `src/components/Pricing.tsx` (pricing CTA buttons)

**2. Add `Enquiry` Meta Pixel event** (minor) -- GA4 tracks contact form submissions as enquiries, but Meta Pixel does not. I will add `fbq('track', 'Contact')` alongside the existing `trackEnquiry()` calls in:
  - `src/pages/Contact.tsx`
  - `src/components/RegistrationForm.tsx`

### Technical Details

New function in `analytics.ts`:
```typescript
export const trackInitiateCheckout = (params: {
  contentName: string;
  contentCategory: string;
  value?: number;
}) => {
  trackEvent('begin_checkout', {
    currency: 'GBP',
    value: params.value || 0,
    items: [{
      item_name: params.contentName,
      item_category: params.contentCategory,
    }],
  });
};
```

This uses `begin_checkout` which is Google's recommended event name for checkout initiation, making it available as a conversion in Google Ads without custom event setup.

