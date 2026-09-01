CREATE OR REPLACE FUNCTION public.capture_agency_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  current_row jsonb := CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  old_row jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  entity_uuid uuid;
  subject_uuid uuid;
  actor_uuid uuid := auth.uid();
  actor_kind text := 'system';
  action_label text := CASE TG_OP
    WHEN 'INSERT' THEN 'created'
    WHEN 'UPDATE' THEN 'updated'
    WHEN 'DELETE' THEN 'deleted'
    ELSE 'updated'
  END;
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
    action_label,
    CASE WHEN TG_OP = 'DELETE' THEN public.agency_audit_redact(old_row) ELSE public.agency_audit_changes(old_row, current_row) END,
    jsonb_build_object('source', CASE WHEN actor_uuid IS NULL THEN 'system_or_public_flow' ELSE 'authenticated_app' END)
  );
  RETURN COALESCE(NEW, OLD);
END;
$function$;