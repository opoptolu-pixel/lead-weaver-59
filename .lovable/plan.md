

## Plan: Show "Complete Profile" Instead of "Unlock" When Onboarding Is Incomplete

### Problem
When a user's profile is missing required fields (name, business name, phone, postcode), the Leads page still shows the "Unlock for £20" / "Use 1 Credit" buttons. The validation only fires on click, which is confusing -- users expect visual feedback that they can't purchase.

### Solution
Add an `isProfileIncomplete` state to the Leads page and pass it to `LeadsScrollContainer`, which will show a disabled "Complete Profile" button (similar to how suspended/reverification states are handled).

### Technical Changes

**File: `src/pages/Leads.tsx`**

1. **Compute `isProfileIncomplete`** from the existing `profile` object (around line 964 where `userCredits` is computed):
   ```typescript
   const isProfileIncomplete = profile ? (
     !profile.business_name || !profile.contact_name || 
     !profile.phone || !profile.postcode
   ) : false;
   ```

2. **Add `isProfileIncomplete` prop** to `LeadsScrollContainerProps` interface (line 49-65)

3. **Pass prop** to `LeadsScrollContainer` in the JSX (around line 1240)

4. **Add visual state in `LeadsScrollContainer`** -- insert a new condition block after `isReverificationRequired` check (around lines 179-191 and 285-295 for desktop and mobile respectively):
   - Show a disabled button styled in amber/orange reading "Complete Profile"
   - With an `AlertCircle` icon
   - Clicking navigates to `/settings`

5. **Add `refreshProfile` call on page mount** to ensure the profile data is fresh when the user visits the Leads page, picking up any admin-side changes

### Button Appearance
- Amber/orange outlined disabled-style button reading "Complete Profile"
- Consistent with the existing "Suspended" and "Re-verification Required" button patterns
- Links to `/settings` so the user can fill in missing fields

### Why This Works
- The backend (`unlock-lead` and `use-credit` edge functions) already enforce these checks server-side
- This change adds the missing visual/UI feedback layer
- Profile is refreshed on page load to catch admin-side changes

