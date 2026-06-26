-- Teacher subscription tiers (separate from student plan_tier).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS teacher_plan_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS teacher_plan_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS teacher_plan_expires_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_teacher_plan_tier_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_teacher_plan_tier_check
  CHECK (teacher_plan_tier = ANY (ARRAY['free'::text, 'starter'::text, 'pro'::text]));

COMMENT ON COLUMN public.profiles.teacher_plan_tier IS
  'Teacher subscription tier: free | starter | pro. Independent of student plan_tier.';

INSERT INTO public.rdm_config (key, value)
VALUES
  ('teacher_free_live_classes_per_month', 0),
  ('teacher_starter_live_classes_per_month', 4),
  ('teacher_pro_live_classes_per_month', 12),
  ('teacher_starter_assignments_per_month', 10),
  ('teacher_pro_assignments_per_month', 9999),
  ('teacher_class_students_cap', 30)
ON CONFLICT (key) DO NOTHING;
