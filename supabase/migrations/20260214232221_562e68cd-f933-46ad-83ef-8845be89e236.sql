
-- Fix ad_spend RLS: All RESTRICTIVE policies block everything (false AND admin = false)
-- Need PERMISSIVE policies for admin access

-- Drop broken restrictive policies
DROP POLICY IF EXISTS "Admins can manage ad spend" ON ad_spend;
DROP POLICY IF EXISTS "Admins can view ad spend" ON ad_spend;
DROP POLICY IF EXISTS "Base deny all access to ad_spend" ON ad_spend;

-- Create PERMISSIVE admin policies
CREATE POLICY "Admins can manage ad spend"
  ON ad_spend FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Also fix ad_platform_settings which has the same issue
DROP POLICY IF EXISTS "Admins can manage ad platform settings" ON ad_platform_settings;
DROP POLICY IF EXISTS "Admins can view ad platform settings" ON ad_platform_settings;
DROP POLICY IF EXISTS "Base deny all access to ad_platform_settings" ON ad_platform_settings;

CREATE POLICY "Admins can manage ad platform settings"
  ON ad_platform_settings FOR ALL
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));
