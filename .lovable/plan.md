

## Add Meta Pixel InitiateCheckout Event on All Purchase Flows

### Why fire every time (not just once)
InitiateCheckout is a behavioral intent signal, not an identity event like CompleteRegistration. Meta uses each firing to optimize ad delivery toward high-intent users and measure checkout abandonment rates. This is how Meta expects the event to work.

### What changes (3 files)

**1. `src/pages/Leads.tsx` -- handleUnlock function (~line 764)**
Right before `window.location.href = result.data.url`, fire the event:

```typescript
if (window.fbq) {
  window.fbq('track', 'InitiateCheckout', {
    content_name: 'lead_unlock',
    content_category: 'lead',
    value: 20,
    currency: 'GBP',
  });
}
```

**2. `src/pages/Dashboard.tsx` -- handleBuyCredits function (~line 168)**
Right before `window.location.href = data.url`, fire the event:

```typescript
if (window.fbq) {
  window.fbq('track', 'InitiateCheckout', {
    content_name: `credit_pack_${packSize}`,
    content_category: 'credits',
    value: packSize === '5' ? 90 : 170,
    currency: 'GBP',
  });
}
```

**3. `src/components/Pricing.tsx` -- handlePurchase function (~line 89)**
Right before `window.location.href = data.url`, fire the event:

```typescript
if (window.fbq) {
  window.fbq('track', 'InitiateCheckout', {
    content_name: tier.name,
    content_category: 'credits',
    value: parseFloat(tier.price.replace('£', '')),
    currency: 'GBP',
  });
}
```

### Technical details
- Event: `InitiateCheckout` (standard Meta event)
- Fires only when the Stripe checkout URL is successfully returned (not on validation errors or early returns)
- Each flow passes relevant `content_name`, `content_category`, `value`, and `currency` for accurate attribution
- No database changes needed
- No new files needed

