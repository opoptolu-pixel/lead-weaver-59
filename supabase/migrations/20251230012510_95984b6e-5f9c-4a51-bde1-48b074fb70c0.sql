-- Add insurance_expiry_date column to verification_documents table
ALTER TABLE public.verification_documents 
ADD COLUMN IF NOT EXISTS expiry_date date;

-- Add a comment to describe the column
COMMENT ON COLUMN public.verification_documents.expiry_date IS 'Expiry date for documents like insurance certificates';

-- Create index for efficient querying of expiring documents
CREATE INDEX IF NOT EXISTS idx_verification_documents_expiry 
ON public.verification_documents(expiry_date) 
WHERE document_type = 'insurance' AND status = 'approved';