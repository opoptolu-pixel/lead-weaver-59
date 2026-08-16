-- Managed job delivery, evidence, earnings and quality-control workflow.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS quality_review_status text NOT NULL DEFAULT 'not_submitted'
    CHECK (quality_review_status IN ('not_submitted', 'pending', 'approved', 'rework_required', 'issue')),
  ADD COLUMN IF NOT EXISTS quality_review_notes text,
  ADD COLUMN IF NOT EXISTS quality_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS quality_reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS cleaner_completion_notes text;

UPDATE public.jobs SET quality_review_status = 'pending'
WHERE status = 'quality_check' AND quality_review_status = 'not_submitted';

CREATE TABLE IF NOT EXISTS public.job_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.job_assignments(id) ON DELETE CASCADE,
  cleaner_id uuid NOT NULL REFERENCES public.cleaner_profiles(id) ON DELETE CASCADE,
  evidence_type text NOT NULL CHECK (evidence_type IN ('before', 'after')),
  storage_path text NOT NULL UNIQUE,
  file_name text NOT NULL,
  mime_type text NOT NULL CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 5242880),
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS job_evidence_job_type_idx ON public.job_evidence(job_id, evidence_type, created_at);
ALTER TABLE public.job_evidence ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_evidence TO authenticated;
GRANT ALL ON public.job_evidence TO service_role;

DROP POLICY IF EXISTS "Admins manage job evidence" ON public.job_evidence;
DROP POLICY IF EXISTS "Cleaners view own job evidence" ON public.job_evidence;
DROP POLICY IF EXISTS "Accepted cleaners upload job evidence" ON public.job_evidence;
CREATE POLICY "Admins manage job evidence" ON public.job_evidence FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "Cleaners view own job evidence" ON public.job_evidence FOR SELECT TO authenticated
  USING (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Accepted cleaners upload job evidence" ON public.job_evidence FOR INSERT TO authenticated
  WITH CHECK (
    cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.job_assignments ja
      WHERE ja.id = assignment_id AND ja.job_id = job_id AND ja.cleaner_id = cleaner_id
        AND ja.status = 'accepted'
    )
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-evidence', 'job-evidence', false, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "Cleaners upload own job evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Cleaners view own job evidence files" ON storage.objects;
DROP POLICY IF EXISTS "Admins manage job evidence files" ON storage.objects;
CREATE POLICY "Cleaners upload own job evidence files" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'job-evidence'
    AND EXISTS (
      SELECT 1 FROM public.job_assignments ja
      JOIN public.cleaner_profiles cp ON cp.id = ja.cleaner_id
      WHERE ja.job_id::text = (storage.foldername(name))[1]
        AND cp.user_id = auth.uid() AND ja.status = 'accepted'
    )
  );
CREATE POLICY "Cleaners view own job evidence files" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'job-evidence'
    AND EXISTS (
      SELECT 1 FROM public.job_assignments ja
      JOIN public.cleaner_profiles cp ON cp.id = ja.cleaner_id
      WHERE ja.job_id::text = (storage.foldername(name))[1]
        AND cp.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins manage job evidence files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'job-evidence' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'job-evidence' AND public.is_admin(auth.uid()));

CREATE UNIQUE INDEX IF NOT EXISTS cleaner_payouts_job_cleaner_idx
  ON public.cleaner_payouts(job_id, cleaner_id);
DROP POLICY IF EXISTS "Cleaners view own payouts" ON public.cleaner_payouts;
CREATE POLICY "Cleaners view own payouts" ON public.cleaner_payouts FOR SELECT TO authenticated
  USING (cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id = auth.uid()));

-- Backfill payout ledgers for already accepted/completed test assignments.
INSERT INTO public.cleaner_payouts (job_id, cleaner_id, amount_pence, currency, status)
SELECT ja.job_id, ja.cleaner_id, j.cleaner_payout_pence, j.currency,
  CASE WHEN j.status IN ('completed', 'closed') THEN 'approved' ELSE 'pending' END
