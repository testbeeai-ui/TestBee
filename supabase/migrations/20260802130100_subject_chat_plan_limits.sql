-- Subject chat (chapter/topic bot): daily message caps + multilingual gate per plan.
-- Version 20260802130100 (20260802120000 was already used by free_trial_14day_message_scenarios).

INSERT INTO public.rdm_config (key, value, description) VALUES
  ('free_subject_chat_messages_per_day', 3, 'Free plan: subject chat user messages per IST day'),
  ('free_trial_subject_chat_messages_per_day', 3, 'Free Trial plan: subject chat user messages per IST day'),
  ('starter_subject_chat_messages_per_day', -1, 'Starter plan: subject chat per day (-1 = unlimited)'),
  ('pro_subject_chat_messages_per_day', -1, 'Pro plan: subject chat per day (-1 = unlimited)'),

  ('free_subject_chat_multilingual', 0, 'Free plan: 0 = English only, 1 = regional languages'),
  ('free_trial_subject_chat_multilingual', 0, 'Free Trial: 0 = English only'),
  ('starter_subject_chat_multilingual', 1, 'Starter: 1 = Hindi/Kannada/Tamil/Telugu'),
  ('pro_subject_chat_multilingual', 1, 'Pro: 1 = multilingual subject chat')
ON CONFLICT (key) DO NOTHING;
