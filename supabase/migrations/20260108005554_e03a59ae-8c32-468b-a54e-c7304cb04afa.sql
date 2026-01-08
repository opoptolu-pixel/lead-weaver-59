-- Drop the existing restrictive SELECT policy that may be misconfigured
DROP POLICY IF EXISTS "Admins can view all business inquiries" ON public.business_inquiries;

-- Create a PERMISSIVE policy for admin SELECT access
-- PERMISSIVE policies require at least one to pass (OR logic)
-- Only authenticated admins can read business inquiries
CREATE POLICY "Admins can view all business inquiries" 
ON public.business_inquiries 
FOR SELECT 
TO authenticated
USING (is_admin(auth.uid()));