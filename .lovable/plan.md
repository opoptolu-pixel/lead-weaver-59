

## Plan: Add "Onboarding Incomplete" Badge and Filter to Admin Businesses

### What This Does
- Adds a visible "Onboarding Incomplete" badge next to businesses that haven't completed onboarding (missing business name, phone, contact name, or postcode)
- Adds an "Incomplete" filter tab so admins can quickly find these users
- The lead purchase restrictions (requiring all four fields) are already fully enforced on both frontend and backend -- no changes needed there

### Technical Changes

**File: `src/pages/admin/AdminBusinesses.tsx`**

1. **Update `StatusFilter` type** (line 126): Add `"incomplete"` to the union type
2. **Add onboarding-incomplete detection helper**: A simple function that checks if `business_name`, `contact_name`, `phone`, or `postcode` is missing from a profile
3. **Update status filter logic** (lines 647-658): Add a case for `"incomplete"` that returns businesses missing any of those four fields
4. **Add "Incomplete" tab** to the `TabsList` (around line 796-810): Show count of businesses with incomplete onboarding
5. **Add "Onboarding Incomplete" badge** in the table row (around line 848-853): Display an amber/orange badge next to the business name when onboarding is incomplete, alongside the existing suspension warning icon
6. **Update stats section** (lines 734-740): Add an `incomplete` count to the stats object

### Badge Appearance
- Amber/orange colored badge reading "Onboarding Incomplete"
- Displayed inline next to the business name in the table
- Uses the existing `Badge` component with custom amber styling (consistent with existing badge patterns)

### Filter Tab
- New "Incomplete" tab added after "Unverified" in the filter tabs
- Shows count of businesses with incomplete profiles
- Filters to only show businesses missing any required onboarding field

