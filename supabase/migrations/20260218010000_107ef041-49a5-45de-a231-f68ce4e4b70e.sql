
-- Create email_suppressions table for bounced email blacklist
CREATE TABLE public.email_suppressions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  reason text NOT NULL DEFAULT 'hard_bounce', -- 'hard_bounce', 'complained', 'manual'
  bounce_type text, -- 'permanent', 'temporary', etc.
  source_resend_id text, -- the resend_id of the email that caused the bounce
  suppressed_at timestamp with time zone NOT NULL DEFAULT now(),
  notes text, -- admin notes
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_suppressions ENABLE ROW LEVEL SECURITY;

-- Base deny policy
CREATE POLICY "Base deny all access to email_suppressions"
  ON public.email_suppressions
  FOR ALL
  USING (false)
  WITH CHECK (false);

-- Admins can read all suppressions
CREATE POLICY "Admins can view email suppressions"
  ON public.email_suppressions
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Admins can insert suppressions (for manual adds)
CREATE POLICY "Admins can insert email suppressions"
  ON public.email_suppressions
  FOR INSERT
  WITH CHECK (is_admin(auth.uid()));

-- Admins can delete suppressions (to un-suppress)
CREATE POLICY "Admins can delete email suppressions"
  ON public.email_suppressions
  FOR DELETE
  USING (is_admin(auth.uid()));

-- Admins can update suppressions (to edit notes)
CREATE POLICY "Admins can update email suppressions"
  ON public.email_suppressions
  FOR UPDATE
  USING (is_admin(auth.uid()));

-- Index for fast lookups by email
CREATE INDEX idx_email_suppressions_email ON public.email_suppressions(email);
CREATE INDEX idx_email_suppressions_reason ON public.email_suppressions(reason);
CREATE INDEX idx_email_suppressions_suppressed_at ON public.email_suppressions(suppressed_at DESC);
