-- =====================================================
-- SECURITY FIX: Tighten lead_reservations policies
-- =====================================================

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Users can update own reservations" ON public.lead_reservations;
DROP POLICY IF EXISTS "Authenticated users can create reservations" ON public.lead_reservations;
DROP POLICY IF EXISTS "Service role can create reservations" ON public.lead_reservations;
DROP POLICY IF EXISTS "Service role can update reservations" ON public.lead_reservations;

-- Create proper base deny policy (if not exists already - safe to recreate)
DROP POLICY IF EXISTS "Base deny all access to lead_reservations" ON public.lead_reservations;
CREATE POLICY "Base deny all access to lead_reservations"
ON public.lead_reservations
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Keep admin view policy (already exists but ensure it's correct)
-- Admins can view all reservations - already exists

-- =====================================================
-- SECURITY FIX: Add base deny policies for ad tables
-- =====================================================

-- Add base deny for ad_spend
DROP POLICY IF EXISTS "Base deny all access to ad_spend" ON public.ad_spend;
CREATE POLICY "Base deny all access to ad_spend"
ON public.ad_spend
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);

-- Add base deny for ad_platform_settings
DROP POLICY IF EXISTS "Base deny all access to ad_platform_settings" ON public.ad_platform_settings;
CREATE POLICY "Base deny all access to ad_platform_settings"
ON public.ad_platform_settings
AS RESTRICTIVE
FOR ALL
TO public
USING (false)
WITH CHECK (false);