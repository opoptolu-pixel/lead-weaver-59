CREATE TABLE public.lead_sms_notification_deliveries (
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lead_id, phone)
);

GRANT ALL ON public.lead_sms_notification_deliveries TO service_role;

ALTER TABLE public.lead_sms_notification_deliveries ENABLE ROW LEVEL SECURITY;