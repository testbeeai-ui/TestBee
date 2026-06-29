-- Starter: unlimited assignment publishes per month; RDM still charged per publish via teacher_create_assignment_rdm.

INSERT INTO public.rdm_config (key, value)
VALUES ('teacher_starter_assignments_per_month', 9999)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
