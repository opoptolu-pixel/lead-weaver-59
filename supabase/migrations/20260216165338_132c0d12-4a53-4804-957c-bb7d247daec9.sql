-- Create failed_submissions table for client-side fallback when edge functions fail
CREATE TABLE public.failed_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  form_data JSONB NOT NULL,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  recovered_at TIMESTAMP WITH TIME ZONE,
  recovered_lead_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.failed_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone can insert (anonymous customers submitting forms)
CREATE POLICY "Anyone can insert failed submissions"
  ON public.failed_submissions FOR INSERT
  WITH CHECK (true);

-- Only admins can view/manage
CREATE POLICY "Admins can view failed submissions"
  ON public.failed_submissions FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update failed submissions"
  ON public.failed_submissions FOR UPDATE
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete failed submissions"
  ON public.failed_submissions FOR DELETE
  USING (is_admin(auth.uid()));

-- Base deny
CREATE POLICY "Base deny all access to failed_submissions"
  ON public.failed_submissions FOR ALL
  USING (false)
  WITH CHECK (false);

-- Add updated_at trigger
CREATE TRIGGER update_failed_submissions_updated_at
  BEFORE UPDATE ON public.failed_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();