CREATE OR REPLACE FUNCTION public.agency_audit_redact(payload jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT COALESCE(payload, '{}'::jsonb) - ARRAY[
    'account_number','bank_account','bank_account_number','bank_account_holder',
    'sort_code','bank_sort_code','right_to_work_share_code','date_of_birth',
    'file_path','storage_path','provider_reference','provider_payment_id','metadata'
  ];
$$;

CREATE OR REPLACE FUNCTION public.agency_audit_changes(before_row jsonb, after_row jsonb)
RETURNS jsonb LANGUAGE sql IMMUTABLE SET search_path = public AS $$
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

REVOKE ALL ON FUNCTION public.capture_agency_audit_event() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agency_audit_redact(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.agency_audit_changes(jsonb,jsonb) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';