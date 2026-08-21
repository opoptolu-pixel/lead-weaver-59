-- Reliable, idempotent cleaner assignment notifications and reminders.

CREATE TABLE IF NOT EXISTS public.cleaner_job_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.job_assignments(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  cleaner_id uuid NOT NULL REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('offer_email','assigned_email','reminder_3_day_email','reminder_1_day_email','reminder_day_email','reminder_day_sms','customer_reminder_3_day_email','customer_reminder_1_day_email','customer_reminder_day_email')),
  channel text NOT NULL CHECK (channel IN ('email','sms')),
  scheduled_for timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  provider_reference text,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id,notification_type)
);
CREATE INDEX IF NOT EXISTS cleaner_job_notifications_due_idx ON public.cleaner_job_notifications(status,scheduled_for);
ALTER TABLE public.cleaner_job_notifications ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.cleaner_job_notifications TO service_role;
GRANT SELECT ON public.cleaner_job_notifications TO authenticated;
DROP POLICY IF EXISTS "Admins view cleaner job notifications" ON public.cleaner_job_notifications;
CREATE POLICY "Admins view cleaner job notifications" ON public.cleaner_job_notifications FOR SELECT TO authenticated USING(public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.queue_cleaner_job_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE v_job public.jobs%ROWTYPE;
BEGIN
  SELECT * INTO v_job FROM public.jobs WHERE id=NEW.job_id;
  IF NEW.status='offered' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.cleaner_job_notifications(assignment_id,job_id,cleaner_id,notification_type,channel,scheduled_for)
    VALUES(NEW.id,NEW.job_id,NEW.cleaner_id,'offer_email','email',now()) ON CONFLICT(assignment_id,notification_type) DO NOTHING;
  END IF;
  IF NEW.status='accepted' AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status) THEN
    INSERT INTO public.cleaner_job_notifications(assignment_id,job_id,cleaner_id,notification_type,channel,scheduled_for) VALUES
      (NEW.id,NEW.job_id,NEW.cleaner_id,'assigned_email','email',now()),
      (NEW.id,NEW.job_id,NEW.cleaner_id,'reminder_3_day_email','email',((v_job.scheduled_date-3)+time '09:00') AT TIME ZONE 'Europe/London'),
      (NEW.id,NEW.job_id,NEW.cleaner_id,'reminder_1_day_email','email',((v_job.scheduled_date-1)+time '09:00') AT TIME ZONE 'Europe/London'),
      (NEW.id,NEW.job_id,NEW.cleaner_id,'reminder_day_email','email',(v_job.scheduled_date+time '09:00') AT TIME ZONE 'Europe/London'),
      (NEW.id,NEW.job_id,NEW.cleaner_id,'reminder_day_sms','sms',(v_job.scheduled_date+time '09:00') AT TIME ZONE 'Europe/London'),
      (NEW.id,NEW.job_id,NEW.cleaner_id,'customer_reminder_3_day_email','email',((v_job.scheduled_date-3)+time '09:00') AT TIME ZONE 'Europe/London'),
      (NEW.id,NEW.job_id,NEW.cleaner_id,'customer_reminder_1_day_email','email',((v_job.scheduled_date-1)+time '09:00') AT TIME ZONE 'Europe/London'),
      (NEW.id,NEW.job_id,NEW.cleaner_id,'customer_reminder_day_email','email',(v_job.scheduled_date+time '09:00') AT TIME ZONE 'Europe/London')
    ON CONFLICT(assignment_id,notification_type) DO UPDATE SET scheduled_for=excluded.scheduled_for,status=CASE WHEN public.cleaner_job_notifications.status='sent' THEN 'sent' ELSE 'pending' END,updated_at=now();
  END IF;
  IF NEW.status IN ('declined','revoked') THEN UPDATE public.cleaner_job_notifications SET status='cancelled',updated_at=now() WHERE assignment_id=NEW.id AND status IN('pending','failed'); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS queue_cleaner_job_notifications_trigger ON public.job_assignments;
