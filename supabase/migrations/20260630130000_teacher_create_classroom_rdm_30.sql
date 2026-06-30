-- Create classroom charge: 30 RDM (wallet + charge API read from rdm_config).

UPDATE public.rdm_config
SET value = 30
WHERE key = 'teacher_create_classroom_rdm';

INSERT INTO public.rdm_config (key, value, description)
VALUES (
  'teacher_create_classroom_rdm',
  30,
  'Teacher portal · Create classroom (deduct on launch)'
)
ON CONFLICT (key) DO UPDATE
SET value = 30;
