-- Cleaner field-work execution: clocking, checklists and audited completion.

CREATE TABLE IF NOT EXISTS public.job_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  assignment_id uuid NOT NULL REFERENCES public.job_assignments(id) ON DELETE CASCADE,
  cleaner_id uuid NOT NULL REFERENCES public.cleaner_profiles(id), clocked_in_at timestamptz NOT NULL DEFAULT now(),
  clocked_out_at timestamptz, corrected_minutes integer CHECK (corrected_minutes IS NULL OR corrected_minutes >= 0),
  correction_reason text, corrected_by uuid REFERENCES auth.users(id), corrected_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (clocked_out_at IS NULL OR clocked_out_at >= clocked_in_at)
);
CREATE UNIQUE INDEX IF NOT EXISTS job_time_entries_one_open_idx ON public.job_time_entries(assignment_id) WHERE clocked_out_at IS NULL;
CREATE INDEX IF NOT EXISTS job_time_entries_job_idx ON public.job_time_entries(job_id, clocked_in_at);

CREATE TABLE IF NOT EXISTS public.job_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200), is_required boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0, completed_at timestamptz, completed_by uuid REFERENCES public.cleaner_profiles(id),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(job_id, title)
);
CREATE INDEX IF NOT EXISTS job_checklist_items_job_idx ON public.job_checklist_items(job_id, position);

