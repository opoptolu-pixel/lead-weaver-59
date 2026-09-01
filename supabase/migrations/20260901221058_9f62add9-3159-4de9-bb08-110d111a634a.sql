BEGIN;

CREATE TABLE IF NOT EXISTS public.legacy_cleanup_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL,
  object_type text NOT NULL,
  object_key text NOT NULL,
  previous_state jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.legacy_cleanup_snapshots TO authenticated;
GRANT ALL ON public.legacy_cleanup_snapshots TO service_role;
ALTER TABLE public.legacy_cleanup_snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='legacy_cleanup_snapshots' AND policyname='Admins view cleanup snapshots') THEN
    CREATE POLICY "Admins view cleanup snapshots" ON public.legacy_cleanup_snapshots
      FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));
  END IF;
END $$;

DO $$
DECLARE
  v_batch text := 'legacy_managed_agency_cleanup_20260901';
  v_name text;
  v_cnt int;
  v_job record;
  v_trg record;
  v_names text[] := ARRAY[
    'process-cleaner-job-notifications-every-5min',
    'process-cleaner-compliance-reminders-daily',
    'recurring-clean-billing-daily'
  ];
  v_triggers text[][] := ARRAY[
    ARRAY['job_assignments','queue_cleaner_job_notifications_trigger'],
    ARRAY['jobs','reschedule_cleaner_job_notifications_trigger'],
    ARRAY['cleaner_vetting_records','schedule_cleaner_right_to_work_reminders_trigger']
  ];
  v_templates text[] := ARRAY[
    'agency_no_show_cover_update','agency_no_show_refund','agency_no_show_rescheduled',
    'agency_payment_confirmation','agency_quote_payment_link',
    'cleaner_assignment_confirmed','cleaner_job_offer',
    'cleaner_reminder_1_day','cleaner_reminder_3_day','cleaner_reminder_day','cleaner_reminder_day_sms',
    'cleaner_right_to_work_1_month','cleaner_right_to_work_2_month','cleaner_right_to_work_3_month','cleaner_right_to_work_expired',
    'customer_reminder_1_day','customer_reminder_3_day','customer_reminder_day'
  ];
  i int;
BEGIN
  -- 1. Cron jobs
  FOREACH v_name IN ARRAY v_names LOOP
    SELECT count(*) INTO v_cnt FROM cron.job WHERE jobname = v_name;
    IF v_cnt <> 1 THEN
      RAISE EXCEPTION 'Cron job name % resolved to % rows (expected exactly 1)', v_name, v_cnt;
    END IF;
    SELECT jobid, jobname, active, schedule, command INTO v_job FROM cron.job WHERE jobname = v_name;
    IF v_job.active THEN
      INSERT INTO public.legacy_cleanup_snapshots (batch_id, object_type, object_key, previous_state)
      VALUES (v_batch, 'cron_job', v_name, jsonb_build_object('jobid', v_job.jobid, 'jobname', v_job.jobname, 'active', v_job.active, 'schedule', v_job.schedule));
      PERFORM cron.alter_job(v_job.jobid, active := false);
    END IF;
  END LOOP;

  -- 2. Enqueue triggers
  FOR i IN 1 .. array_length(v_triggers, 1) LOOP
    SELECT t.tgname, t.tgenabled, c.relname INTO v_trg
    FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname = 'public' AND c.relname = v_triggers[i][1] AND t.tgname = v_triggers[i][2];
    IF v_trg IS NULL THEN
      RAISE EXCEPTION 'Trigger %.% not found', v_triggers[i][1], v_triggers[i][2];
    END IF;
    IF v_trg.tgenabled <> 'D' THEN
      INSERT INTO public.legacy_cleanup_snapshots (batch_id, object_type, object_key, previous_state)
      VALUES (v_batch, 'trigger', v_triggers[i][1] || '.' || v_triggers[i][2], jsonb_build_object('table', v_triggers[i][1], 'trigger', v_triggers[i][2], 'tgenabled', v_trg.tgenabled));
      EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I', v_triggers[i][1], v_triggers[i][2]);
    END IF;
  END LOOP;

  -- 3. Email templates
  INSERT INTO public.legacy_cleanup_snapshots (batch_id, object_type, object_key, previous_state)
  SELECT v_batch, 'email_template', t.name,
         jsonb_build_object('id', t.id, 'name', t.name, 'is_active', t.is_active, 'updated_at', t.updated_at)
  FROM public.email_templates t
  WHERE t.name = ANY(v_templates) AND t.is_active IS TRUE;

  UPDATE public.email_templates SET is_active = false
  WHERE name = ANY(v_templates) AND is_active IS TRUE;

  -- 4. Compliance reminders
  INSERT INTO public.legacy_cleanup_snapshots (batch_id, object_type, object_key, previous_state)
  SELECT v_batch, 'cleaner_compliance_reminder', r.id::text, to_jsonb(r)
  FROM public.cleaner_compliance_reminders r
  WHERE r.status IN ('scheduled','failed');

  UPDATE public.cleaner_compliance_reminders
  SET status = 'cancelled',
      last_error = 'legacy_managed_agency_cleanup' || CASE WHEN last_error IS NULL OR last_error = '' THEN '' ELSE ' | previous: ' || last_error END
  WHERE status IN ('scheduled','failed');
END $$;

COMMIT;