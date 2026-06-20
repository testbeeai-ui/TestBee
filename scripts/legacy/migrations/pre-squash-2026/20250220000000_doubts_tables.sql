-- Doubts Q&A: questions, answers, and votes. RDM rewards handled by RPC.
CREATE TABLE IF NOT EXISTS public.doubts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  subject text,
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  is_resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doubts_user_id ON public.doubts(user_id);
CREATE INDEX IF NOT EXISTS idx_doubts_created_at ON public.doubts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doubts_subject ON public.doubts(subject);
CREATE INDEX IF NOT EXISTS idx_doubts_is_resolved ON public.doubts(is_resolved);

CREATE TABLE IF NOT EXISTS public.doubt_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doubt_id uuid NOT NULL REFERENCES public.doubts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  is_accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doubt_answers_doubt_id ON public.doubt_answers(doubt_id);
CREATE INDEX IF NOT EXISTS idx_doubt_answers_user_id ON public.doubt_answers(user_id);

CREATE TABLE IF NOT EXISTS public.doubt_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('doubt', 'answer')),
  target_id uuid NOT NULL,
  vote_type integer NOT NULL CHECK (vote_type IN (1, -1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_doubt_votes_user_target ON public.doubt_votes(user_id, target_type, target_id);

ALTER TABLE public.doubts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubt_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.doubt_votes ENABLE ROW LEVEL SECURITY;

-- doubts: anyone authenticated can read; only author can insert/update/delete own
DROP POLICY IF EXISTS "Anyone can read doubts" ON public.doubts;
CREATE POLICY "Anyone can read doubts"
  ON public.doubts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own doubts" ON public.doubts;
CREATE POLICY "Users can insert own doubts"
  ON public.doubts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own doubts" ON public.doubts;
CREATE POLICY "Users can update own doubts"
  ON public.doubts FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own doubts" ON public.doubts;
CREATE POLICY "Users can delete own doubts"
  ON public.doubts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- doubt_answers: anyone can read; only author can insert/update/delete own; doubt author can update is_accepted (handled in app or RPC)
DROP POLICY IF EXISTS "Anyone can read doubt_answers" ON public.doubt_answers;
CREATE POLICY "Anyone can read doubt_answers"
  ON public.doubt_answers FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can insert own doubt_answers" ON public.doubt_answers;
CREATE POLICY "Users can insert own doubt_answers"
  ON public.doubt_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own doubt_answers" ON public.doubt_answers;
CREATE POLICY "Users can update own doubt_answers"
  ON public.doubt_answers FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own doubt_answers" ON public.doubt_answers;
CREATE POLICY "Users can delete own doubt_answers"
  ON public.doubt_answers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- doubt_votes: users can only insert/read own votes (updates handled by delete+insert in RPC)
DROP POLICY IF EXISTS "Users can read own doubt_votes" ON public.doubt_votes;
CREATE POLICY "Users can read own doubt_votes"
  ON public.doubt_votes FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own doubt_votes" ON public.doubt_votes;
CREATE POLICY "Users can insert own doubt_votes"
  ON public.doubt_votes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own doubt_votes" ON public.doubt_votes;
CREATE POLICY "Users can delete own doubt_votes"
  ON public.doubt_votes FOR DELETE TO authenticated USING (auth.uid() = user_id);

COMMENT ON TABLE public.doubts IS 'Student Q&A questions; upvotes/downvotes and RDM rewards via RPC.';
COMMENT ON TABLE public.doubt_answers IS 'Answers to doubts; is_accepted set by question author.';
COMMENT ON TABLE public.doubt_votes IS 'One vote per user per doubt or answer; vote_type 1=up, -1=down.';
