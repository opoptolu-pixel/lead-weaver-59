-- Fix lead_reservations SELECT policy to only show own reservations
DROP POLICY IF EXISTS "Authenticated users can view active reservations" ON lead_reservations;

-- Users can only view their own active reservations
CREATE POLICY "Users can view own active reservations" 
ON lead_reservations 
FOR SELECT
TO authenticated
USING (
  (status = 'active') 
  AND (expires_at > now()) 
  AND (
    visitor_id = concat('visitor_', (extract(epoch from now()) * 1000)::text, '_', substring(gen_random_uuid()::text, 1, 8))::text
    OR is_admin(auth.uid())
  )
);

-- Actually simpler approach - just let service role and admins view, plus check via RPC
DROP POLICY IF EXISTS "Users can view own active reservations" ON lead_reservations;

-- Only admins can directly view reservations (users check via RPC function)
CREATE POLICY "Only admins can view reservations directly" 
ON lead_reservations 
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));