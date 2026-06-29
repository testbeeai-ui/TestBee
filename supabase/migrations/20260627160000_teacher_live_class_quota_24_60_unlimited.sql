-- Teacher live-class monthly quotas: Free 24, Starter 60, Pro unlimited (9999).

INSERT INTO public.rdm_config (key, value)
VALUES
  ('teacher_free_live_classes_per_month', 24),
  ('teacher_starter_live_classes_per_month', 60),
  ('teacher_pro_live_classes_per_month', 9999)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
