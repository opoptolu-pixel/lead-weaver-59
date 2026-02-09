
-- Drop overly restrictive base policies
DROP POLICY IF EXISTS "Base deny all access to email_sequences" ON public.email_sequences;
DROP POLICY IF EXISTS "Base deny all access to email_sequence_steps" ON public.email_sequence_steps;
DROP POLICY IF EXISTS "Base deny all access to email_sequence_enrollments" ON public.email_sequence_enrollments;
DROP POLICY IF EXISTS "Base deny all access to email_sequence_logs" ON public.email_sequence_logs;

-- email_sequences: full admin access
CREATE POLICY "Admins can manage email_sequences" ON public.email_sequences FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- email_sequence_steps: full admin access
CREATE POLICY "Admins can manage email_sequence_steps" ON public.email_sequence_steps FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- email_sequence_enrollments: full admin access
CREATE POLICY "Admins can manage email_sequence_enrollments" ON public.email_sequence_enrollments FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- email_sequence_logs: full admin access
CREATE POLICY "Admins can manage email_sequence_logs" ON public.email_sequence_logs FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
