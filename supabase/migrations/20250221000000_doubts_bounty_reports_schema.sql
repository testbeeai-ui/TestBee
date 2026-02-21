-- Bounty, cost, escrow, views; hidden answers; reports; saves; payout log; profile stats.
ALTER TABLE public.doubts
  ADD COLUMN IF NOT EXISTS bounty_rdm integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_rdm integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounty_escrowed_at timestamptz,
  ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_doubts_bounty_resolved ON public.doubts(bounty_rdm DESC, is_resolved) WHERE is_resolved = false;

ALTER TABLE public.doubt_answers
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_doubt_answers_hidden ON public.doubt_answers(hidden) WHERE hidden = false;

CREATE TABLE IF NOT EXISTS public.doubt_answer_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id uuid NOT NULL REFERENCES public.doubt_answers(id) ON DELETE CASCADE,
  reporter_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT 'ai_spam',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(answer_id, reporter_user_id)
);

CREATE INDEX IF NOT EXISTS idx_doubt_answer_reports_answer_id ON public.doubt_answer_reports(answer_id);

ALTER TABLE public.doubt_answer_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own reports" ON public.doubt_answer_reports;
CREATE POLICY "Users can insert own reports"
  ON public.doubt_answer_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_user_id);

DROP POLICY IF EXISTS "Users can read own reports" ON public.doubt_answer_reports;
CREATE POLICY "Users can read own reports"
  ON public.doubt_answer_reports FOR SELECT TO authenticated USING (auth.uid() = reporter_user_id);

CREATE TABLE IF NOT EXISTS public.doubt_saves (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doubt_id uuid NOT NULL REFERENCES public.doubts(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, doubt_id)
);

CREATE INDEX IF NOT EXISTS idx_doubt_saves_user_id ON public.doubt_saves(user_id);

ALTER TABLE public.doubt_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own saves" ON public.doubt_saves;
CREATE POLICY "Users can manage own saves"
  ON public.doubt_saves FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.accepted_answer_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer_id uuid NOT NULL REFERENCES public.doubt_answers(id) ON DELETE CASCADE,
  rdm_paid integer NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accepted_answer_payouts_user_paid_at ON public.accepted_answer_payouts(user_id, paid_at);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS lifetime_answer_rdm integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.doubts.bounty_rdm IS 'User-funded bounty in escrow; paid to answerer on accept.';
COMMENT ON COLUMN public.doubts.bounty_escrowed_at IS 'When bounty was deducted for 7-day refund rule.';
COMMENT ON COLUMN public.doubt_answers.hidden IS 'Set true when 3+ reports; answer hidden and author penalized.';
COMMENT ON TABLE public.doubt_answer_reports IS 'One report per user per answer; 3 reports trigger penalty.';
COMMENT ON TABLE public.accepted_answer_payouts IS 'Log of RDM paid on accept for farming cap and leaderboard.';
