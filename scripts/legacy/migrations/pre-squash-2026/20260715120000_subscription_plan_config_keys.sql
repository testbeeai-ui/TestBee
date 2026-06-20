-- Subscription plan configuration keys (no payment gateway dependency).
-- These values are admin-editable through /admin/subscriptions and consumed at runtime.

INSERT INTO public.rdm_config (key, value, description) VALUES
  ('free_magic_wall_max_active_topics', 2, 'Free plan: max active Magic Wall topics at one time'),
  ('free_magic_wall_monthly_attempts', 2, 'Free plan: new Magic Wall topic selections allowed per month'),
  ('free_trial_magic_wall_max_active_topics', 3, 'Free Trial plan: max active Magic Wall topics at one time'),
  ('free_trial_magic_wall_monthly_attempts', 3, 'Free Trial plan: new Magic Wall topic selections allowed per month'),
  ('starter_magic_wall_max_active_topics', 5, 'Starter plan: max active Magic Wall topics at one time'),
  ('starter_magic_wall_monthly_attempts', 5, 'Starter plan: new Magic Wall topic selections allowed per month'),
  ('pro_magic_wall_max_active_topics', 5, 'Pro plan: max active Magic Wall topics at one time'),
  ('pro_magic_wall_monthly_attempts', -1, 'Pro plan: new Magic Wall topic selections allowed per month (-1 = unlimited)'),

  ('free_gyan_doubts_per_day', 1, 'Free plan: Gyan++ doubt posts per day'),
  ('free_trial_gyan_doubts_per_day', 1, 'Free Trial plan: Gyan++ doubt posts per day'),
  ('starter_gyan_doubts_per_day', 30, 'Starter plan: Gyan++ doubt posts per day'),
  ('pro_gyan_doubts_per_day', -1, 'Pro plan: Gyan++ doubt posts per day (-1 = unlimited)'),

  ('free_lessons_chapter_limit', 2, 'Free plan: lessons chapter access limit'),
  ('free_trial_lessons_chapter_limit', 2, 'Free Trial plan: lessons chapter access limit'),
  ('starter_lessons_chapter_limit', -1, 'Starter plan: lessons chapter access limit (-1 = unlimited)'),
  ('pro_lessons_chapter_limit', -1, 'Pro plan: lessons chapter access limit (-1 = unlimited)'),

  ('free_instacue_card_limit', 20, 'Free plan: InstaCue card limit'),
  ('free_trial_instacue_card_limit', 20, 'Free Trial plan: InstaCue card limit'),
  ('starter_instacue_card_limit', 200, 'Starter plan: InstaCue card limit'),
  ('pro_instacue_card_limit', -1, 'Pro plan: InstaCue card limit (-1 = unlimited)'),

  ('free_mocks_per_month', 3, 'Free plan: mock attempts per month'),
  ('free_trial_mocks_per_month', 3, 'Free Trial plan: mock attempts per month'),
  ('starter_mocks_per_month', 8, 'Starter plan: mock attempts per month'),
  ('pro_mocks_per_month', -1, 'Pro plan: mock attempts per month (-1 = unlimited)'),

  ('free_daily_dose_questions_per_day', 5, 'Free plan: DailyDose questions per day'),
  ('free_trial_daily_dose_questions_per_day', 5, 'Free Trial plan: DailyDose questions per day'),
  ('starter_daily_dose_questions_per_day', 10, 'Starter plan: DailyDose questions per day'),
  ('pro_daily_dose_questions_per_day', -1, 'Pro plan: DailyDose questions per day (-1 = unlimited)'),

  ('free_buddies_limit', 0, 'Free plan: learning buddies limit'),
  ('free_trial_buddies_limit', 0, 'Free Trial plan: learning buddies limit'),
  ('starter_buddies_limit', 2, 'Starter plan: learning buddies limit'),
  ('pro_buddies_limit', -1, 'Pro plan: learning buddies limit (-1 = unlimited)'),

  ('free_study_groups_limit', 0, 'Free plan: study groups limit'),
  ('free_trial_study_groups_limit', 0, 'Free Trial plan: study groups limit'),
  ('starter_study_groups_limit', 2, 'Starter plan: study groups limit'),
  ('pro_study_groups_limit', -1, 'Pro plan: study groups limit (-1 = unlimited)'),

  ('free_rdm_multiplier_pct', 100, 'Free plan: RDM multiplier percent (100 = 1x)'),
  ('free_trial_rdm_multiplier_pct', 100, 'Free Trial plan: RDM multiplier percent (100 = 1x)'),
  ('starter_rdm_multiplier_pct', 150, 'Starter plan: RDM multiplier percent (150 = 1.5x)'),
  ('pro_rdm_multiplier_pct', 200, 'Pro plan: RDM multiplier percent (200 = 2x)')
ON CONFLICT (key) DO NOTHING;

