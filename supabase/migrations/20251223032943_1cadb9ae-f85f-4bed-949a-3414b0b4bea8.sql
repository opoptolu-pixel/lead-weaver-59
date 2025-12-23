-- Create table for business inquiries from the landing page
CREATE TABLE public.business_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  postcode TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  whatsapp_optin BOOLEAN DEFAULT false,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID
);

-- Enable RLS
ALTER TABLE public.business_inquiries ENABLE ROW LEVEL SECURITY;

-- Allow anyone to submit inquiries (public form)
CREATE POLICY "Anyone can submit business inquiries"
ON public.business_inquiries
FOR INSERT
WITH CHECK (true);

-- Admins can view and manage all inquiries
CREATE POLICY "Admins can view all business inquiries"
ON public.business_inquiries
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can update business inquiries"
ON public.business_inquiries
FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can delete business inquiries"
ON public.business_inquiries
FOR DELETE
USING (is_admin(auth.uid()));