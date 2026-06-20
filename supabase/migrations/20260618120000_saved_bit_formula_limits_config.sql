-- Admin-editable save limits for quiz bits and numerals (saved formulas).
-- Consumed via getPlanLimits() + /api/user/saved-content checkCap.

INSERT INTO public.rdm_config (key, value, description) VALUES
  ('free_saved_bit_limit', 20, 'Free plan: max quiz questions saved from Topic Quiz to Revision'),
  ('free_trial_saved_bit_limit', 20, 'Free Trial plan: max quiz questions saved from Topic Quiz to Revision'),
  ('starter_saved_bit_limit', 200, 'Starter plan: max quiz questions saved from Topic Quiz to Revision'),
  ('pro_saved_bit_limit', -1, 'Pro plan: max quiz questions saved from Topic Quiz (-1 = unlimited)'),

  ('free_saved_formula_limit', 20, 'Free plan: max formula practice sets saved from Numerals to Revision'),
  ('free_trial_saved_formula_limit', 20, 'Free Trial plan: max formula practice sets saved from Numerals to Revision'),
  ('starter_saved_formula_limit', 200, 'Starter plan: max formula practice sets saved from Numerals to Revision'),
  ('pro_saved_formula_limit', -1, 'Pro plan: max formula practice sets saved from Numerals (-1 = unlimited)')
ON CONFLICT (key) DO NOTHING;
