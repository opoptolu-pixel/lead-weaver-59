
-- Fix page_views RLS: All policies are RESTRICTIVE which blocks everything.
-- Need PERMISSIVE policies for insert/update (anonymous tracking) and select (admin reading).

-- Drop the broken restrictive policies
DROP POLICY IF EXISTS "Anyone can insert page_views" ON page_views;
DROP POLICY IF EXISTS "Visitors can update own page_views" ON page_views;
DROP POLICY IF EXISTS "Admins can read page_views" ON page_views;
DROP POLICY IF EXISTS "Admins can view all page views" ON page_views;

-- Create PERMISSIVE policies (the default, which actually grants access)
CREATE POLICY "Anyone can insert page_views"
  ON page_views FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update page_views"
  ON page_views FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can view page_views"
  ON page_views FOR SELECT
  USING (is_admin(auth.uid()));
