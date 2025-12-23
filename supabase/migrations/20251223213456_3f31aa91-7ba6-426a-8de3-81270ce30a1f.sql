-- Block anonymous access to all sensitive tables
-- The issue is that restrictive policies only filter authenticated users
-- We need to ensure anon role has no access at all

-- For profiles: Revoke all permissions from anon role
REVOKE ALL ON public.profiles FROM anon;

-- For leads: Revoke all permissions from anon role
REVOKE ALL ON public.leads FROM anon;

-- For business_inquiries: Keep INSERT for public form submission, but revoke SELECT
-- First revoke all, then grant back only INSERT
REVOKE ALL ON public.business_inquiries FROM anon;
GRANT INSERT ON public.business_inquiries TO anon;

-- For phone_verification_codes: Revoke all from anon
REVOKE ALL ON public.phone_verification_codes FROM anon;

-- For disputes: Revoke all from anon
REVOKE ALL ON public.disputes FROM anon;

-- For verification_documents: Revoke all from anon
REVOKE ALL ON public.verification_documents FROM anon;

-- For fraud_flags: Revoke all from anon
REVOKE ALL ON public.fraud_flags FROM anon;

-- For activity_logs: Keep INSERT for logging, revoke SELECT
REVOKE ALL ON public.activity_logs FROM anon;
GRANT INSERT ON public.activity_logs TO anon;

-- For user_roles: Revoke all from anon
REVOKE ALL ON public.user_roles FROM anon;

-- For email_templates: Revoke all from anon
REVOKE ALL ON public.email_templates FROM anon;