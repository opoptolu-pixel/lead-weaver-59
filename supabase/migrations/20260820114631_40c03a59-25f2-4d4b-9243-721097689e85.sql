REVOKE ALL ON public.recurring_clean_plan_addons FROM anon;
NOTIFY pgrst,'reload schema';