CREATE TRIGGER queue_cleaner_job_notifications_trigger AFTER INSERT OR UPDATE OF status ON public.job_assignments FOR EACH ROW EXECUTE FUNCTION public.queue_cleaner_job_notifications();

CREATE OR REPLACE FUNCTION public.reschedule_cleaner_job_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  UPDATE public.cleaner_job_notifications n SET
    scheduled_for=CASE n.notification_type WHEN 'reminder_3_day_email' THEN ((NEW.scheduled_date-3)+time '09:00') AT TIME ZONE 'Europe/London' WHEN 'reminder_1_day_email' THEN ((NEW.scheduled_date-1)+time '09:00') AT TIME ZONE 'Europe/London' ELSE (NEW.scheduled_date+time '09:00') AT TIME ZONE 'Europe/London' END,
    status=CASE WHEN n.status='sent' THEN 'sent' ELSE 'pending' END,updated_at=now()
  WHERE n.job_id=NEW.id AND n.notification_type LIKE '%reminder_%' AND n.status<>'cancelled';
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS reschedule_cleaner_job_notifications_trigger ON public.jobs;
CREATE TRIGGER reschedule_cleaner_job_notifications_trigger AFTER UPDATE OF scheduled_date,start_time,expected_duration_minutes ON public.jobs FOR EACH ROW WHEN(OLD.scheduled_date IS DISTINCT FROM NEW.scheduled_date OR OLD.start_time IS DISTINCT FROM NEW.start_time OR OLD.expected_duration_minutes IS DISTINCT FROM NEW.expected_duration_minutes) EXECUTE FUNCTION public.reschedule_cleaner_job_notifications();

INSERT INTO public.platform_schema_versions(version,description) VALUES('20260816300000','Idempotent cleaner assignment emails and 3-day, 1-day and day-of reminders') ON CONFLICT(version) DO UPDATE SET description=excluded.description;

