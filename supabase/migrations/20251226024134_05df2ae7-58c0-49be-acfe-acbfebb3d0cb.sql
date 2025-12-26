-- Fix security: Add base PERMISSIVE policies that deny public access
-- RESTRICTIVE policies only work when there's a PERMISSIVE policy to restrict

-- profiles table
CREATE POLICY "Base deny all access to profiles"
ON public.profiles
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- leads table
CREATE POLICY "Base deny all access to leads"
ON public.leads
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- business_inquiries table
CREATE POLICY "Base deny all access to business_inquiries"
ON public.business_inquiries
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- contact_submissions table
CREATE POLICY "Base deny all access to contact_submissions"
ON public.contact_submissions
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- phone_verification_codes table
CREATE POLICY "Base deny all access to phone_verification_codes"
ON public.phone_verification_codes
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- mfa_recovery_codes table
CREATE POLICY "Base deny all access to mfa_recovery_codes"
ON public.mfa_recovery_codes
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- disputes table
CREATE POLICY "Base deny all access to disputes"
ON public.disputes
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- verification_documents table
CREATE POLICY "Base deny all access to verification_documents"
ON public.verification_documents
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- user_roles table
CREATE POLICY "Base deny all access to user_roles"
ON public.user_roles
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- activity_logs table
CREATE POLICY "Base deny all access to activity_logs"
ON public.activity_logs
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- email_logs table
CREATE POLICY "Base deny all access to email_logs"
ON public.email_logs
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- email_subscribers table
CREATE POLICY "Base deny all access to email_subscribers"
ON public.email_subscribers
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- scheduled_emails table
CREATE POLICY "Base deny all access to scheduled_emails"
ON public.scheduled_emails
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- admin_settings table
CREATE POLICY "Base deny all access to admin_settings"
ON public.admin_settings
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- email_templates table
CREATE POLICY "Base deny all access to email_templates"
ON public.email_templates
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- fraud_flags table
CREATE POLICY "Base deny all access to fraud_flags"
ON public.fraud_flags
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- rate_limits table - needs policies for the database functions to work
CREATE POLICY "Base deny all access to rate_limits"
ON public.rate_limits
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Allow authenticated users to manage their own rate limits (used by check_rate_limit function)
CREATE POLICY "Users can view own rate limits"
ON public.rate_limits
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own rate limits"
ON public.rate_limits
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own rate limits"
ON public.rate_limits
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can delete own rate limits"
ON public.rate_limits
FOR DELETE
TO authenticated
USING (user_id = auth.uid());