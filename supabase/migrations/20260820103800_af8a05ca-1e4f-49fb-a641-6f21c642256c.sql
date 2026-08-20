REVOKE EXECUTE ON FUNCTION public.create_recurring_clean_plan(uuid,uuid,uuid,uuid,text,text,date,time,integer,integer,integer,integer,integer,integer,text,text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_recurring_clean_plan(uuid,uuid,uuid,uuid,text,text,date,time,integer,integer,integer,integer,integer,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_recurring_clean_plan(uuid,uuid,uuid,uuid,text,text,date,time,integer,integer,integer,integer,integer,integer,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';