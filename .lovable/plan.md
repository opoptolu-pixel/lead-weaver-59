

## Add "This Month" Date Preset and Make Businesses Page Ignore Date Filter

### 1. Add "This Month" to the date range options

A new preset called "thismonth" will be added between "Last 30 days" and "Last Month" in the date picker. It will filter from the 1st of the current month through today.

### 2. Make the Businesses page always show all-time data

The Businesses page currently filters by the global date range. It will be updated to always fetch all businesses regardless of the selected date range, so you always see the full directory.

### Technical Details

**Files to modify:**

1. **`src/contexts/AdminContext.tsx`**
   - Add `"thismonth"` to the `DateRangePreset` type
   - Add a `case "thismonth"` in the `getDateFilter` switch that sets `start = startOfMonth(now)` and `end = endOfDay(now)`

2. **`src/components/admin/AdminTopBar.tsx`**
   - Add `<SelectItem value="thismonth">This Month</SelectItem>` in both the mobile and desktop select dropdowns, positioned after "Last 30 days" and before "Last Month"

3. **`src/pages/admin/AdminBusinesses.tsx`**
   - Remove the `dateRange` dependency from both `useEffect` hooks (the data fetch and realtime subscription)
   - Remove the date filtering (`.gte` / `.lte` on `created_at`) from `fetchBusinesses()` so it always fetches all businesses
   - Remove the unused `getDateFilter` and `dateRange` imports from `useAdmin()`

