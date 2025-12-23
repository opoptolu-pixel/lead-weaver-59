-- =====================================================
-- FIX: Disputes Table RLS Policies
-- Ensure ALL policies explicitly require authentication
-- =====================================================

-- Drop ALL existing policies on disputes
DROP POLICY IF EXISTS "Users can view own disputes" ON public.disputes;
DROP POLICY IF EXISTS "Users can create disputes" ON public.disputes;
DROP POLICY IF EXISTS "Admins can view all disputes" ON public.disputes;
DROP POLICY IF EXISTS "Admins can update disputes" ON public.disputes;

-- Recreate SELECT policies with explicit TO authenticated
CREATE POLICY "Users can view own disputes"
ON public.disputes
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all disputes"
ON public.disputes
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Recreate INSERT policy with explicit TO authenticated
CREATE POLICY "Users can create disputes"
ON public.disputes
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Recreate UPDATE policy with explicit TO authenticated
CREATE POLICY "Admins can update disputes"
ON public.disputes
FOR UPDATE
TO authenticated
USING (is_admin(auth.uid()));