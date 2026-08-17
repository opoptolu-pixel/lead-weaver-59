REVOKE ALL ON public.cleaner_vetting_records FROM anon;
REVOKE ALL ON public.cleaner_vetting_documents FROM anon;
REVOKE ALL ON public.cleaner_compliance_reminders FROM anon;
NOTIFY pgrst, 'reload schema';