INSERT INTO public.email_templates(name,subject,body,description,variables,is_active) VALUES
('agency_quote_payment_link','Your Cleanda cleaning quote — {{customer_price}}','<h1>Your Cleanda quote</h1><p>Hello {{customer_name}},</p><p>We have confirmed your requirements for <strong>{{service_name}}</strong>.</p><p><strong>Price:</strong> {{customer_price}}<br><strong>Date:</strong> {{scheduled_date}} at {{start_time}}<br><strong>Reference:</strong> {{request_reference}}</p><p>Your booking is confirmed only after payment.</p><p><a href="{{payment_url}}">Accept and pay securely</a></p>','Customer quote and secure payment link',ARRAY['customer_name','service_name','customer_price','scheduled_date','start_time','request_reference','payment_url'],true),
('agency_payment_confirmation','Your Cleanda booking is confirmed — {{request_reference}}','<h1>Booking confirmed</h1><p>Hello {{customer_name}},</p><p>Your payment has been received and your cleaning is booked.</p><p><strong>Service:</strong> {{service_name}}<br><strong>Amount:</strong> {{customer_price}}<br><strong>Date:</strong> {{scheduled_date}} at {{start_time}}<br><strong>Duration:</strong> {{duration}}<br><strong>Request:</strong> {{request_reference}}<br><strong>Job:</strong> {{job_reference}}</p>','Customer payment and booking confirmation',ARRAY['customer_name','service_name','customer_price','scheduled_date','start_time','duration','request_reference','job_reference'],true),
('cleaner_job_offer','New Cleanda job offer — {{job_reference}}','<h1>New job offer</h1><p>Hi {{cleaner_name}},</p><p>{{service_name}} on {{scheduled_date}} at {{start_time}} ({{duration}}).</p><p><strong>Area:</strong> {{postcode}}<br><strong>Payout:</strong> {{cleaner_payout}}<br><strong>Reference:</strong> {{job_reference}}</p><p>Open your Cleanda dashboard to accept or decline. The full address is released after acceptance.</p>','Cleaner job offer without private address',ARRAY['cleaner_name','service_name','scheduled_date','start_time','duration','postcode','cleaner_payout','job_reference'],true),
('cleaner_assignment_confirmed','Your Cleanda job is confirmed — {{job_reference}}','<h1>Job confirmed</h1><p>Hi {{cleaner_name}},</p><p><strong>Customer:</strong> {{customer_name}}<br><strong>Service:</strong> {{service_name}}<br><strong>Date:</strong> {{scheduled_date}} at {{start_time}}<br><strong>Duration:</strong> {{duration}}<br><strong>Address:</strong> {{full_address}}<br><strong>Access:</strong> {{access_notes}}<br><strong>Instructions:</strong> {{instructions}}<br><strong>Payout:</strong> {{cleaner_payout}}<br><strong>Reference:</strong> {{job_reference}}</p>','Full cleaner assignment details after acceptance',ARRAY['cleaner_name','customer_name','service_name','scheduled_date','start_time','duration','full_address','access_notes','instructions','cleaner_payout','job_reference'],true),
('cleaner_reminder_3_day','Reminder: cleaning job in 3 days — {{job_reference}}','<h1>Job in 3 days</h1><p>Hi {{cleaner_name}},</p><p>{{service_name}} for {{customer_name}} is on {{scheduled_date}} at {{start_time}}.</p><p>{{full_address}} · {{duration}} · Payout {{cleaner_payout}}</p>','Cleaner three-day reminder',ARRAY['cleaner_name','customer_name','service_name','scheduled_date','start_time','full_address','duration','cleaner_payout','job_reference'],true),
('cleaner_reminder_1_day','Reminder: cleaning job tomorrow — {{job_reference}}','<h1>Job tomorrow</h1><p>Hi {{cleaner_name}},</p><p>{{service_name}} for {{customer_name}} is tomorrow at {{start_time}}.</p><p>{{full_address}} · {{duration}} · Payout {{cleaner_payout}}</p>','Cleaner one-day reminder',ARRAY['cleaner_name','customer_name','service_name','start_time','full_address','duration','cleaner_payout','job_reference'],true),
('cleaner_reminder_day','Reminder: cleaning job today — {{job_reference}}','<h1>Job today</h1><p>Hi {{cleaner_name}},</p><p>{{service_name}} for {{customer_name}} is today at {{start_time}}.</p><p>{{full_address}} · {{access_notes}}</p>','Cleaner cleaning-day email',ARRAY['cleaner_name','customer_name','service_name','start_time','full_address','access_notes','job_reference'],true),
('cleaner_reminder_day_sms','Cleanda: {{service_name}} for {{customer_name}} is today at {{start_time}}. {{full_address}}. Ref {{job_reference}}.','Cleanda: {{service_name}} for {{customer_name}} is today at {{start_time}}. {{full_address}}. Ref {{job_reference}}.','Cleaner cleaning-day SMS',ARRAY['service_name','customer_name','start_time','full_address','job_reference'],true),
('customer_reminder_3_day','Your Cleanda clean is in 3 days — {{job_reference}}','<h1>Your cleaning is in 3 days</h1><p>Hi {{customer_name}},</p><p>Your {{service_name}} is booked for {{scheduled_date}} at {{start_time}}.</p><p>Reference: {{job_reference}}</p>','Customer three-day reminder',ARRAY['customer_name','service_name','scheduled_date','start_time','job_reference'],true),
('customer_reminder_1_day','Your Cleanda clean is tomorrow — {{job_reference}}','<h1>Your cleaning is tomorrow</h1><p>Hi {{customer_name}},</p><p>Your {{service_name}} is booked tomorrow at {{start_time}}.</p><p>Reference: {{job_reference}}</p>','Customer one-day reminder',ARRAY['customer_name','service_name','start_time','job_reference'],true),
('customer_reminder_day','Your Cleanda clean is today — {{job_reference}}','<h1>Your cleaning is today</h1><p>Hi {{customer_name}},</p><p>Your {{service_name}} is scheduled today at {{start_time}}.</p><p>Reference: {{job_reference}}</p>','Customer cleaning-day reminder',ARRAY['customer_name','service_name','start_time','job_reference'],true)
ON CONFLICT(name) DO UPDATE SET description=excluded.description,variables=excluded.variables;
NOTIFY pgrst,'reload schema';