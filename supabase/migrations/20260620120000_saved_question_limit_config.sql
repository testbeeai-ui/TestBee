-- Admin-editable save limits for mock/past-paper bookmarks (Revision → Saved Questions).
-- Consumed via getPlanLimits() + /api/user/saved-questions POST cap check.

INSERT INTO public.rdm_config (key, value, description) VALUES
  ('free_saved_question_limit', 20, 'Free plan: max questions bookmarked from Mock / past papers to Revision'),
  ('free_trial_saved_question_limit', 20, 'Free Trial plan: max questions bookmarked from Mock / past papers to Revision'),
  ('starter_saved_question_limit', 200, 'Starter plan: max questions bookmarked from Mock / past papers to Revision'),
  ('pro_saved_question_limit', -1, 'Pro plan: max questions bookmarked from Mock / past papers (-1 = unlimited)')
ON CONFLICT (key) DO NOTHING;
