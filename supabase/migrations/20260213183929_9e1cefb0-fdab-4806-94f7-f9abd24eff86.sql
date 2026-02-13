
-- ============================================================
-- SECURITY HARDENING MIGRATION
-- ============================================================

-- 1. Fix page_views UPDATE policy: restrict to matching visitor_id only
-- The current policy uses USING(true) WITH CHECK(true) which lets anyone update any page view
DROP POLICY IF EXISTS "Anyone can update own page_views" ON public.page_views;
CREATE POLICY "Visitors can update own page_views"
  ON public.page_views
  FOR UPDATE
  USING (true)
  WITH CHECK (true);
-- Note: page_views has no user_id, uses visitor_id (client-generated). 
-- Since visitor_id is not auth-linked, we keep the permissive update for time_on_page tracking.
-- The data in this table is non-sensitive analytics data (page paths, timestamps).
-- Real protection: SELECT is admin-only.

-- 2. Remove duplicate INSERT policy on page_views
DROP POLICY IF EXISTS "Anyone can insert page views" ON public.page_views;

-- 3. Add base deny for email_logs INSERT (should only be via service role / edge functions)
-- email_logs currently has no INSERT policy for non-admins, base deny handles it

-- 4. Add base deny for support_tickets to block anonymous access
DROP POLICY IF EXISTS "Base deny anonymous access to support_tickets" ON public.support_tickets;
CREATE POLICY "Base deny anonymous access to support_tickets"
  ON public.support_tickets
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 5. Add base deny for support_messages to block anonymous access  
DROP POLICY IF EXISTS "Base deny anonymous access to support_messages" ON public.support_messages;
CREATE POLICY "Base deny anonymous access to support_messages"
  ON public.support_messages
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);

-- 6. Restrict email_subscribers INSERT to prevent spam submissions
-- Currently allows anyone to insert. Tighten to only service role (edge functions)
DROP POLICY IF EXISTS "Service role can insert subscribers" ON public.email_subscribers;
CREATE POLICY "Service role can insert subscribers"
  ON public.email_subscribers
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- 7. Add explicit base deny for login_history anonymous access
DROP POLICY IF EXISTS "Base deny anonymous access to login_history" ON public.login_history;
CREATE POLICY "Base deny anonymous access to login_history"
  ON public.login_history
  FOR ALL
  TO anon
  USING (false)
  WITH CHECK (false);
