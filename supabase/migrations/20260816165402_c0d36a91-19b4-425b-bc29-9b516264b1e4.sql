REVOKE EXECUTE ON FUNCTION public.mark_cleaner_payout_paid(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_cleaner_payout_paid(uuid, text) TO authenticated;
NOTIFY pgrst, 'reload schema';