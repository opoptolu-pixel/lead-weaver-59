-- Fix RLS policies to explicitly block anonymous access on sensitive tables

-- Drop and recreate restrictive policies for profiles
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() IS NOT NULL AND user_id = auth.uid())
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Fix leads policies
DROP POLICY IF EXISTS "Users can view their unlocked leads" ON public.leads;
CREATE POLICY "Users can view their unlocked leads" ON public.leads
FOR SELECT USING (
  auth.uid() IS NOT NULL 
  AND unlocked_by = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_verified = true 
    AND (profiles.is_suspended IS NULL OR profiles.is_suspended = false)
  )
);

DROP POLICY IF EXISTS "Users can update their unlocked leads" ON public.leads;
CREATE POLICY "Users can update their unlocked leads" ON public.leads
FOR UPDATE USING (
  auth.uid() IS NOT NULL 
  AND unlocked_by = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.user_id = auth.uid() 
    AND profiles.is_verified = true 
    AND (profiles.is_suspended IS NULL OR profiles.is_suspended = false)
  )
) WITH CHECK (auth.uid() IS NOT NULL AND unlocked_by = auth.uid());

-- Fix disputes policies
DROP POLICY IF EXISTS "Users can view own disputes" ON public.disputes;
CREATE POLICY "Users can view own disputes" ON public.disputes
FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create disputes" ON public.disputes;
CREATE POLICY "Users can create disputes" ON public.disputes
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Fix activity_logs policies
DROP POLICY IF EXISTS "Anyone can insert activity logs" ON public.activity_logs;
CREATE POLICY "Authenticated users can insert activity logs" ON public.activity_logs
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Fix phone_verification_codes policies
DROP POLICY IF EXISTS "Users can view own phone codes" ON public.phone_verification_codes;
CREATE POLICY "Users can view own phone codes" ON public.phone_verification_codes
FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own phone codes" ON public.phone_verification_codes;
CREATE POLICY "Users can insert own phone codes" ON public.phone_verification_codes
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own phone codes" ON public.phone_verification_codes;
CREATE POLICY "Users can update own phone codes" ON public.phone_verification_codes
FOR UPDATE USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Fix verification_documents policies
DROP POLICY IF EXISTS "Users can view own verification documents" ON public.verification_documents;
CREATE POLICY "Users can view own verification documents" ON public.verification_documents
FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own verification documents" ON public.verification_documents;
CREATE POLICY "Users can insert own verification documents" ON public.verification_documents
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Fix mfa_recovery_codes policies
DROP POLICY IF EXISTS "Users can view their own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "Users can view their own recovery codes" ON public.mfa_recovery_codes
FOR SELECT USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "Users can create their own recovery codes" ON public.mfa_recovery_codes
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "Users can update their own recovery codes" ON public.mfa_recovery_codes
FOR UPDATE USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own recovery codes" ON public.mfa_recovery_codes;
CREATE POLICY "Users can delete their own recovery codes" ON public.mfa_recovery_codes
FOR DELETE USING (auth.uid() IS NOT NULL AND auth.uid() = user_id);

-- Fix user_roles policies
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles
FOR SELECT USING (auth.uid() IS NOT NULL AND user_id = auth.uid());