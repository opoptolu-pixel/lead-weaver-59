-- Create login_history table for tracking login events
CREATE TABLE public.login_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  login_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  country TEXT,
  city TEXT
);

-- Enable RLS
ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

-- Base deny all
CREATE POLICY "Base deny all access to login_history"
ON public.login_history
FOR ALL
USING (false)
WITH CHECK (false);

-- Users can view their own login history
CREATE POLICY "Users can view own login history"
ON public.login_history
FOR SELECT
USING (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Users can insert their own login history
CREATE POLICY "Users can insert own login history"
ON public.login_history
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Admins can view all login history
CREATE POLICY "Admins can view all login history"
ON public.login_history
FOR SELECT
USING (is_admin(auth.uid()));

-- Create index for efficient queries
CREATE INDEX idx_login_history_user_id ON public.login_history(user_id);
CREATE INDEX idx_login_history_login_at ON public.login_history(login_at DESC);