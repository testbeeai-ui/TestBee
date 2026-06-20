-- Student onboarding: exam track (CBSE / JEE Mains / etc.) instead of class 11 vs 12 gate.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS target_exam text;

COMMENT ON COLUMN public.profiles.target_exam IS
  'Student exam focus: cbse | jee_mains | jee_advance | kcet | other. class_level may be null to mean both 11 & 12.';
