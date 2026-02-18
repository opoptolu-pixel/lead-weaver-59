
# Gate Dashboard & Leads Until Profile is Complete

## The Problem

Currently, after signing up, users can click "Skip for now" on the onboarding flow and land on `/dashboard` or `/leads` with an empty profile. The goal is to force them to complete their profile before they can access these pages.

The four required fields are:
- `contact_name`
- `business_name`
- `phone`
- `postcode`

## What Needs to Change

### 1. Remove the "Skip for now" link — `src/pages/Onboarding.tsx`

The skip link at the bottom of each onboarding step lets users bypass the flow entirely. This will be removed so the onboarding page is the only way forward.

### 2. Gate the Dashboard — `src/pages/Dashboard.tsx`

Add a redirect at the top of the Dashboard component. After auth loads and the profile is available:
- If any of the four required fields are missing → redirect to `/onboarding`
- This runs after `authLoading` resolves, so it won't flash for returning users who already completed their profile

The logic is already partially there — the Onboarding page redirects *away* from itself when the profile is complete. We simply add the mirror check on Dashboard.

### 3. Gate the Leads Page — `src/pages/Leads.tsx`

Same redirect logic added to the Leads page. Incomplete profiles → `/onboarding`.

### 4. Gate other authenticated pages (Performance, Billing, Disputes, Settings)

These pages should also redirect incomplete users. However, **Settings** is where they might go to complete their profile in future. For now we will only gate `/dashboard` and `/leads` since those are the primary value pages, and `/onboarding` already handles the completion flow.

## Detailed Changes

### `src/pages/Onboarding.tsx` — Remove skip link

Lines 447–456: Delete the "Skip for now, I'll complete later" button block.

### `src/pages/Dashboard.tsx` — Add profile completeness gate

In the existing `useEffect` that handles auth redirect (around line 107), extend it to also check profile completeness:

```typescript
useEffect(() => {
  if (!authLoading && !user) {
    navigate("/auth");
  } else if (!authLoading && user && profile) {
    // Gate: redirect to onboarding if profile is incomplete
    const isProfileComplete = 
      profile.contact_name && 
      profile.business_name && 
      profile.phone && 
      profile.postcode;
    if (!isProfileComplete) {
      navigate("/onboarding");
    }
  }
}, [user, authLoading, profile, navigate]);
```

The `profile` is already available via `useAuth()` — no extra data fetching needed.

### `src/pages/Leads.tsx` — Add same gate

The Leads page already uses `useAuth()`. The same redirect logic will be added to its auth effect.

## User Experience

```text
Sign Up
   │
   ▼
/onboarding  ◄──── no "Skip" button
   │
   │  Complete all 4 fields
   ▼
/dashboard  (full access)
   │
   │  If user tries to go to /leads or /dashboard directly
   │  without completing profile → redirect back to /onboarding
   ▼
/onboarding  (forced back)
```

## What This Does NOT Change

- Existing businesses who already completed their profile are unaffected — the check passes and they land on the dashboard normally
- Admin routes are completely separate and unaffected
- The actual profile data saving logic in `Onboarding.tsx` is unchanged
- No database changes required — the `profiles` table already has all four fields

## Files to Edit

1. `src/pages/Onboarding.tsx` — Remove the "Skip for now" link (3 lines removed)
2. `src/pages/Dashboard.tsx` — Extend the auth `useEffect` to check profile completeness
3. `src/pages/Leads.tsx` — Add the same profile completeness check
