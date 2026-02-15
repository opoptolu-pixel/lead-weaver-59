

## Fix: "Failed to open payment management" on Billing Page

### Root Cause

Both the `customer-portal` and `get-payment-methods` edge functions are crashing on startup with `ReferenceError: serve is not defined`. They call `serve()` but never import it.

### Fix

Add the missing import to both files:

**1. `supabase/functions/customer-portal/index.ts`**
- Add `import { serve } from "https://deno.land/std@0.190.0/http/server.ts";` at the top

**2. `supabase/functions/get-payment-methods/index.ts`**
- Add `import { serve } from "https://deno.land/std@0.190.0/http/server.ts";` at the top

No other changes are needed. Once deployed, both the "Manage Payment Methods" button and the saved cards section will work correctly.

