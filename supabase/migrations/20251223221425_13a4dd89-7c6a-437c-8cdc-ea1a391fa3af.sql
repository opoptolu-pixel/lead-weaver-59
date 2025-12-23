-- Create table to store hashed recovery codes for 2FA backup
CREATE TABLE public.mfa_recovery_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  code_hash TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.mfa_recovery_codes ENABLE ROW LEVEL SECURITY;

-- Users can only view their own recovery codes (but not the hashes in practice - they see them once at creation)
CREATE POLICY "Users can view their own recovery codes" 
ON public.mfa_recovery_codes 
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own recovery codes
CREATE POLICY "Users can create their own recovery codes" 
ON public.mfa_recovery_codes 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own recovery codes (mark as used)
CREATE POLICY "Users can update their own recovery codes" 
ON public.mfa_recovery_codes 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own recovery codes (when regenerating)
CREATE POLICY "Users can delete their own recovery codes" 
ON public.mfa_recovery_codes 
FOR DELETE 
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_mfa_recovery_codes_user_id ON public.mfa_recovery_codes(user_id);