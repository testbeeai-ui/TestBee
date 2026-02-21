-- Allow students to re-apply after rejection (set their own rejected request back to pending).
-- Prevents duplicate rows: one row per (classroom_id, user_id); status can go rejected -> pending.

DROP POLICY IF EXISTS "Users can re-apply (set rejected to pending)" ON public.classroom_join_requests;
CREATE POLICY "Users can re-apply (set rejected to pending)"
  ON public.classroom_join_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'rejected')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');
