-- Teacher Gyan++ section/comment reward: 5 RDM (was 30 in earlier seed).
INSERT INTO public.rdm_config (key, value, description)
VALUES
  ('gyan_teacher_answer_rdm', 5, 'Gyan++ · Teacher section reward shown in feed/wall UI')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();
