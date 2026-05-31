-- Migration to register the separate free_trial_welcome_rdm configuration key
INSERT INTO public.rdm_config (key, value, description)
VALUES (
  'free_trial_welcome_rdm',
  100,
  'RDM welcome bonus copy displayed to the student in the free trial activation wizard welcome screen.'
)
ON CONFLICT (key) DO NOTHING;
