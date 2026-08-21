-- Audited service-request pipeline overrides for the admin Kanban.
CREATE TABLE IF NOT EXISTS public.service_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_request_id uuid NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES auth.users(id),
  event_type text NOT NULL,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_request_events_request_idx ON public.service_request_events(service_request_id,created_at DESC);
ALTER TABLE public.service_request_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins manage service request events" ON public.service_request_events;
CREATE POLICY "Admins manage service request events" ON public.service_request_events FOR ALL TO authenticated
USING(public.is_admin(auth.uid())) WITH CHECK(public.is_admin(auth.uid()));
REVOKE ALL ON public.service_request_events FROM PUBLIC,anon;
GRANT SELECT,INSERT ON public.service_request_events TO authenticated;
GRANT ALL ON public.service_request_events TO service_role;

CREATE OR REPLACE FUNCTION public.log_service_request_status_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.service_request_events(service_request_id,actor_user_id,event_type,details)
    VALUES(NEW.id,auth.uid(),'status_changed',jsonb_build_object('from',OLD.status,'to',NEW.status));
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS log_service_request_status_change_trigger ON public.service_requests;
CREATE TRIGGER log_service_request_status_change_trigger AFTER UPDATE OF status ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.log_service_request_status_change();

CREATE OR REPLACE FUNCTION public.admin_override_service_request_stage(
  p_request_id uuid,p_target_status text,p_reason text
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_current text;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Admin access required'; END IF;
  IF length(btrim(coalesce(p_reason,'')))<5 THEN RAISE EXCEPTION 'An audit reason of at least 5 characters is required'; END IF;
  SELECT status INTO v_current FROM public.service_requests WHERE id=p_request_id FOR UPDATE;
  IF v_current IS NULL THEN RAISE EXCEPTION 'Cleaning request not found'; END IF;
  IF NOT ((v_current='new' AND p_target_status IN ('contacted','qualified','declined','lost','cancelled')) OR
          (v_current='contacted' AND p_target_status IN ('new','qualified','declined','lost','cancelled')) OR
          (v_current='qualified' AND p_target_status IN ('contacted','quoted','declined','lost','cancelled')) OR
          (v_current='quoted' AND p_target_status IN ('qualified','declined','lost','cancelled')) OR
          (v_current IN ('declined','lost') AND p_target_status IN ('contacted','qualified','cancelled')) OR
          (v_current='cancelled' AND p_target_status='contacted')) THEN
    RAISE EXCEPTION 'Invalid request transition from % to %',v_current,p_target_status;
  END IF;
  IF p_target_status='accepted' THEN RAISE EXCEPTION 'Use quote acceptance and job creation to accept a request'; END IF;
  UPDATE public.service_requests SET status=p_target_status,updated_at=now(),
    contacted_at=CASE WHEN p_target_status='contacted' THEN coalesce(contacted_at,now()) ELSE contacted_at END,
    qualified_at=CASE WHEN p_target_status='qualified' THEN coalesce(qualified_at,now()) ELSE qualified_at END
  WHERE id=p_request_id;
  INSERT INTO public.service_request_events(service_request_id,actor_user_id,event_type,details)
  VALUES(p_request_id,auth.uid(),'admin_stage_override',jsonb_build_object('from',v_current,'to',p_target_status,'reason',left(btrim(p_reason),1000)));
  RETURN true;
END; $$;

REVOKE ALL ON FUNCTION public.admin_override_service_request_stage(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_override_service_request_stage(uuid,text,text) TO authenticated;
INSERT INTO public.platform_schema_versions(version,description) VALUES('20260816233000','Cleaning request Kanban and audited pipeline overrides')
ON CONFLICT(version) DO UPDATE SET description=excluded.description;
NOTIFY pgrst,'reload schema';
