-- Create activity_logs table for audit trail
CREATE TABLE public.activity_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity_logs (admin only)
CREATE POLICY "Admins can view all activity logs"
ON public.activity_logs
FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Anyone can insert activity logs"
ON public.activity_logs
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Add outcome tracking fields to leads
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS outcome_status text DEFAULT 'purchased';
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS outcome_updated_at timestamp with time zone;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS outcome_notes text;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS lost_reason text;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON public.activity_logs(entity_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_outcome_status ON public.leads(outcome_status);
CREATE INDEX IF NOT EXISTS idx_leads_source ON public.leads(source);

-- Enable realtime for activity logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.activity_logs;