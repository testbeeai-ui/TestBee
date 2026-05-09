-- Dashboard study streak badge copy keys (DB-backed admin-editable values).

INSERT INTO public.rdm_config (key, value, description) VALUES
  ('study_streak_bonus_week_number', 3, 'Dashboard · Study streak bonus week label (UI copy only; no payout)'),
  ('study_streak_bonus_rdm', 150, 'Dashboard · Study streak bonus amount label in RDM (UI copy only; no payout)')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;

