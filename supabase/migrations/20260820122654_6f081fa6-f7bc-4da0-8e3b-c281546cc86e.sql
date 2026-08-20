REVOKE EXECUTE ON FUNCTION public.next_cleaner_pay_date(date) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_cleaner_pay_date(date) TO authenticated, service_role;