-- Structured individual-cleaner onboarding and right-to-work monitoring.
CREATE TABLE IF NOT EXISTS public.cleaner_vetting_records (
  cleaner_id uuid PRIMARY KEY REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  address_line_1 text,
  address_line_2 text,
  city text,
  citizenship_route text CHECK (citizenship_route IN ('british','irish','other')),
  date_of_birth date,
  right_to_work_share_code text,
  identity_status text NOT NULL DEFAULT 'not_submitted' CHECK (identity_status IN ('not_submitted','pending_review','approved','rejected','replacement_required')),
  address_status text NOT NULL DEFAULT 'not_submitted' CHECK (address_status IN ('not_submitted','pending_review','approved','rejected','replacement_required')),
  right_to_work_status text NOT NULL DEFAULT 'not_submitted' CHECK (right_to_work_status IN ('not_submitted','pending_review','approved','rejected','replacement_required','expired')),
  right_to_work_basis text CHECK (right_to_work_basis IN ('continuous','time_limited')),
  right_to_work_expires_on date,
  right_to_work_checked_at timestamptz,
  right_to_work_checked_by uuid REFERENCES auth.users(id),
  right_to_work_restrictions text,
  right_to_work_result_path text,
  dbs_status text NOT NULL DEFAULT 'not_provided' CHECK (dbs_status IN ('not_provided','pending_review','verified','rejected')),
  dbs_certificate_number text,
  admin_notes text,
  submitted_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cleaner_vetting_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id uuid NOT NULL REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  document_type text NOT NULL CHECK (document_type IN ('identity','proof_of_address','right_to_work_result','dbs')),
  file_path text NOT NULL,
  status text NOT NULL DEFAULT 'pending_review' CHECK (status IN ('pending_review','approved','rejected','replacement_required')),
  is_current boolean NOT NULL DEFAULT true,
  superseded_at timestamptz,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  admin_notes text
);
CREATE UNIQUE INDEX IF NOT EXISTS cleaner_vetting_documents_one_current
  ON public.cleaner_vetting_documents(cleaner_id, document_type) WHERE is_current;

CREATE TABLE IF NOT EXISTS public.cleaner_compliance_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cleaner_id uuid NOT NULL REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('right_to_work_3_month','right_to_work_2_month','right_to_work_1_month','right_to_work_expired')),
  scheduled_for date NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','processing','sent','failed','cancelled')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE(cleaner_id, reminder_type, scheduled_for)
);

ALTER TABLE public.cleaner_vetting_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_vetting_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleaner_compliance_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage cleaner vetting" ON public.cleaner_vetting_records FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Cleaners view own vetting" ON public.cleaner_vetting_records FOR SELECT TO authenticated USING (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id=auth.uid()));
CREATE POLICY "Admins manage cleaner vetting documents" ON public.cleaner_vetting_documents FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Cleaners view own vetting documents" ON public.cleaner_vetting_documents FOR SELECT TO authenticated USING (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id=auth.uid()));
CREATE POLICY "Admins view compliance reminders" ON public.cleaner_compliance_reminders FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Cleaners view own compliance reminders" ON public.cleaner_compliance_reminders FOR SELECT TO authenticated USING (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id=auth.uid()));

CREATE OR REPLACE FUNCTION public.schedule_cleaner_right_to_work_reminders()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.cleaner_compliance_reminders SET status='cancelled'
  WHERE cleaner_id=NEW.cleaner_id AND status IN ('scheduled','failed');
  IF NEW.right_to_work_basis='time_limited' AND NEW.right_to_work_expires_on IS NOT NULL THEN
    INSERT INTO public.cleaner_compliance_reminders(cleaner_id,reminder_type,scheduled_for) VALUES
      (NEW.cleaner_id,'right_to_work_3_month',(NEW.right_to_work_expires_on-interval '3 months')::date),
      (NEW.cleaner_id,'right_to_work_2_month',(NEW.right_to_work_expires_on-interval '2 months')::date),
      (NEW.cleaner_id,'right_to_work_1_month',(NEW.right_to_work_expires_on-interval '1 month')::date),
      (NEW.cleaner_id,'right_to_work_expired',NEW.right_to_work_expires_on)
    ON CONFLICT(cleaner_id,reminder_type,scheduled_for) DO UPDATE SET status='scheduled',sent_at=NULL,attempts=0,last_error=NULL;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS schedule_cleaner_right_to_work_reminders_trigger ON public.cleaner_vetting_records;
