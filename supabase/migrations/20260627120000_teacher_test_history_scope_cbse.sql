-- Update the scope check constraint on teacher_generated_test_history to support CBSE custom test scopes

ALTER TABLE teacher_generated_test_history 
  DROP CONSTRAINT IF EXISTS teacher_generated_test_history_scope_check;

ALTER TABLE teacher_generated_test_history 
  ADD CONSTRAINT teacher_generated_test_history_scope_check 
  CHECK (scope IN ('Topic-wise', 'Unit-wise', 'Chapter-wise', 'Full paper'));
