-- Persisted subject-topic chat (per user + context_key). Replaces Redis/Modal memory for topic bot thread.

CREATE TABLE IF NOT EXISTS public.subject_topic_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  context_key text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subject_topic_chat_messages_content_len CHECK (char_length(content) <= 8000)
);

CREATE INDEX IF NOT EXISTS idx_subject_topic_chat_messages_thread
  ON public.subject_topic_chat_messages (user_id, context_key, created_at DESC);

COMMENT ON TABLE public.subject_topic_chat_messages IS 'Append-only topic chat messages; RLS restricts to owning user.';

ALTER TABLE public.subject_topic_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own subject topic chat" ON public.subject_topic_chat_messages;
CREATE POLICY "Users read own subject topic chat"
  ON public.subject_topic_chat_messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own subject topic chat" ON public.subject_topic_chat_messages;
CREATE POLICY "Users insert own subject topic chat"
  ON public.subject_topic_chat_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
