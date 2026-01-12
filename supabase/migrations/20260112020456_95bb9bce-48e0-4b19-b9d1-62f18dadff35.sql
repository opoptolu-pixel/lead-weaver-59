-- Create page_views table for historical visitor tracking
CREATE TABLE public.page_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  page_path TEXT NOT NULL,
  page_title TEXT,
  device_type TEXT,
  referrer TEXT,
  city TEXT,
  region TEXT,
  country TEXT,
  user_agent TEXT,
  time_on_page INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_page_views_created_at ON public.page_views(created_at DESC);
CREATE INDEX idx_page_views_page_path ON public.page_views(page_path);
CREATE INDEX idx_page_views_visitor_id ON public.page_views(visitor_id);
CREATE INDEX idx_page_views_session_id ON public.page_views(session_id);

-- Enable RLS
ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

-- Base deny policy
CREATE POLICY "Base deny all access to page_views"
ON public.page_views
AS RESTRICTIVE
FOR ALL
USING (false)
WITH CHECK (false);

-- Allow anyone to insert page views (for anonymous tracking)
CREATE POLICY "Anyone can insert page views"
ON public.page_views
FOR INSERT
WITH CHECK (true);

-- Admins can view all page views
CREATE POLICY "Admins can view all page views"
ON public.page_views
FOR SELECT
USING (is_admin(auth.uid()));