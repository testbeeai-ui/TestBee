-- Lock doubt and answer edits once an answer is accepted.
-- Doubts: author can update/delete only when is_resolved = false.
-- Answers: author can update/delete only when answer is not accepted and doubt is not resolved.

DROP POLICY IF EXISTS "Users can update own doubts" ON public.doubts;
CREATE POLICY "Users can update own doubts"
  ON public.doubts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND is_resolved = false);

DROP POLICY IF EXISTS "Users can delete own doubts" ON public.doubts;
CREATE POLICY "Users can delete own doubts"
  ON public.doubts FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND is_resolved = false);

DROP POLICY IF EXISTS "Users can update own doubt_answers" ON public.doubt_answers;
CREATE POLICY "Users can update own doubt_answers"
  ON public.doubt_answers FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND is_accepted = false
    AND (SELECT is_resolved FROM public.doubts WHERE id = doubt_answers.doubt_id) = false
  );

DROP POLICY IF EXISTS "Users can delete own doubt_answers" ON public.doubt_answers;
CREATE POLICY "Users can delete own doubt_answers"
  ON public.doubt_answers FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND is_accepted = false
    AND (SELECT is_resolved FROM public.doubts WHERE id = doubt_answers.doubt_id) = false
  );
