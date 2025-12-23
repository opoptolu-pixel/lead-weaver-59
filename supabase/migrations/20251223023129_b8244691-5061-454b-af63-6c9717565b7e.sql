-- Allow users to view their own role (needed for admin check)
CREATE POLICY "Users can view own role"
ON public.user_roles
FOR SELECT
USING (user_id = auth.uid());