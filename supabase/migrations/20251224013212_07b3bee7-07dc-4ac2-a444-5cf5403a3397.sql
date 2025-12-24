-- Add fields for WhatsApp/SMS confirmation tracking
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confirmation_response TEXT,
ADD COLUMN IF NOT EXISTS auto_publish_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS confirmation_method TEXT DEFAULT 'whatsapp';

-- Add comment for clarity
COMMENT ON COLUMN public.leads.confirmation_sent_at IS 'When the confirmation message was sent to customer';
COMMENT ON COLUMN public.leads.confirmation_response IS 'Customer response: confirmed, declined, or null';
COMMENT ON COLUMN public.leads.auto_publish_at IS 'When to auto-publish if no confirmation response';
COMMENT ON COLUMN public.leads.confirmation_method IS 'whatsapp or sms';