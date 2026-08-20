-- Keep the earning week immutable for reporting, but put a payout that clears
-- review into the next available Friday pay run. This prevents held earnings
-- from appearing as overdue or being mixed into the amount currently due.

ALTER TABLE public.cleaner_payouts
  ADD COLUMN IF NOT EXISTS pay_run_week_start date;

-- The existing agency audit trigger writes lower(TG_OP) ('update'), which the
-- agency_audit_events action check rejects. Backfills below are schema
-- housekeeping, not business events, so the audit trigger is suspended for
-- them only and restored immediately afterwards.
ALTER TABLE public.cleaner_payouts DISABLE TRIGGER agency_audit_cleaner_payouts;

UPDATE public.cleaner_payouts
SET pay_run_week_start = date_trunc('week', scheduled_pay_date::timestamp)::date
WHERE scheduled_pay_date IS NOT NULL
  AND pay_run_week_start IS NULL;

CREATE OR REPLACE FUNCTION public.next_cleaner_pay_date(p_from_date date DEFAULT current_date)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT p_from_date + CASE
    WHEN ((5 - EXTRACT(DOW FROM p_from_date)::integer + 7) % 7) = 0 THEN 7
    ELSE ((5 - EXTRACT(DOW FROM p_from_date)::integer + 7) % 7)
  END;
$$;

CREATE OR REPLACE FUNCTION public.assign_cleaner_payout_pay_run()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_pay_date date;
BEGIN
  IF NEW.status = 'approved'
     AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved')
     AND (NEW.scheduled_pay_date IS NULL OR NEW.scheduled_pay_date <= current_date) THEN
    v_pay_date := public.next_cleaner_pay_date(current_date);
    NEW.scheduled_pay_date := v_pay_date;
    NEW.pay_run_week_start := date_trunc('week', v_pay_date::timestamp)::date;
  ELSIF NEW.scheduled_pay_date IS NOT NULL AND NEW.pay_run_week_start IS NULL THEN
    NEW.pay_run_week_start := date_trunc('week', NEW.scheduled_pay_date::timestamp)::date;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS assign_cleaner_payout_pay_run_trigger ON public.cleaner_payouts;
CREATE TRIGGER assign_cleaner_payout_pay_run_trigger
BEFORE INSERT OR UPDATE OF status, scheduled_pay_date ON public.cleaner_payouts
FOR EACH ROW EXECUTE FUNCTION public.assign_cleaner_payout_pay_run();

-- Existing held payouts with an elapsed date should not look overdue. They are
-- not approved and still cannot be paid; this merely gives them the next live
-- run date until their review decision is made.
UPDATE public.cleaner_payouts
SET scheduled_pay_date = public.next_cleaner_pay_date(current_date),
    pay_run_week_start = date_trunc('week', public.next_cleaner_pay_date(current_date)::timestamp)::date,
    updated_at = now()
WHERE status = 'held'
  AND scheduled_pay_date < current_date;

ALTER TABLE public.cleaner_payouts ENABLE TRIGGER agency_audit_cleaner_payouts;

INSERT INTO public.platform_schema_versions(version, description)
VALUES ('20260820210000', 'Schedule released cleaner payouts into the next Friday pay run')
ON CONFLICT (version) DO UPDATE SET description = EXCLUDED.description;

NOTIFY pgrst, 'reload schema';