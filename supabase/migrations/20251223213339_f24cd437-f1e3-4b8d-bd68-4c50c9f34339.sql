-- Fix RLS security issues for profiles and leads tables

-- Drop the overly permissive "Service role" policies that use USING (true)
-- Service role already bypasses RLS, so these policies are unnecessary and dangerous
DROP POLICY IF EXISTS "Service role can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Service role can update leads" ON public.leads;

-- Recreate leads INSERT policy for edge functions (using service role bypasses RLS anyway)
-- Only allow authenticated admins to insert via the API
CREATE POLICY "Only admins can insert leads via API"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

-- Create a policy for users to update their own unlocked leads (for outcome tracking)
CREATE POLICY "Users can update their unlocked leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (
  unlocked_by = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_verified = true 
    AND (profiles.is_suspended IS NULL OR profiles.is_suspended = false)
  )
)
WITH CHECK (
  unlocked_by = auth.uid()
);

-- Ensure profiles table only allows authenticated access
-- Drop and recreate policies to ensure they're properly scoped to authenticated users
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Recreate profile policies with explicit authenticated role
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Recreate leads SELECT policies with explicit authenticated role
DROP POLICY IF EXISTS "Users can view their unlocked leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can update all leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can insert leads" ON public.leads;

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

CREATE POLICY "Admins can view all leads"
ON public.leads
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update all leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));