-- Two-step waitlist: quick signup (email + phone) then optional ambassador application

ALTER TABLE public.waitlist_submissions
  ADD COLUMN IF NOT EXISTS signup_tier text NOT NULL DEFAULT 'ambassador'
    CHECK (signup_tier IN ('waitlist', 'ambassador'));

ALTER TABLE public.waitlist_submissions
  ADD COLUMN IF NOT EXISTS ambassador_applied_at timestamptz;

-- Relax NOT NULL for quick waitlist tier rows
ALTER TABLE public.waitlist_submissions
  ALTER COLUMN role DROP NOT NULL;

ALTER TABLE public.waitlist_submissions
  ALTER COLUMN first_name DROP NOT NULL;

ALTER TABLE public.waitlist_submissions
  ALTER COLUMN last_name DROP NOT NULL;

ALTER TABLE public.waitlist_submissions
  ALTER COLUMN city DROP NOT NULL;

ALTER TABLE public.waitlist_submissions
  ALTER COLUMN state DROP NOT NULL;

-- Drop and recreate role check to allow NULL
ALTER TABLE public.waitlist_submissions
  DROP CONSTRAINT IF EXISTS waitlist_submissions_role_check;

ALTER TABLE public.waitlist_submissions
  ADD CONSTRAINT waitlist_submissions_role_check
  CHECK (role IS NULL OR role IN ('student', 'teacher', 'parent', 'other'));

CREATE INDEX IF NOT EXISTS waitlist_submissions_signup_tier_idx
  ON public.waitlist_submissions (signup_tier, created_at DESC);

CREATE INDEX IF NOT EXISTS waitlist_submissions_email_idx
  ON public.waitlist_submissions (lower(email));

COMMENT ON COLUMN public.waitlist_submissions.signup_tier IS
  'waitlist = Step 1 only (email + phone); ambassador = full application submitted';