CREATE TRIGGER schedule_cleaner_right_to_work_reminders_trigger AFTER INSERT OR UPDATE OF right_to_work_basis,right_to_work_expires_on ON public.cleaner_vetting_records FOR EACH ROW EXECUTE FUNCTION public.schedule_cleaner_right_to_work_reminders();

CREATE OR REPLACE FUNCTION public.cleaner_vetting_ready(p_cleaner_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.cleaner_vetting_records v WHERE v.cleaner_id=p_cleaner_id AND v.identity_status='approved' AND v.address_status='approved' AND v.right_to_work_status='approved' AND (v.right_to_work_basis='continuous' OR v.right_to_work_expires_on>=current_date));
$$;

INSERT INTO public.cleaner_vetting_records(cleaner_id)
SELECT id FROM public.cleaner_profiles ON CONFLICT(cleaner_id) DO NOTHING;

INSERT INTO public.email_templates(name,subject,body,description,variables,is_active) VALUES
('cleaner_right_to_work_3_month','Action needed: right-to-work check expires in 3 months','<h1>Your right-to-work check needs renewing</h1><p>Hello {{cleaner_name}},</p><p>The right-to-work evidence Cleanda holds for you expires on <strong>{{expiry_date}}</strong>.</p><p>Please prepare your updated evidence and submit it from your Cleanda profile. Your current jobs are not affected at this stage.</p><p><a href="{{profile_url}}">Open your Cleanda profile</a></p>','Cleaner right-to-work expiry reminder at three months',ARRAY['cleaner_name','expiry_date','profile_url'],true),
('cleaner_right_to_work_2_month','Reminder: right-to-work check expires in 2 months','<h1>Right-to-work renewal reminder</h1><p>Hello {{cleaner_name}},</p><p>Your recorded right-to-work permission expires on <strong>{{expiry_date}}</strong>.</p><p>Please submit updated evidence from your Cleanda profile as soon as it is available.</p><p><a href="{{profile_url}}">Open your Cleanda profile</a></p>','Cleaner right-to-work expiry reminder at two months',ARRAY['cleaner_name','expiry_date','profile_url'],true),
('cleaner_right_to_work_1_month','Urgent: right-to-work check expires in 1 month','<h1>Your right-to-work check expires soon</h1><p>Hello {{cleaner_name}},</p><p>Your recorded right-to-work permission expires on <strong>{{expiry_date}}</strong>.</p><p>Please submit updated evidence now. Cleanda may have to pause future assignments if a valid follow-up check is not completed before expiry.</p><p><a href="{{profile_url}}">Open your Cleanda profile</a></p>','Cleaner right-to-work expiry reminder at one month',ARRAY['cleaner_name','expiry_date','profile_url'],true),
('cleaner_right_to_work_expired','Your recorded right-to-work check has expired','<h1>Right-to-work evidence expired</h1><p>Hello {{cleaner_name}},</p><p>The right-to-work permission Cleanda holds for you expired on <strong>{{expiry_date}}</strong>.</p><p>Please contact Cleanda and submit valid updated evidence. New assignments may be paused until the follow-up check is approved.</p><p><a href="{{profile_url}}">Open your Cleanda profile</a></p>','Cleaner notification when recorded right-to-work permission expires',ARRAY['cleaner_name','expiry_date','profile_url'],true)
ON CONFLICT(name) DO UPDATE SET subject=excluded.subject,body=excluded.body,description=excluded.description,variables=excluded.variables;

INSERT INTO public.platform_schema_versions(version,description) VALUES
('20260817223000','Structured cleaner identity, address, optional DBS and right-to-work expiry monitoring')
ON CONFLICT(version) DO UPDATE SET description=excluded.description;
NOTIFY pgrst, 'reload schema';
