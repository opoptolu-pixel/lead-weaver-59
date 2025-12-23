-- =====================================================
-- COMPREHENSIVE FIX: Profiles Table RLS Policies
-- Ensure ALL policies explicitly require authentication
-- =====================================================

-- Drop ALL existing SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Block anonymous access to profiles" ON public.profiles;

-- Drop ALL existing UPDATE policies on profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;

-- Drop ALL existing INSERT policies on profiles
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

-- Recreate SELECT policies with explicit TO authenticated
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

-- Recreate UPDATE policies with explicit TO authenticated
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

-- Recreate INSERT policy with explicit TO authenticated
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- =====================================================
-- COMPREHENSIVE FIX: Leads Table RLS Policies  
-- Ensure ALL policies explicitly require authentication
-- =====================================================

-- Drop ALL existing SELECT policies on leads
DROP POLICY IF EXISTS "Users can view their unlocked leads" ON public.leads;
DROP POLICY IF EXISTS "Admins can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Block anonymous access to leads" ON public.leads;

-- Drop ALL existing UPDATE policies on leads
DROP POLICY IF EXISTS "Admins can update all leads" ON public.leads;
DROP POLICY IF EXISTS "Service role can update leads" ON public.leads;

-- Drop ALL existing INSERT policies on leads
DROP POLICY IF EXISTS "Admins can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Service role can insert leads" ON public.leads;

-- Recreate SELECT policies with explicit TO authenticated
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

-- Recreate UPDATE policies with explicit TO authenticated
CREATE POLICY "Admins can update all leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));

-- Service role policies for edge functions (these need service_role, not authenticated)
CREATE POLICY "Service role can update leads"
ON public.leads
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

-- Recreate INSERT policies
CREATE POLICY "Admins can insert leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Service role can insert leads"
ON public.leads
FOR INSERT
TO service_role
WITH CHECK (true);