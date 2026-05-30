-- Full mock attempt history: every finished test, all retakes, PCM subject breakdown.

CREATE TABLE IF NOT EXISTS public.mock_test_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  attempt_key text NOT NULL,
  session_kind text NOT NULL CHECK (
    session_kind IN ('mock_paper', 'past_paper', 'quick_mock', 'mcq_chapter')
  ),
  catalog_paper_id uuid REFERENCES public.mock_papers (id) ON DELETE SET NULL,
  past_paper_id uuid REFERENCES public.past_papers (id) ON DELETE SET NULL,
  paper_slug text,
  paper_title text NOT NULL,
  score_percent smallint,
  correct_count integer,
  total_questions integer,
  subject_breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mock_test_attempts_user_attempt_key UNIQUE (user_id, attempt_key),
  CONSTRAINT mock_test_attempts_paper_ref_check CHECK (
    (session_kind = 'quick_mock' AND catalog_paper_id IS NULL AND past_paper_id IS NULL)
    OR (session_kind = 'past_paper' AND past_paper_id IS NOT NULL)
    OR (session_kind IN ('mock_paper', 'mcq_chapter') AND catalog_paper_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_mock_test_attempts_user_created
  ON public.mock_test_attempts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mock_test_attempts_user_catalog
  ON public.mock_test_attempts (user_id, catalog_paper_id, created_at DESC)
  WHERE catalog_paper_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mock_test_attempts_user_past
  ON public.mock_test_attempts (user_id, past_paper_id, created_at DESC)
  WHERE past_paper_id IS NOT NULL;

COMMENT ON TABLE public.mock_test_attempts IS
  'Student mock attempt log: every completed session with overall score and per-subject breakdown; one row per user per attempt_key.';

ALTER TABLE public.mock_test_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mock_test_attempts_select_own" ON public.mock_test_attempts;
CREATE POLICY "mock_test_attempts_select_own"
  ON public.mock_test_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.record_mock_test_attempt(
  p_attempt_key text,
  p_session_kind text,
  p_catalog_paper_id uuid,
  p_past_paper_id uuid,
  p_paper_slug text,
  p_paper_title text,
  p_score_percent smallint,
  p_correct_count integer,
  p_total_questions integer,
  p_subject_breakdown jsonb,
  p_duration_seconds integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF p_attempt_key IS NULL OR length(trim(p_attempt_key)) < 3 OR length(trim(p_attempt_key)) > 200 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_attempt_key');
  END IF;

  IF p_session_kind NOT IN ('mock_paper', 'past_paper', 'quick_mock', 'mcq_chapter') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_session_kind');
  END IF;

  IF p_total_questions IS NULL OR p_total_questions <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_total');
  END IF;

  INSERT INTO public.mock_test_attempts (
    user_id,
    attempt_key,
    session_kind,
    catalog_paper_id,
    past_paper_id,
    paper_slug,
    paper_title,
    score_percent,
    correct_count,
    total_questions,
    subject_breakdown,
    duration_seconds
  )
  VALUES (
    v_uid,
    trim(p_attempt_key),
    p_session_kind,
    p_catalog_paper_id,
    p_past_paper_id,
    NULLIF(trim(COALESCE(p_paper_slug, '')), ''),
    COALESCE(NULLIF(trim(p_paper_title), ''), 'Mock session'),
    p_score_percent,
    p_correct_count,
    p_total_questions,
    COALESCE(p_subject_breakdown, '[]'::jsonb),
    p_duration_seconds
  )
  ON CONFLICT (user_id, attempt_key) DO UPDATE SET
    session_kind = EXCLUDED.session_kind,
    catalog_paper_id = EXCLUDED.catalog_paper_id,
    past_paper_id = EXCLUDED.past_paper_id,
    paper_slug = EXCLUDED.paper_slug,
    paper_title = EXCLUDED.paper_title,
    score_percent = EXCLUDED.score_percent,
    correct_count = EXCLUDED.correct_count,
    total_questions = EXCLUDED.total_questions,
    subject_breakdown = EXCLUDED.subject_breakdown,
    duration_seconds = EXCLUDED.duration_seconds
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

COMMENT ON FUNCTION public.record_mock_test_attempt IS
  'Authenticated: upsert one finished mock session (overall + subject_breakdown json array).';

REVOKE ALL ON FUNCTION public.record_mock_test_attempt(
  text, text, uuid, uuid, text, text, smallint, integer, integer, jsonb, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_mock_test_attempt(
  text, text, uuid, uuid, text, text, smallint, integer, integer, jsonb, integer
) TO authenticated;
