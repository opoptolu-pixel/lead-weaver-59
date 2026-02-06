
-- Drop the overly restrictive policy
DROP POLICY IF EXISTS "Base deny all access to page_views" ON public.page_views;
DROP POLICY IF EXISTS "Admins can read page_views" ON public.page_views;
DROP POLICY IF EXISTS "Anyone can insert page_views" ON public.page_views;
DROP POLICY IF EXISTS "Anyone can update page_views" ON public.page_views;

-- Allow anyone (including anonymous visitors) to insert page views
CREATE POLICY "Anyone can insert page_views"
ON public.page_views
FOR INSERT
WITH CHECK (true);

-- Allow anyone to update their own page view (for time_on_page updates)
CREATE POLICY "Anyone can update own page_views"
ON public.page_views
FOR UPDATE
USING (true)
WITH CHECK (true);

-- Only admins can read page views
CREATE POLICY "Admins can read page_views"
ON public.page_views
FOR SELECT
USING (public.is_admin(auth.uid()));
