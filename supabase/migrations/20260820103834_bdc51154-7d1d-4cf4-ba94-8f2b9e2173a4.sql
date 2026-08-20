REVOKE ALL ON public.recurring_clean_billing_cycles FROM anon;
NOTIFY pgrst,'reload schema';