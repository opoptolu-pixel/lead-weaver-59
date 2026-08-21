-- Private cleaner bank details and manual verification workflow.
CREATE TABLE IF NOT EXISTS public.cleaner_bank_accounts (
  cleaner_id uuid PRIMARY KEY REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  account_holder_name text NOT NULL,
  sort_code text NOT NULL CHECK (sort_code ~ '^[0-9]{6}$'),
  account_number text NOT NULL CHECK (account_number ~ '^[0-9]{8}$'),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cleaner_bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cleaners view own bank account" ON public.cleaner_bank_accounts;
CREATE POLICY "Cleaners view own bank account"
ON public.cleaner_bank_accounts FOR SELECT TO authenticated
USING (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Admins manage cleaner bank accounts" ON public.cleaner_bank_accounts;
CREATE POLICY "Admins manage cleaner bank accounts"
ON public.cleaner_bank_accounts FOR ALL TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));

REVOKE ALL ON public.cleaner_bank_accounts FROM PUBLIC, anon;
GRANT SELECT ON public.cleaner_bank_accounts TO authenticated;
GRANT ALL ON public.cleaner_bank_accounts TO service_role;

CREATE OR REPLACE FUNCTION public.submit_my_bank_details(
  p_account_holder_name text,
  p_sort_code text,
  p_account_number text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cleaner_id uuid;
  v_holder text := btrim(p_account_holder_name);
  v_sort text := regexp_replace(coalesce(p_sort_code, ''), '[^0-9]', '', 'g');
  v_account text := regexp_replace(coalesce(p_account_number, ''), '[^0-9]', '', 'g');
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT id INTO v_cleaner_id FROM public.cleaner_profiles WHERE user_id = auth.uid();
  IF v_cleaner_id IS NULL THEN RAISE EXCEPTION 'Cleaner profile not found'; END IF;
  IF length(v_holder) < 2 THEN RAISE EXCEPTION 'Enter the account holder name'; END IF;
  IF v_sort !~ '^[0-9]{6}$' THEN RAISE EXCEPTION 'Sort code must contain 6 digits'; END IF;
  IF v_account !~ '^[0-9]{8}$' THEN RAISE EXCEPTION 'Account number must contain 8 digits'; END IF;

  INSERT INTO public.cleaner_bank_accounts
    (cleaner_id, account_holder_name, sort_code, account_number, submitted_at, reviewed_at, reviewed_by, updated_at)
  VALUES
    (v_cleaner_id, v_holder, v_sort, v_account, now(), NULL, NULL, now())
  ON CONFLICT (cleaner_id) DO UPDATE SET
    account_holder_name = EXCLUDED.account_holder_name,
    sort_code = EXCLUDED.sort_code,
    account_number = EXCLUDED.account_number,
    submitted_at = now(), reviewed_at = NULL, reviewed_by = NULL, updated_at = now();

  UPDATE public.cleaner_profiles SET
    bank_account_holder = v_holder,
    bank_sort_code_last2 = right(v_sort, 2),
    bank_account_last4 = right(v_account, 4),
    bank_details_status = 'pending_review',
    payout_status = 'pending',
    updated_at = now()
  WHERE id = v_cleaner_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_cleaner_bank_details(
  p_cleaner_id uuid,
  p_decision text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_decision NOT IN ('verified', 'rejected') THEN RAISE EXCEPTION 'Decision must be verified or rejected'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.cleaner_bank_accounts WHERE cleaner_id = p_cleaner_id) THEN
    RAISE EXCEPTION 'Bank details not found';
  END IF;
  UPDATE public.cleaner_bank_accounts SET reviewed_at = now(), reviewed_by = auth.uid(), updated_at = now()
  WHERE cleaner_id = p_cleaner_id;
  UPDATE public.cleaner_profiles SET
    bank_details_status = p_decision,
    payout_status = CASE WHEN p_decision = 'verified' THEN 'ready' ELSE 'restricted' END,
    updated_at = now()
  WHERE id = p_cleaner_id;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_my_bank_details(text,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_cleaner_bank_details(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_my_bank_details(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_cleaner_bank_details(uuid,text) TO authenticated;

NOTIFY pgrst, 'reload schema';