-- Drop existing SELECT policies on profiles that don't have explicit auth checks
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Recreate with explicit authentication requirement
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));

-- Drop existing SELECT policies on leads that don't have explicit auth checks
DROP POLICY IF EXISTS "Users can view their unlocked leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;

-- Recreate with explicit authentication requirement AND verification checks
CREATE POLICY "Users can view their unlocked leads"
ON public.leads
FOR SELECT
TO authenticated
USING (
  auth.uid() IS NOT NULL 
  AND unlocked_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_verified = true 
    AND (profiles.is_suspended IS NULL OR profiles.is_suspended = false)
  )
);

CREATE POLICY "Admins can view all leads"
ON public.leads
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL AND is_admin(auth.uid()));