-- Add job status tracking for unlocked leads
ALTER TABLE public.leads 
ADD COLUMN job_status text DEFAULT 'pending' CHECK (job_status IN ('pending', 'completed', 'lost', 'no_response'));

-- Add notes field for additional context
ALTER TABLE public.leads 
ADD COLUMN job_notes text;

-- Add completed_at timestamp
ALTER TABLE public.leads 
ADD COLUMN job_completed_at timestamp with time zone;