FROM public.job_assignments ja
JOIN public.jobs j ON j.id = ja.job_id
WHERE ja.status IN ('accepted', 'completed')
ON CONFLICT (job_id, cleaner_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.respond_to_job_assignment(
  p_assignment_id uuid,
  p_response text,
  p_notes text DEFAULT NULL
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_cleaner_id uuid;
BEGIN
  IF p_response NOT IN ('accepted', 'declined') THEN RAISE EXCEPTION 'Invalid assignment response'; END IF;

  UPDATE public.job_assignments ja
  SET status = p_response, responded_at = now(), response_notes = left(p_notes, 1000), updated_at = now()
  FROM public.cleaner_profiles cp
  WHERE ja.id = p_assignment_id AND ja.cleaner_id = cp.id AND cp.user_id = auth.uid() AND ja.status = 'offered'
  RETURNING ja.job_id, ja.cleaner_id INTO v_job_id, v_cleaner_id;

  IF v_job_id IS NULL THEN RETURN false; END IF;

  UPDATE public.jobs SET status = CASE WHEN p_response = 'accepted' THEN 'assigned' ELSE 'awaiting_assignment' END, updated_at = now()
  WHERE id = v_job_id;

  IF p_response = 'accepted' THEN
    INSERT INTO public.cleaner_payouts (job_id, cleaner_id, amount_pence, currency, status)
    SELECT id, v_cleaner_id, cleaner_payout_pence, currency, 'pending' FROM public.jobs WHERE id = v_job_id
    ON CONFLICT (job_id, cleaner_id) DO NOTHING;
  END IF;

  INSERT INTO public.job_events (job_id, actor_user_id, event_type, details)
  VALUES (v_job_id, auth.uid(), 'cleaner_' || p_response, jsonb_build_object('assignment_id', p_assignment_id));
  RETURN true;
END;
$$;

DROP FUNCTION IF EXISTS public.complete_assigned_job(uuid);
CREATE FUNCTION public.complete_assigned_job(p_assignment_id uuid, p_completion_notes text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id uuid;
  v_before_count integer;
  v_after_count integer;
BEGIN
  SELECT ja.job_id INTO v_job_id
  FROM public.job_assignments ja
  JOIN public.cleaner_profiles cp ON cp.id = ja.cleaner_id
  JOIN public.jobs j ON j.id = ja.job_id
  WHERE ja.id = p_assignment_id AND cp.user_id = auth.uid()
    AND ja.status = 'accepted' AND j.status IN ('assigned', 'in_progress');
  IF v_job_id IS NULL THEN RETURN false; END IF;

  SELECT count(*) FILTER (WHERE evidence_type = 'before'), count(*) FILTER (WHERE evidence_type = 'after')
  INTO v_before_count, v_after_count FROM public.job_evidence WHERE assignment_id = p_assignment_id;
  IF v_before_count < 1 OR v_after_count < 1 THEN
    RAISE EXCEPTION 'Upload at least one before and one after photo before completing the job';
  END IF;

  UPDATE public.job_assignments SET status = 'completed', updated_at = now() WHERE id = p_assignment_id;
  UPDATE public.jobs SET status = 'quality_check', quality_review_status = 'pending',
    cleaner_completion_notes = left(p_completion_notes, 2000), completed_at = now(), updated_at = now()
  WHERE id = v_job_id;
  INSERT INTO public.job_events (job_id, actor_user_id, event_type, details)
  VALUES (v_job_id, auth.uid(), 'cleaner_marked_complete', jsonb_build_object('before_photos', v_before_count, 'after_photos', v_after_count));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.complete_assigned_job(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_assigned_job(uuid, text) TO authenticated;

-- A single authoritative readiness check for Lovable preview and release verification.
CREATE TABLE IF NOT EXISTS public.platform_schema_versions (
  version text PRIMARY KEY,
  description text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_schema_versions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.platform_schema_versions TO authenticated;
GRANT ALL ON public.platform_schema_versions TO service_role;
DROP POLICY IF EXISTS "Admins view platform schema versions" ON public.platform_schema_versions;
CREATE POLICY "Admins view platform schema versions" ON public.platform_schema_versions FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
INSERT INTO public.platform_schema_versions(version, description)
VALUES ('20260816153000', 'Cleaner delivery, evidence, earnings and quality review')
ON CONFLICT (version) DO UPDATE SET description = excluded.description;

CREATE OR REPLACE FUNCTION public.get_managed_agency_health()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'ready',
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'quality_review_status')
      AND to_regclass('public.job_evidence') IS NOT NULL
      AND EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'job-evidence'),
    'schema_version', (SELECT max(version) FROM public.platform_schema_versions),
    'quality_column', EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'quality_review_status'),
    'evidence_table', to_regclass('public.job_evidence') IS NOT NULL,
    'evidence_bucket', EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'job-evidence')
  );
$$;
REVOKE ALL ON FUNCTION public.get_managed_agency_health() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_managed_agency_health() TO authenticated;

NOTIFY pgrst, 'reload schema';
