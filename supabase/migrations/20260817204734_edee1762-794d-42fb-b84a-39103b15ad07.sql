-- Make every booked add-on a required cleaner checklist item.

CREATE OR REPLACE FUNCTION public.seed_default_job_checklist()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.job_checklist_items(job_id, title, position)
  VALUES
    (NEW.id, 'Confirm access and review job instructions', 10),
    (NEW.id, 'Complete agreed cleaning tasks', 20),
    (NEW.id, 'Check all cleaned areas and surfaces', 30),
    (NEW.id, 'Remove waste and leave property secure', 40),
    (NEW.id, 'Upload before and after evidence', 50)
  ON CONFLICT DO NOTHING;

  INSERT INTO public.job_checklist_items(job_id, title, position)
  SELECT
    NEW.id,
    left(
      'Complete add-on: ' || qa.addon_name ||
      CASE WHEN qa.quantity > 1 THEN ' × ' || qa.quantity::text ELSE '' END,
      200
    ),
    100 + (row_number() OVER (ORDER BY qa.created_at, qa.id)::integer * 10)
  FROM public.quote_addons qa
  WHERE qa.quote_id = NEW.accepted_quote_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- Bring active jobs created before this migration into the same workflow.
INSERT INTO public.job_checklist_items(job_id, title, position)
SELECT
  j.id,
  left(
    'Complete add-on: ' || qa.addon_name ||
    CASE WHEN qa.quantity > 1 THEN ' × ' || qa.quantity::text ELSE '' END,
    200
  ),
  100 + (row_number() OVER (PARTITION BY j.id ORDER BY qa.created_at, qa.id)::integer * 10)
FROM public.jobs j
JOIN public.quote_addons qa ON qa.quote_id = j.accepted_quote_id
WHERE j.status IN ('awaiting_assignment', 'offered', 'assigned', 'in_progress')
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';