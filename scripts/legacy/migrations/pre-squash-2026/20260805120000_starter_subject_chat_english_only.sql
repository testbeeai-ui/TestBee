-- Investor rule: Starter = English-only subject chat-bot; Pro = multilingual.

UPDATE public.rdm_config
SET
  value = 0,
  description = 'Starter: 0 = English-only subject chat-bot (multilingual is Pro-only)'
WHERE key = 'starter_subject_chat_multilingual';

UPDATE public.rdm_config
SET description = 'Pro: 1 = multilingual subject chat-bot (Hindi/Kannada/Tamil/Telugu)'
WHERE key = 'pro_subject_chat_multilingual';
