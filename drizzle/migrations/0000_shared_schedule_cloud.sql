CREATE TABLE public.shared_schedule (
 id text PRIMARY KEY CHECK (id = 'main'),
 revision bigint NOT NULL DEFAULT 0,
 payload jsonb NOT NULL,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.shared_schedule TO anon, authenticated;
GRANT ALL ON public.shared_schedule TO service_role;
ALTER TABLE public.shared_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Open schedule read requested by owner" ON public.shared_schedule FOR SELECT TO anon, authenticated USING (id = 'main');
CREATE POLICY "Open schedule edit requested by owner" ON public.shared_schedule FOR UPDATE TO anon, authenticated USING (id = 'main') WITH CHECK (id = 'main');
CREATE FUNCTION public.bump_schedule_revision() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 NEW.revision := OLD.revision + 1;
 NEW.updated_at := now();
 RETURN NEW;
END;
$$;
CREATE TRIGGER schedule_revision BEFORE UPDATE ON public.shared_schedule FOR EACH ROW EXECUTE FUNCTION public.bump_schedule_revision();
ALTER PUBLICATION supabase_realtime ADD TABLE public.shared_schedule;