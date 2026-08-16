-- Managed-agency quality review, complaints and issue resolution workspace.

CREATE TABLE IF NOT EXISTS public.job_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  source text NOT NULL CHECK (source IN ('customer_complaint','quality_review','cleaner_report','admin')),
  category text NOT NULL CHECK (category IN ('cleaning_quality','damage','access','lateness','conduct','missing_item','other')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','awaiting_customer','awaiting_cleaner','rework_required','resolved','closed')),
  summary text NOT NULL CHECK (length(btrim(summary)) BETWEEN 3 AND 160),
  description text,
  resolution_notes text,
  assigned_to uuid REFERENCES auth.users(id),
  reported_by uuid REFERENCES auth.users(id),
  due_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.job_issue_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id uuid NOT NULL REFERENCES public.job_issues(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_issues_job_id_idx ON public.job_issues(job_id);
CREATE INDEX IF NOT EXISTS job_issues_queue_idx ON public.job_issues(status,severity,created_at DESC);
CREATE INDEX IF NOT EXISTS job_issue_events_issue_id_idx ON public.job_issue_events(issue_id,created_at DESC);

ALTER TABLE public.job_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_issue_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage agency job issues" ON public.job_issues;
CREATE POLICY "Admins manage agency job issues" ON public.job_issues FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Admins view issue audit events" ON public.job_issue_events;
CREATE POLICY "Admins view issue audit events" ON public.job_issue_events FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.create_job_issue(
  p_job_id uuid, p_source text, p_category text, p_severity text,
  p_summary text, p_description text DEFAULT NULL, p_due_at timestamptz DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_issue_id uuid; v_previous_status text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_source NOT IN ('customer_complaint','quality_review','cleaner_report','admin') THEN RAISE EXCEPTION 'Invalid issue source'; END IF;
  IF p_category NOT IN ('cleaning_quality','damage','access','lateness','conduct','missing_item','other') THEN RAISE EXCEPTION 'Invalid issue category'; END IF;
  IF p_severity NOT IN ('low','medium','high','critical') THEN RAISE EXCEPTION 'Invalid issue severity'; END IF;
  SELECT status INTO v_previous_status FROM public.jobs WHERE id=p_job_id FOR UPDATE;
  IF v_previous_status IS NULL THEN RAISE EXCEPTION 'Job not found'; END IF;
  INSERT INTO public.job_issues(job_id,source,category,severity,summary,description,reported_by,due_at)
  VALUES(p_job_id,p_source,p_category,p_severity,btrim(p_summary),nullif(btrim(p_description),''),auth.uid(),p_due_at)
  RETURNING id INTO v_issue_id;
  UPDATE public.jobs SET status='issue',quality_review_status='issue',updated_at=now() WHERE id=p_job_id AND status<>'cancelled';
  UPDATE public.cleaner_payouts SET status='held',approved_at=NULL,held_reason='Job issue under investigation',updated_at=now()
    WHERE job_id=p_job_id AND status NOT IN ('paid','cancelled');
  INSERT INTO public.job_issue_events(issue_id,actor_user_id,event_type,details)
    VALUES(v_issue_id,auth.uid(),'created',jsonb_build_object('previous_job_status',v_previous_status));
  INSERT INTO public.job_events(job_id,actor_user_id,event_type,details)
    VALUES(p_job_id,auth.uid(),'issue_created',jsonb_build_object('issue_id',v_issue_id,'source',p_source,'severity',p_severity));
  RETURN v_issue_id;
END $$;

CREATE OR REPLACE FUNCTION public.update_job_issue(
  p_issue_id uuid, p_status text, p_resolution_notes text DEFAULT NULL
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job_id uuid; v_old_status text; v_bank_status text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF p_status NOT IN ('open','investigating','awaiting_customer','awaiting_cleaner','rework_required','resolved','closed') THEN RAISE EXCEPTION 'Invalid issue status'; END IF;
  SELECT job_id,status INTO v_job_id,v_old_status FROM public.job_issues WHERE id=p_issue_id FOR UPDATE;
  IF v_job_id IS NULL THEN RAISE EXCEPTION 'Issue not found'; END IF;
  IF p_status IN ('resolved','closed') AND length(btrim(coalesce(p_resolution_notes,'')))<5 THEN RAISE EXCEPTION 'Resolution notes are required'; END IF;
  UPDATE public.job_issues SET status=p_status,resolution_notes=COALESCE(nullif(btrim(p_resolution_notes),''),resolution_notes),
    resolved_at=CASE WHEN p_status IN ('resolved','closed') THEN COALESCE(resolved_at,now()) ELSE NULL END,
    closed_at=CASE WHEN p_status='closed' THEN now() ELSE NULL END,updated_at=now() WHERE id=p_issue_id;
  INSERT INTO public.job_issue_events(issue_id,actor_user_id,event_type,details)
    VALUES(p_issue_id,auth.uid(),'status_changed',jsonb_build_object('from',v_old_status,'to',p_status,'resolution_notes',left(p_resolution_notes,2000)));
  IF p_status='rework_required' THEN
    UPDATE public.jobs SET status='in_progress',quality_review_status='rework_required',quality_review_notes=left(p_resolution_notes,2000),updated_at=now() WHERE id=v_job_id;
    UPDATE public.cleaner_payouts SET status='held',approved_at=NULL,held_reason='Rework required before payment',updated_at=now() WHERE job_id=v_job_id AND status NOT IN ('paid','cancelled');
  ELSIF p_status IN ('resolved','closed') AND NOT EXISTS(SELECT 1 FROM public.job_issues WHERE job_id=v_job_id AND id<>p_issue_id AND status NOT IN ('resolved','closed')) THEN
    UPDATE public.jobs SET status='quality_check',quality_review_status='pending',quality_review_notes=left(p_resolution_notes,2000),updated_at=now() WHERE id=v_job_id AND status='issue';
    UPDATE public.cleaner_payouts SET status='held',approved_at=NULL,held_reason='Awaiting Cleanda quality review',updated_at=now() WHERE job_id=v_job_id AND status NOT IN ('paid','cancelled');
  ELSIF p_status NOT IN ('resolved','closed') THEN
    UPDATE public.jobs SET status='issue',quality_review_status='issue',updated_at=now() WHERE id=v_job_id AND status<>'cancelled';
  END IF;
  INSERT INTO public.job_events(job_id,actor_user_id,event_type,details)
    VALUES(v_job_id,auth.uid(),'issue_status_changed',jsonb_build_object('issue_id',p_issue_id,'from',v_old_status,'to',p_status));
  RETURN true;
END $$;

REVOKE ALL ON public.job_issues,public.job_issue_events FROM anon;
GRANT SELECT,INSERT,UPDATE ON public.job_issues TO authenticated;
GRANT SELECT ON public.job_issue_events TO authenticated;
REVOKE ALL ON FUNCTION public.create_job_issue(uuid,text,text,text,text,text,timestamptz) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.update_job_issue(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_job_issue(uuid,text,text,text,text,text,timestamptz),public.update_job_issue(uuid,text,text) TO authenticated;

INSERT INTO public.platform_schema_versions(version,description) VALUES('20260816240000','Managed quality and issues workspace')
ON CONFLICT(version) DO UPDATE SET description=excluded.description;
NOTIFY pgrst,'reload schema';
