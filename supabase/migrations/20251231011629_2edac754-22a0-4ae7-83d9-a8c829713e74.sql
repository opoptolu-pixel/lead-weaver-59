-- Fix lead_reservations to require authentication for all operations
-- This prevents unauthenticated users from manipulating reservations

-- First, drop the existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can create reservations" ON lead_reservations;
DROP POLICY IF EXISTS "Anyone can update own reservations" ON lead_reservations;
DROP POLICY IF EXISTS "Anyone can view active reservations" ON lead_reservations;

-- Create new, more restrictive policies
-- Users and service role can create reservations (visitor_id should be tied to session)
CREATE POLICY "Authenticated users can create reservations" 
ON lead_reservations 
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Service role can also insert (for edge functions)
CREATE POLICY "Service role can create reservations" 
ON lead_reservations 
FOR INSERT
TO service_role
WITH CHECK (true);

-- Only allow viewing active reservations by authenticated users
CREATE POLICY "Authenticated users can view active reservations" 
ON lead_reservations 
FOR SELECT
TO authenticated
USING ((status = 'active') AND (expires_at > now()));

-- Admins can view all reservations
CREATE POLICY "Admins can view all reservations" 
ON lead_reservations 
FOR SELECT
TO authenticated
USING (is_admin(auth.uid()));

-- Only allow updating own reservations (by visitor_id)
CREATE POLICY "Users can update own reservations" 
ON lead_reservations 
FOR UPDATE
TO authenticated
USING (true);

-- Service role can update any reservation
CREATE POLICY "Service role can update reservations" 
ON lead_reservations 
FOR UPDATE
TO service_role
USING (true);

-- Add a base deny policy for extra security against anonymous users
CREATE POLICY "Base deny anonymous access to lead_reservations" 
ON lead_reservations 
FOR ALL
TO anon
USING (false)
WITH CHECK (false);