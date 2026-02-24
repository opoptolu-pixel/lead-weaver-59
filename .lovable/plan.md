

# Hybrid Request Form - Step 1 Variant Toggle

## Overview
Add an alternative "simplified" Step 1 to the customer request cleaning form, controlled by an admin setting. The simplified variant shows 5 service types instead of the current 14. An admin toggle in Settings lets you switch between them.

## What Changes

### 1. Database: Store the active form variant
- Add a new row in `admin_settings` with key `request_form_variant`
- Value: `{ "variant": "full" }` (default) or `{ "variant": "simplified" }`

### 2. Request Cleaning Page (`src/pages/RequestCleaning.tsx`)
- Add a second array `simplifiedCleaningTypes` with the 5 services:
  - End of Tenancy Clean
  - Move-In / Move-Out Clean
  - One-Off Deep Clean
  - Weekly Routine Clean (new type)
  - Post-Construction Deep Clean
- On mount, fetch `request_form_variant` from `admin_settings` (public read not needed -- we'll use the edge function or a simple anon-friendly approach since this is a public page)
- Render the appropriate list in Step 1 based on the fetched variant
- All other steps (2-6) remain unchanged

### 3. Customer Hero Section (`src/components/CustomerHeroSection.tsx`)
- The hero dropdown also lists cleaning types -- it will also respect the variant setting so the homepage dropdown matches Step 1

### 4. Admin Settings Page (`src/pages/admin/AdminSettings.tsx`)
- Add a "Form Configuration" card inside the "Site Config" tab
- Simple toggle/radio with two options:
  - **Full Menu** (14 services) -- current default
  - **Simplified Menu** (5 services)
- Saves to `admin_settings` table with key `request_form_variant`

## Technical Details

### New cleaning type to add
```
{ id: "weekly-routine", label: "Weekly Routine Clean", icon: Calendar, color: "bg-green-100 text-green-600", value: "from £80" }
```
Note: Weekly Routine Clean is below the current GBP100 minimum. The subtitle text on Step 1 will adapt -- the simplified variant won't say "all jobs GBP100+" since weekly routine starts lower.

### Data flow
- Admin saves variant choice to `admin_settings` (key: `request_form_variant`)
- The request cleaning page reads it on load (via a quick query) and picks which array to render
- Since `admin_settings` requires admin auth for SELECT, we'll add a permissive RLS policy for this specific key, or fetch it via a lightweight edge function. The simplest approach: add a permissive SELECT policy on `admin_settings` for rows where `key = 'request_form_variant'` so the public page can read it without auth.

### Files to modify
- `src/pages/RequestCleaning.tsx` -- add simplified types array, fetch variant, conditionally render
- `src/components/CustomerHeroSection.tsx` -- same variant logic for the homepage dropdown
- `src/pages/admin/AdminSettings.tsx` -- add toggle UI in Site Config tab
- Database migration: insert default setting row + add public read RLS for this specific key

### Edge cases
- If the setting doesn't exist yet, default to "full" (current behavior)
- The `submit-cleaning-request` edge function already accepts any `jobType` string, so new types work without backend changes
