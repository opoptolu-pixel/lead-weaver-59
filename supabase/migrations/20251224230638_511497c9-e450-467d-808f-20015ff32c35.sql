-- =============================================
-- SECURITY FIX: Remove permissive USING(true) policies
-- These policies allowed public access via anon key
-- Service role key bypasses RLS, so no service policy needed
-- =============================================

-- 1. FIX email_logs table - Remove the permissive service policy
DROP POLICY IF EXISTS "Service can manage email logs" ON public.email_logs;

-- 2. FIX scheduled_emails table - Remove the permissive service policy  
DROP POLICY IF EXISTS "Service can manage scheduled emails" ON public.scheduled_emails;

-- 3. FIX rate_limits table - Remove the permissive service policy
DROP POLICY IF EXISTS "Service role only access" ON public.rate_limits;

-- =============================================
-- Verify RLS is enabled on all sensitive tables
-- =============================================

-- Ensure RLS is enabled (these are idempotent)
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verification_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;