-- Drop the ineffective "Block anonymous access to leads" policy
DROP POLICY IF EXISTS "Block anonymous access to leads" ON public.leads;

-- Recreate the user SELECT policy to be explicit about authenticated role
DROP POLICY IF EXISTS "Users can view their unlocked leads" ON public.leads;

CREATE POLICY "Users can view their unlocked leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  unlocked_by = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_verified = true 
    AND (profiles.is_suspended IS NULL OR profiles.is_suspended = false)
  )
);

-- Recreate admin view policy to also be explicit about authenticated role
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;

CREATE POLICY "Admins can view all leads"
ON public.leads
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));