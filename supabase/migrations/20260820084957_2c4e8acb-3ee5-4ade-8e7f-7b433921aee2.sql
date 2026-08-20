-- Append-only operational audit trail for the managed agency.
-- Sensitive credentials, bank values and document paths are deliberately redacted.

CREATE TABLE IF NOT EXISTS public.agency_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type text NOT NULL DEFAULT 'system' CHECK (actor_type IN ('admin','cleaner','customer','system')),
  subject_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  action text NOT NULL CHECK (action IN ('created','updated','deleted')),
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS agency_audit_events_occurred_idx ON public.agency_audit_events (occurred_at DESC);
CREATE INDEX IF NOT EXISTS agency_audit_events_subject_idx ON public.agency_audit_events (subject_user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS agency_audit_events_entity_idx ON public.agency_audit_events (entity_type, entity_id, occurred_at DESC);

ALTER TABLE public.agency_audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view agency audit events" ON public.agency_audit_events
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.agency_audit_redact(payload jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(payload, '{}'::jsonb) - ARRAY[
    'account_number','bank_account','bank_account_number','bank_account_holder',
    'sort_code','bank_sort_code','right_to_work_share_code','date_of_birth',
    'file_path','storage_path','provider_reference','provider_payment_id','metadata'
  ];
$$;

CREATE OR REPLACE FUNCTION public.agency_audit_changes(before_row jsonb, after_row jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_object_agg(after_values.key, jsonb_build_object(
    'from', before_values.value,
    'to', after_values.value
  )), '{}'::jsonb)
  FROM jsonb_each(public.agency_audit_redact(after_row)) AS after_values(key, value)
  LEFT JOIN jsonb_each(public.agency_audit_redact(before_row)) AS before_values(key, value)
    USING (key)
  WHERE after_values.key NOT IN ('updated_at','created_at','reviewed_at','offered_at','responded_at','paid_at','submitted_at','completed_at','clocked_in_at','clocked_out_at')
    AND before_values.value IS DISTINCT FROM after_values.value;
$$;

CREATE OR REPLACE FUNCTION public.capture_agency_audit_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  current_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  old_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  entity_uuid uuid;
  subject_uuid uuid;
  actor_uuid uuid := auth.uid();
  actor_kind text := 'system';
BEGIN
  entity_uuid := COALESCE(
    NULLIF(current_row->>'id','')::uuid,
    NULLIF(current_row->>'cleaner_id','')::uuid,
    NULLIF(current_row->>'job_id','')::uuid,
    NULLIF(current_row->>'service_request_id','')::uuid,
    NULLIF(current_row->>'customer_id','')::uuid
  );

  IF TG_TABLE_NAME = 'cleaner_profiles' THEN
    subject_uuid := NULLIF(current_row->>'user_id','')::uuid;
  ELSIF current_row ? 'cleaner_id' THEN
    SELECT user_id INTO subject_uuid FROM public.cleaner_profiles WHERE id = (current_row->>'cleaner_id')::uuid;
  ELSIF TG_TABLE_NAME = 'customers' THEN
    subject_uuid := NULLIF(current_row->>'auth_user_id','')::uuid;
  ELSIF TG_TABLE_NAME IN ('service_requests','customer_addresses') THEN
    SELECT auth_user_id INTO subject_uuid FROM public.customers WHERE id = (current_row->>'customer_id')::uuid;
  END IF;

  IF actor_uuid IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = actor_uuid) THEN
      actor_kind := 'admin';
    ELSIF EXISTS (SELECT 1 FROM public.cleaner_profiles WHERE user_id = actor_uuid) THEN
      actor_kind := 'cleaner';
    ELSE
      actor_kind := 'customer';
    END IF;
  END IF;

  INSERT INTO public.agency_audit_events (
    actor_user_id, actor_type, subject_user_id, entity_type, entity_id, action, changes, metadata
  ) VALUES (
    actor_uuid,
    actor_kind,
    subject_uuid,
    TG_TABLE_NAME,
    entity_uuid,
    lower(TG_OP),
    CASE WHEN TG_OP = 'DELETE' THEN public.agency_audit_redact(old_row) ELSE public.agency_audit_changes(old_row, current_row) END,
    jsonb_build_object('source', CASE WHEN actor_uuid IS NULL THEN 'system_or_public_flow' ELSE 'authenticated_app' END)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DO $$
DECLARE audit_table text;
BEGIN
  FOREACH audit_table IN ARRAY ARRAY[
    'cleaner_profiles','cleaner_vetting_records','cleaner_vetting_documents',
    'cleaner_availability','cleaner_service_capabilities','cleaner_service_areas',
    'customers','customer_addresses','service_requests','quotes','jobs','job_assignments',
    'customer_payments','cleaner_payouts','job_events','job_time_entries',
    'job_checklist_items','job_evidence','job_issues','job_issue_events',
    'cleaner_job_notifications','support_messages'
  ] LOOP
    IF to_regclass('public.' || audit_table) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS agency_audit_%I ON public.%I', audit_table, audit_table);
      EXECUTE format(
        'CREATE TRIGGER agency_audit_%I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.capture_agency_audit_event()',
        audit_table, audit_table
      );
    END IF;
  END LOOP;
END $$;

GRANT SELECT ON public.agency_audit_events TO authenticated;
GRANT ALL ON public.agency_audit_events TO service_role;

INSERT INTO public.platform_schema_versions(version,description)
VALUES ('20260820121500','Agency-wide append-only audit trail with sensitive data redaction')
ON CONFLICT(version) DO UPDATE SET description = EXCLUDED.description;

NOTIFY pgrst, 'reload schema';