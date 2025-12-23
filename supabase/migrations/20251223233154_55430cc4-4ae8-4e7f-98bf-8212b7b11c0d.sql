-- Create scheduled_emails table for email scheduling
CREATE TABLE public.scheduled_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  template_name TEXT,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  html_body TEXT NOT NULL,
  scheduled_for TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  is_test BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scheduled_emails ENABLE ROW LEVEL SECURITY;

-- Admins can view all scheduled emails
CREATE POLICY "Admins can view scheduled emails"
ON public.scheduled_emails
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid()));

-- Admins can insert scheduled emails
CREATE POLICY "Admins can insert scheduled emails"
ON public.scheduled_emails
FOR INSERT
TO authenticated
WITH CHECK (public.is_admin(auth.uid()));

-- Admins can update scheduled emails
CREATE POLICY "Admins can update scheduled emails"
ON public.scheduled_emails
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Admins can delete scheduled emails
CREATE POLICY "Admins can delete scheduled emails"
ON public.scheduled_emails
FOR DELETE
TO authenticated
USING (public.is_admin(auth.uid()));

-- Service role can manage (for edge functions)
CREATE POLICY "Service can manage scheduled emails"
ON public.scheduled_emails
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create indexes
CREATE INDEX idx_scheduled_emails_status ON public.scheduled_emails(status);
CREATE INDEX idx_scheduled_emails_scheduled_for ON public.scheduled_emails(scheduled_for);

-- Create trigger for updated_at
CREATE TRIGGER update_scheduled_emails_updated_at
BEFORE UPDATE ON public.scheduled_emails
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron and pg_net extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;