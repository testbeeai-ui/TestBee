-- Free-tier teachers may publish assignments (monthly cap); charge per publish via teacher_create_assignment_rdm.

INSERT INTO public.rdm_config (key, value)
VALUES ('teacher_free_assignments_per_month', 10)
ON CONFLICT (key) DO NOTHING;
