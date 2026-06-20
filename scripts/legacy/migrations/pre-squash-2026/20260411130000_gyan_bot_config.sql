-- Gyan++ bot orchestration: singleton config + similarity helper for ProfPi answers.
-- Bot auth users + profiles are created via POST /api/admin/seed-gyan-bot-personas (service role).

CREATE TABLE IF NOT EXISTS public.gyan_bot_config (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  active boolean NOT NULL DEFAULT false,
  interval_minutes integer NOT NULL DEFAULT 10
    CHECK (interval_minutes >= 1 AND interval_minutes <= 1440),
  current_student_index integer NOT NULL DEFAULT 0
    CHECK (current_student_index >= 0 AND current_student_index < 12),
  last_post_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.gyan_bot_config (id, active, interval_minutes, current_student_index)
VALUES (1, false, 10, 0)
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.set_gyan_bot_config_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gyan_bot_config_updated_at ON public.gyan_bot_config;
CREATE TRIGGER trg_gyan_bot_config_updated_at
  BEFORE UPDATE ON public.gyan_bot_config
  FOR EACH ROW
  EXECUTE FUNCTION public.set_gyan_bot_config_updated_at();

ALTER TABLE public.gyan_bot_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gyan_bot_config_select_admin ON public.gyan_bot_config;
DROP POLICY IF EXISTS gyan_bot_config_update_admin ON public.gyan_bot_config;

CREATE POLICY gyan_bot_config_select_admin
  ON public.gyan_bot_config
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE POLICY gyan_bot_config_update_admin
  ON public.gyan_bot_config
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

COMMENT ON TABLE public.gyan_bot_config IS 'Singleton (id=1): automated student persona doubt posting for Gyan++.';

-- Best matching answered doubt for title similarity (pg_trgm).
CREATE OR REPLACE FUNCTION public.find_similar_answered_doubt(
  p_title text,
  p_min_similarity real DEFAULT 0.85
)
RETURNS TABLE (
  source_doubt_id uuid,
  answer_body text,
  similarity_score real
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, da.body, similarity(d.title, trim(coalesce(p_title, '')))::real AS similarity_score
  FROM public.doubts d
  INNER JOIN public.doubt_answers da ON da.doubt_id = d.id AND COALESCE(da.hidden, false) = false
  WHERE trim(coalesce(p_title, '')) <> ''
    AND similarity(d.title, trim(p_title)) >= p_min_similarity
  ORDER BY similarity_score DESC, da.is_accepted DESC, da.upvotes DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.find_similar_answered_doubt(text, real) IS 'Returns top similar doubt that already has at least one visible answer; for ProfPi answer reuse.';

REVOKE ALL ON FUNCTION public.find_similar_answered_doubt(text, real) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_similar_answered_doubt(text, real) TO service_role;
