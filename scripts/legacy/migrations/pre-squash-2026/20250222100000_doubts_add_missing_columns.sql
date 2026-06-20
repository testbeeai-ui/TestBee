-- Add missing columns to doubts if they don't exist (fixes "column cost_rdm does not exist").
-- Run this in Supabase SQL Editor if your doubts table was created without these columns.

ALTER TABLE public.doubts
  ADD COLUMN IF NOT EXISTS bounty_rdm integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cost_rdm integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bounty_escrowed_at timestamptz,
  ADD COLUMN IF NOT EXISTS views integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_doubts_bounty_resolved ON public.doubts(bounty_rdm DESC, is_resolved) WHERE is_resolved = false;

ALTER TABLE public.doubt_answers
  ADD COLUMN IF NOT EXISTS hidden boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_doubt_answers_hidden ON public.doubt_answers(hidden) WHERE hidden = false;

COMMENT ON COLUMN public.doubts.bounty_rdm IS 'User-funded bounty in escrow; paid to answerer on accept.';
COMMENT ON COLUMN public.doubts.cost_rdm IS 'Cost to post (e.g. 5 RDM; 0 during beta).';
COMMENT ON COLUMN public.doubts.bounty_escrowed_at IS 'When bounty was deducted for 7-day refund rule.';
COMMENT ON COLUMN public.doubt_answers.hidden IS 'Set true when 3+ reports; answer hidden and author penalized.';
