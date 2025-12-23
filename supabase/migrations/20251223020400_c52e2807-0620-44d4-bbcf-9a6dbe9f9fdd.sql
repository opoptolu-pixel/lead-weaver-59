-- Add verification fields to profiles
ALTER TABLE public.profiles
ADD COLUMN is_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN verification_status TEXT DEFAULT 'pending',
ADD COLUMN leads_purchased INTEGER NOT NULL DEFAULT 0,
ADD COLUMN phone_verified BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN address_verified BOOLEAN NOT NULL DEFAULT false;

-- Create storage bucket for verification documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('verification-documents', 'verification-documents', false);

-- Create verification documents table
CREATE TABLE public.verification_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on verification_documents
ALTER TABLE public.verification_documents ENABLE ROW LEVEL SECURITY;

-- Users can view their own documents
CREATE POLICY "Users can view own verification documents"
ON public.verification_documents
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own documents
CREATE POLICY "Users can insert own verification documents"
ON public.verification_documents
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Storage policies for verification documents bucket
CREATE POLICY "Users can upload own verification documents"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'verification-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own verification documents storage"
ON storage.objects
FOR SELECT
USING (bucket_id = 'verification-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Create phone verification codes table
CREATE TABLE public.phone_verification_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.phone_verification_codes ENABLE ROW LEVEL SECURITY;

-- Users can manage their own verification codes
CREATE POLICY "Users can view own phone codes"
ON public.phone_verification_codes
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own phone codes"
ON public.phone_verification_codes
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own phone codes"
ON public.phone_verification_codes
FOR UPDATE
USING (user_id = auth.uid());

-- Update trigger for verification_documents
CREATE TRIGGER update_verification_documents_updated_at
BEFORE UPDATE ON public.verification_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();