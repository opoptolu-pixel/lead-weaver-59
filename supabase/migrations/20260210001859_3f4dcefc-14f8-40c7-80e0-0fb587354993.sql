ALTER TABLE public.leads DROP CONSTRAINT leads_job_status_check;

ALTER TABLE public.leads ADD CONSTRAINT leads_job_status_check CHECK (job_status = ANY (ARRAY['pending'::text, 'contacted'::text, 'booked'::text, 'completed'::text, 'lost'::text, 'no_response'::text]));