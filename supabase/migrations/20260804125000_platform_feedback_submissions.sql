-- Investor feedback survey submissions (Settings → Feedback form)
CREATE TABLE IF NOT EXISTS public.platform_feedback_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  role text NOT NULL CHECK (role IN ('student', 'teacher', 'parent')),
  overall_rating smallint NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  extra_value text,
  specific_ratings jsonb NOT NULL DEFAULT '{}'::jsonb,
  nps smallint CHECK (nps IS NULL OR (nps >= 0 AND nps <= 10)),
  issue_category text,
  issue_text text NOT NULL DEFAULT '',
  suggestion text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_feedback_submissions_user_id_idx
  ON public.platform_feedback_submissions (user_id);

CREATE INDEX IF NOT EXISTS platform_feedback_submissions_created_at_idx
  ON public.platform_feedback_submissions (created_at DESC);

ALTER TABLE public.platform_feedback_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_feedback_submissions_insert_own
  ON public.platform_feedback_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY platform_feedback_submissions_select_own
  ON public.platform_feedback_submissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.platform_feedback_submissions IS
  'Structured product feedback from Settings survey (investor form spec).';