ALTER TABLE public.job_time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_checklist_items ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.job_time_entries, public.job_checklist_items TO authenticated;
GRANT ALL ON public.job_time_entries, public.job_checklist_items TO service_role;
DROP POLICY IF EXISTS "Admins manage job time entries" ON public.job_time_entries;
CREATE POLICY "Admins manage job time entries" ON public.job_time_entries FOR ALL TO authenticated USING(public.is_admin(auth.uid())) WITH CHECK(public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Cleaners view own time entries" ON public.job_time_entries;
CREATE POLICY "Cleaners view own time entries" ON public.job_time_entries FOR SELECT TO authenticated USING(cleaner_id IN (SELECT id FROM public.cleaner_profiles WHERE user_id=auth.uid()));
DROP POLICY IF EXISTS "Admins manage job checklist" ON public.job_checklist_items;
CREATE POLICY "Admins manage job checklist" ON public.job_checklist_items FOR ALL TO authenticated USING(public.is_admin(auth.uid())) WITH CHECK(public.is_admin(auth.uid()));
DROP POLICY IF EXISTS "Assigned cleaners view checklist" ON public.job_checklist_items;
CREATE POLICY "Assigned cleaners view checklist" ON public.job_checklist_items FOR SELECT TO authenticated USING(job_id IN (SELECT ja.job_id FROM public.job_assignments ja JOIN public.cleaner_profiles cp ON cp.id=ja.cleaner_id WHERE cp.user_id=auth.uid() AND ja.status IN ('accepted','completed')));

CREATE OR REPLACE FUNCTION public.seed_default_job_checklist() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  INSERT INTO public.job_checklist_items(job_id,title,position) VALUES
   (NEW.id,'Confirm access and review job instructions',10),(NEW.id,'Complete agreed cleaning tasks',20),
   (NEW.id,'Check all cleaned areas and surfaces',30),(NEW.id,'Remove waste and leave property secure',40),
   (NEW.id,'Upload before and after evidence',50) ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS seed_default_job_checklist_trigger ON public.jobs;
CREATE TRIGGER seed_default_job_checklist_trigger AFTER INSERT ON public.jobs FOR EACH ROW EXECUTE FUNCTION public.seed_default_job_checklist();
INSERT INTO public.job_checklist_items(job_id,title,position)
SELECT j.id,v.title,v.position FROM public.jobs j CROSS JOIN (VALUES ('Confirm access and review job instructions',10),('Complete agreed cleaning tasks',20),('Check all cleaned areas and surfaces',30),('Remove waste and leave property secure',40),('Upload before and after evidence',50)) v(title,position)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.clock_assigned_job(p_assignment_id uuid, p_action text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job_id uuid; v_cleaner_id uuid; v_entry_id uuid;
BEGIN
 SELECT ja.job_id,ja.cleaner_id INTO v_job_id,v_cleaner_id FROM public.job_assignments ja JOIN public.cleaner_profiles cp ON cp.id=ja.cleaner_id WHERE ja.id=p_assignment_id AND cp.user_id=auth.uid() AND ja.status='accepted';
 IF v_job_id IS NULL THEN RAISE EXCEPTION 'Accepted assignment not found'; END IF;
 IF p_action='in' THEN
   IF EXISTS(SELECT 1 FROM public.job_time_entries WHERE assignment_id=p_assignment_id AND clocked_out_at IS NULL) THEN RAISE EXCEPTION 'Already clocked in'; END IF;
   INSERT INTO public.job_time_entries(job_id,assignment_id,cleaner_id) VALUES(v_job_id,p_assignment_id,v_cleaner_id) RETURNING id INTO v_entry_id;
   UPDATE public.jobs SET status='in_progress',updated_at=now() WHERE id=v_job_id AND status='assigned';
   INSERT INTO public.job_events(job_id,actor_user_id,event_type,details) VALUES(v_job_id,auth.uid(),'cleaner_clocked_in',jsonb_build_object('time_entry_id',v_entry_id));
 ELSIF p_action='out' THEN
   UPDATE public.job_time_entries SET clocked_out_at=now() WHERE assignment_id=p_assignment_id AND clocked_out_at IS NULL RETURNING id INTO v_entry_id;
   IF v_entry_id IS NULL THEN RAISE EXCEPTION 'No open clock-in found'; END IF;
   INSERT INTO public.job_events(job_id,actor_user_id,event_type,details) VALUES(v_job_id,auth.uid(),'cleaner_clocked_out',jsonb_build_object('time_entry_id',v_entry_id));
 ELSE RAISE EXCEPTION 'Invalid clock action'; END IF;
 RETURN jsonb_build_object('success',true,'entry_id',v_entry_id);
END; $$;

CREATE OR REPLACE FUNCTION public.set_job_checklist_item(p_item_id uuid,p_completed boolean) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_cleaner_id uuid;
BEGIN
 SELECT cp.id INTO v_cleaner_id FROM public.job_checklist_items i JOIN public.job_assignments ja ON ja.job_id=i.job_id JOIN public.cleaner_profiles cp ON cp.id=ja.cleaner_id WHERE i.id=p_item_id AND cp.user_id=auth.uid() AND ja.status='accepted';
 IF v_cleaner_id IS NULL THEN RETURN false; END IF;
 UPDATE public.job_checklist_items SET completed_at=CASE WHEN p_completed THEN now() ELSE NULL END,completed_by=CASE WHEN p_completed THEN v_cleaner_id ELSE NULL END WHERE id=p_item_id;
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.correct_job_time_entry(p_entry_id uuid,p_minutes integer,p_reason text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job_id uuid;
BEGIN
 IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
 IF p_minutes<0 OR length(trim(COALESCE(p_reason,'')))<5 THEN RAISE EXCEPTION 'Minutes and an audit reason are required'; END IF;
 UPDATE public.job_time_entries SET corrected_minutes=p_minutes,correction_reason=left(trim(p_reason),1000),corrected_by=auth.uid(),corrected_at=now() WHERE id=p_entry_id RETURNING job_id INTO v_job_id;
 IF v_job_id IS NULL THEN RETURN false; END IF;
 INSERT INTO public.job_events(job_id,actor_user_id,event_type,details) VALUES(v_job_id,auth.uid(),'time_entry_corrected',jsonb_build_object('entry_id',p_entry_id,'minutes',p_minutes,'reason',left(trim(p_reason),1000)));
 RETURN true;
END; $$;

CREATE OR REPLACE FUNCTION public.complete_assigned_job(p_assignment_id uuid,p_completion_notes text DEFAULT NULL) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_job_id uuid; v_cleaner_id uuid;
BEGIN
 SELECT ja.job_id,ja.cleaner_id INTO v_job_id,v_cleaner_id FROM public.job_assignments ja JOIN public.cleaner_profiles cp ON cp.id=ja.cleaner_id JOIN public.jobs j ON j.id=ja.job_id WHERE ja.id=p_assignment_id AND cp.user_id=auth.uid() AND ja.status='accepted' AND j.status IN('assigned','in_progress');
 IF v_job_id IS NULL THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM public.job_time_entries WHERE assignment_id=p_assignment_id AND clocked_out_at IS NULL) THEN RAISE EXCEPTION 'Clock out before submitting the job'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.job_time_entries WHERE assignment_id=p_assignment_id AND clocked_out_at IS NOT NULL) THEN RAISE EXCEPTION 'Clock in and out before submitting the job'; END IF;
 IF EXISTS(SELECT 1 FROM public.job_checklist_items WHERE job_id=v_job_id AND is_required AND completed_at IS NULL) THEN RAISE EXCEPTION 'Complete all required checklist items'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.job_evidence WHERE assignment_id=p_assignment_id AND evidence_type='before') OR NOT EXISTS(SELECT 1 FROM public.job_evidence WHERE assignment_id=p_assignment_id AND evidence_type='after') THEN RAISE EXCEPTION 'Before and after photos are required'; END IF;
 UPDATE public.jobs SET status='quality_check',quality_review_status='pending',cleaner_completion_notes=left(p_completion_notes,2000),completed_at=now(),updated_at=now() WHERE id=v_job_id;
 UPDATE public.job_assignments SET status='completed',updated_at=now() WHERE id=p_assignment_id;
 UPDATE public.cleaner_payouts SET status='held',updated_at=now() WHERE job_id=v_job_id AND cleaner_id=v_cleaner_id AND status='pending';
 INSERT INTO public.job_events(job_id,actor_user_id,event_type,details) VALUES(v_job_id,auth.uid(),'submitted_for_quality_review',jsonb_build_object('assignment_id',p_assignment_id));
 RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.clock_assigned_job(uuid,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.set_job_checklist_item(uuid,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.correct_job_time_entry(uuid,integer,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.complete_assigned_job(uuid,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.clock_assigned_job(uuid,text),public.set_job_checklist_item(uuid,boolean),public.correct_job_time_entry(uuid,integer,text),public.complete_assigned_job(uuid,text) TO authenticated;
INSERT INTO public.platform_schema_versions(version,description) VALUES('20260816180000','Cleaner clocking, checklist and audited completion') ON CONFLICT(version) DO UPDATE SET description=excluded.description;
NOTIFY pgrst,'reload schema';