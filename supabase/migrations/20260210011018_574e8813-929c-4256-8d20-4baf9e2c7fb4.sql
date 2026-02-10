
-- Add booked_date column to store the date the cleaning service is scheduled
ALTER TABLE public.leads ADD COLUMN booked_date date NULL;

-- Add sms_reminders_sent to track which reminders have been sent (array of strings like '3_day', '2_day', 'morning')
ALTER TABLE public.leads ADD COLUMN sms_reminders_sent text[] NULL DEFAULT '{}';

-- Index for efficient lookup of leads needing reminders
CREATE INDEX idx_leads_booked_reminders ON public.leads (booked_date, job_status) WHERE job_status = 'booked' AND booked_date IS NOT NULL;
