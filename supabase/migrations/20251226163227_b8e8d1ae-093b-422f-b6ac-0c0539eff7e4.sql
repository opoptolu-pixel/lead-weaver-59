-- Fix security issues: Add explicit deny policies for anonymous access

-- 1. Deny anonymous access to profiles table
CREATE POLICY "Deny anonymous access to profiles"
ON public.profiles
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 2. Deny anonymous access to leads table  
CREATE POLICY "Deny anonymous access to leads"
ON public.leads
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 3. Deny anonymous access to activity_logs table
CREATE POLICY "Deny anonymous access to activity_logs"
ON public.activity_logs
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 4. Deny anonymous access to disputes table
CREATE POLICY "Deny anonymous access to disputes"
ON public.disputes
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 5. Deny anonymous access to phone_verification_codes table
CREATE POLICY "Deny anonymous access to phone_verification_codes"
ON public.phone_verification_codes
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 6. Deny anonymous access to mfa_recovery_codes table
CREATE POLICY "Deny anonymous access to mfa_recovery_codes"
ON public.mfa_recovery_codes
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 7. Deny anonymous access to verification_documents table
CREATE POLICY "Deny anonymous access to verification_documents"
ON public.verification_documents
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- 8. Deny anonymous access to rate_limits table
CREATE POLICY "Deny anonymous access to rate_limits"
ON public.rate_limits
FOR ALL
TO anon
USING (false)
WITH CHECK (false);