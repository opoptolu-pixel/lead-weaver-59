## Meta Pixel Installation

### Strategy

Follow the exact same pattern as the existing Clarity Analytics component — a route-aware React component that only fires on public-facing pages and skips admin/dashboard routes.

### Pages WHERE the pixel WILL fire

- `/` (Homepage)
- `/for-cleaners` (Cleaner landing page)
- `/request-cleaning` and `/request-cleaning/thank-you` (Customer funnel — critical for conversion tracking)
- `/auth` (Sign in/Sign up — useful for tracking funnel drop-off)
- `/leads` (Public lead browse page — useful for acquisition tracking)

### Pages WHERE the pixel will NOT fire

- `/dashboard`, `/settings`, `/billing`, `/performance`, `/disputes`, `/support`, `/verification`, `/onboarding` (Authenticated business pages)
- `/admin/*`, `/admin-login` (All admin pages)
- `/payment-success`, `/credits-success` (Post-payment pages — avoids double-counting conversions)

### Implementation

**1. Create `src/components/MetaPixel.tsx**`

A new component mirroring the `ClarityAnalytics` pattern:

- Uses `useLocation()` to check the current route
- Maintains the same `EXCLUDED_ROUTES` list used by Clarity (plus `/admin-login`)
- On public routes: loads the Meta Pixel script once, then calls `fbq('track', 'PageView')` on every route change
- On excluded routes: does nothing (no tracking, no script load)
- Includes a `<noscript>` fallback image for non-JS environments
- Adds TypeScript declarations for `window.fbq`

**2. Update `src/App.tsx**`

- Import the new `MetaPixel` component
- Place it alongside `ClarityAnalytics` (right after the `<BrowserRouter>` tag)

### Technical Details

- Pixel ID: `1204767561831151`
- The script loads only once (checks `window.fbq` before injecting)
- Subsequent route changes call `fbq('track', 'PageView')` without reloading the script
- No performance impact on excluded routes — the script is never loaded there
- The noscript fallback img tag is rendered in the component JSX for SPA compatibility