-- Add a policy for rate_limits table (service role bypasses RLS anyway)
-- This satisfies the linter while keeping the table secure
CREATE POLICY "Service role only access"
ON public.rate_limits
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);