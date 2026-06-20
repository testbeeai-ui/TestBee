-- Admin visibility + triage for platform feedback (Settings survey)
ALTER TABLE public.platform_feedback_submissions
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'settings_feedback',
  ADD COLUMN IF NOT EXISTS user_email text,
  ADD COLUMN IF NOT EXISTS user_display_name text,
  ADD COLUMN IF NOT EXISTS admin_status text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS admin_note text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

ALTER TABLE public.platform_feedback_submissions
  DROP CONSTRAINT IF EXISTS platform_feedback_submissions_admin_status_check;

ALTER TABLE public.platform_feedback_submissions
  ADD CONSTRAINT platform_feedback_submissions_admin_status_check
  CHECK (admin_status IN ('new', 'reviewed', 'resolved'));

CREATE INDEX IF NOT EXISTS platform_feedback_submissions_admin_status_idx
  ON public.platform_feedback_submissions (admin_status, created_at DESC);

CREATE INDEX IF NOT EXISTS platform_feedback_submissions_has_issue_idx
  ON public.platform_feedback_submissions (created_at DESC)
  WHERE issue_category IS NOT NULL OR length(trim(issue_text)) > 0;

COMMENT ON COLUMN public.platform_feedback_submissions.source IS
  'Form origin: settings_feedback, contact, etc.';
COMMENT ON COLUMN public.platform_feedback_submissions.admin_status IS
  'Admin triage: new | reviewed | resolved';
