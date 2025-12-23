-- Drop the ineffective "Block anonymous access to profiles" policy
-- This policy with USING (false) doesn't properly block anonymous access
-- The other policies already have auth.uid() IS NOT NULL checks which properly restrict access
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;

-- Also drop and recreate the user SELECT policy to ensure it's properly restrictive
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Recreate admin view policy to also be explicit about authenticated role
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));