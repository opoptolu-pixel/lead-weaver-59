-- Drop existing restrictive policies on email_templates
DROP POLICY IF EXISTS "Admins can view email templates" ON public.email_templates;
DROP POLICY IF EXISTS "Admins can manage email templates" ON public.email_templates;

-- Recreate as PERMISSIVE policies (default behavior)
CREATE POLICY "Admins can view email templates"
ON public.email_templates
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can insert email templates"
ON public.email_templates
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update email templates"
ON public.email_templates
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete email templates"
ON public.email_templates
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));