-- Create a rate limiting table for tracking API calls
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  request_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, action, window_start)
);

-- Enable RLS
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Only allow service role to manage rate limits (edge functions use service role)
-- No client access needed
REVOKE ALL ON public.rate_limits FROM anon;
REVOKE ALL ON public.rate_limits FROM authenticated;

-- Create function to check and increment rate limit
-- Returns true if within limit, false if exceeded
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_user_id UUID,
  p_action TEXT,
  p_max_requests INTEGER DEFAULT 10,
  p_window_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (
  allowed BOOLEAN,
  current_count INTEGER,
  reset_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMP WITH TIME ZONE;
  v_current_count INTEGER;
  v_reset_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Calculate current window start (rounded to window_seconds)
  v_window_start := date_trunc('second', now()) - 
    (EXTRACT(EPOCH FROM date_trunc('second', now()))::INTEGER % p_window_seconds) * INTERVAL '1 second';
  v_reset_at := v_window_start + (p_window_seconds * INTERVAL '1 second');
  
  -- Clean up old rate limit entries (older than 1 hour)
  DELETE FROM rate_limits 
  WHERE window_start < now() - INTERVAL '1 hour';
  
  -- Try to insert or update the rate limit counter
  INSERT INTO rate_limits (user_id, action, window_start, request_count)
  VALUES (p_user_id, p_action, v_window_start, 1)
  ON CONFLICT (user_id, action, window_start)
  DO UPDATE SET request_count = rate_limits.request_count + 1
  RETURNING request_count INTO v_current_count;
  
  -- Check if within limit
  IF v_current_count <= p_max_requests THEN
    RETURN QUERY SELECT TRUE, v_current_count, v_reset_at;
  ELSE
    RETURN QUERY SELECT FALSE, v_current_count, v_reset_at;
  END IF;
END;
$$;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_user_action 
ON public.rate_limits(user_id, action, window_start);