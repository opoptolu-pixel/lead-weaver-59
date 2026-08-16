-- Existing Cleanda users remain business marketplace accounts. New providers
-- explicitly choose between a business account and a personal cleaner account.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'business'
CHECK (account_type IN ('business', 'personal_cleaner'));

CREATE INDEX IF NOT EXISTS idx_profiles_account_type ON public.profiles(account_type);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, account_type)
  VALUES (
    NEW.id,
    CASE
      WHEN NEW.raw_user_meta_data ->> 'account_type' = 'personal_cleaner' THEN 'personal_cleaner'
      ELSE 'business'
    END
  );
  RETURN NEW;
END;
$$;
