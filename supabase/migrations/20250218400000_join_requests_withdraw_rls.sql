-- Allow users to delete (withdraw) their own join request.
CREATE POLICY "Users can delete own join request"
  ON public.classroom_join_requests FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
