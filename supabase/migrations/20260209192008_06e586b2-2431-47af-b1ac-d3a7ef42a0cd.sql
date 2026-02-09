
-- Email Sequences table
CREATE TABLE public.email_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  audience_type TEXT NOT NULL DEFAULT 'customers' CHECK (audience_type IN ('customers', 'businesses', 'all')),
  trigger_type TEXT NOT NULL DEFAULT 'manual' CHECK (trigger_type IN ('manual', 'auto')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'archived')),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sequence Steps (individual emails in a sequence)
CREATE TABLE public.email_sequence_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL DEFAULT 1,
  delay_days INTEGER NOT NULL DEFAULT 0,
  delay_hours INTEGER NOT NULL DEFAULT 0,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sequence Enrollments (tracks who is enrolled and progress)
CREATE TABLE public.email_sequence_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sequence_id UUID NOT NULL REFERENCES public.email_sequences(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  recipient_type TEXT NOT NULL DEFAULT 'customer' CHECK (recipient_type IN ('customer', 'business')),
  current_step INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'unsubscribed', 'paused', 'failed')),
  next_send_at TIMESTAMP WITH TIME ZONE,
  enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Sequence Send Logs
CREATE TABLE public.email_sequence_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL REFERENCES public.email_sequence_enrollments(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.email_sequence_steps(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  resend_id TEXT,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_sequence_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_sequences
CREATE POLICY "Base deny all access to email_sequences" ON public.email_sequences AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Admins can view email sequences" ON public.email_sequences FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert email sequences" ON public.email_sequences FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update email sequences" ON public.email_sequences FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete email sequences" ON public.email_sequences FOR DELETE USING (is_admin(auth.uid()));

-- RLS Policies for email_sequence_steps
CREATE POLICY "Base deny all access to email_sequence_steps" ON public.email_sequence_steps AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Admins can view sequence steps" ON public.email_sequence_steps FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert sequence steps" ON public.email_sequence_steps FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update sequence steps" ON public.email_sequence_steps FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete sequence steps" ON public.email_sequence_steps FOR DELETE USING (is_admin(auth.uid()));

-- RLS Policies for email_sequence_enrollments
CREATE POLICY "Base deny all access to email_sequence_enrollments" ON public.email_sequence_enrollments AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Admins can view enrollments" ON public.email_sequence_enrollments FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert enrollments" ON public.email_sequence_enrollments FOR INSERT WITH CHECK (is_admin(auth.uid()));
CREATE POLICY "Admins can update enrollments" ON public.email_sequence_enrollments FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can delete enrollments" ON public.email_sequence_enrollments FOR DELETE USING (is_admin(auth.uid()));

-- RLS Policies for email_sequence_logs
CREATE POLICY "Base deny all access to email_sequence_logs" ON public.email_sequence_logs AS RESTRICTIVE FOR ALL USING (false) WITH CHECK (false);
CREATE POLICY "Admins can view sequence logs" ON public.email_sequence_logs FOR SELECT USING (is_admin(auth.uid()));

-- Indexes
CREATE INDEX idx_sequence_steps_sequence_id ON public.email_sequence_steps(sequence_id);
CREATE INDEX idx_sequence_enrollments_sequence_id ON public.email_sequence_enrollments(sequence_id);
CREATE INDEX idx_sequence_enrollments_status ON public.email_sequence_enrollments(status);
CREATE INDEX idx_sequence_enrollments_next_send ON public.email_sequence_enrollments(next_send_at) WHERE status = 'active';
CREATE INDEX idx_sequence_logs_enrollment_id ON public.email_sequence_logs(enrollment_id);

-- Triggers for updated_at
CREATE TRIGGER update_email_sequences_updated_at BEFORE UPDATE ON public.email_sequences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_sequence_steps_updated_at BEFORE UPDATE ON public.email_sequence_steps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_email_sequence_enrollments_updated_at BEFORE UPDATE ON public.email_sequence_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
