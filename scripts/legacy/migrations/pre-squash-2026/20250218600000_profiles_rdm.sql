-- Persist RDM in profiles for server-side deduction (live join, schedule).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rdm integer NOT NULL DEFAULT 100;

COMMENT ON COLUMN public.profiles.rdm IS 'User RDM balance; deducted for live join (5) and schedule (10).';
