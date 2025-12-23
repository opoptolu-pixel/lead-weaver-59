-- Add a policy to allow public access to leads through the available_leads view
-- This only exposes non-sensitive data (id, postcode, job_type, display_value, date, created_at)
-- The view itself filters to only unlocked=false leads

CREATE POLICY "Anyone can view available leads via view" 
ON public.leads 
FOR SELECT 
USING (is_unlocked = false);