-- Create email_subscribers table to track email consent and improve deliverability
CREATE TABLE public.email_subscribers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  source TEXT NOT NULL, -- 'contact_form', 'cleaning_request', 'business_inquiry', 'manual'
  source_id UUID, -- Reference to the original submission
  subscribed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_email UNIQUE (email)
);

-- Enable RLS
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;

-- Admins can view all subscribers
CREATE POLICY "Admins can view all subscribers"
  ON public.email_subscribers
  FOR SELECT
  USING (is_admin(auth.uid()));

-- Admins can manage subscribers
CREATE POLICY "Admins can manage subscribers"
  ON public.email_subscribers
  FOR ALL
  USING (is_admin(auth.uid()));

-- Allow service role to insert (for edge functions)
CREATE POLICY "Service role can insert subscribers"
  ON public.email_subscribers
  FOR INSERT
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE TRIGGER update_email_subscribers_updated_at
  BEFORE UPDATE ON public.email_subscribers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster lookups
CREATE INDEX idx_email_subscribers_email ON public.email_subscribers(email);
CREATE INDEX idx_email_subscribers_source ON public.email_subscribers(source);
CREATE INDEX idx_email_subscribers_active ON public.email_subscribers(is_active);