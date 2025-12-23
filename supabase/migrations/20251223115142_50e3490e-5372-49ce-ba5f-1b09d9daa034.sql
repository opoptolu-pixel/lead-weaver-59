-- Add explicit RESTRICTIVE policy to block anonymous access to profiles
-- This ensures unauthenticated users cannot read any profile data
CREATE POLICY "Block anonymous access to profiles"
ON public.profiles
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);

-- Add explicit RESTRICTIVE policy to block anonymous access to leads
-- This ensures unauthenticated users cannot read any lead data
CREATE POLICY "Block anonymous access to leads"
ON public.leads
AS RESTRICTIVE
FOR SELECT
TO anon
USING (false);