REVOKE ALL ON TABLE public.cleaner_bank_accounts FROM authenticated;
GRANT SELECT ON TABLE public.cleaner_bank_accounts TO authenticated;

DO $$
BEGIN
  -- ensure service_role retains full access if not already present
  IF NOT has_table_privilege('service_role', 'public.cleaner_bank_accounts', 'INSERT') THEN
    GRANT ALL ON TABLE public.cleaner_bank_accounts TO service_role;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';