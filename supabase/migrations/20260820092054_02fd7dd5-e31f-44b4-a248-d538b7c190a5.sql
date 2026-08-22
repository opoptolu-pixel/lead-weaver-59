REVOKE EXECUTE ON FUNCTION public.create_recurring_clean_plan(uuid,uuid,uuid,uuid,text,date,time,integer,integer,integer,integer,integer,integer,text,text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.pause_recurring_clean_plan(uuid,boolean) FROM anon, PUBLIC;
REVOKE ALL ON public.recurring_clean_plans FROM anon;
REVOKE ALL ON public.recurring_clean_visits FROM anon;