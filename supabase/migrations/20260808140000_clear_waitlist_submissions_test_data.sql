-- Clear test waitlist rows before sequential ID rollout (EB-2026-200+)
DELETE FROM public.waitlist_submissions;
