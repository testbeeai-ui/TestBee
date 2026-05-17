-- Teacher portal: configurable RDM charges (classroom, section, assignment, schedule, test generation).
INSERT INTO public.rdm_config (key, value, description)
VALUES
  ('teacher_create_classroom_rdm', 30, 'Teacher portal · Create classroom (deduct on launch)'),
  ('teacher_create_section_rdm', 30, 'Teacher portal · Create section (deduct per section, max 6 per class)'),
  ('teacher_create_assignment_rdm', 10, 'Teacher portal · Publish assignment'),
  ('teacher_schedule_session_rdm', 30, 'Teacher portal · Schedule live lesson or webinar'),
  ('teacher_generate_test_rdm', 30, 'Teacher portal · Generate new MCQ test (reprints from history are free)')
ON CONFLICT (key) DO UPDATE
SET
  value = EXCLUDED.value,
  description = EXCLUDED.description,
  updated_at = now();
