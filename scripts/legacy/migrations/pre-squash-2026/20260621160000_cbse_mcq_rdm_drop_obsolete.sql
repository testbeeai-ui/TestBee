-- One-time cleanup if older tier migrations were already applied on Supabase.

DELETE FROM public.rdm_config
WHERE key IN (
  'cbse_mcq_tier1_min_accuracy_pct',
  'cbse_mcq_tier1_rdm',
  'cbse_mcq_tier2_min_accuracy_pct',
  'cbse_mcq_tier2_rdm',
  'cbse_mcq_tier3_min_accuracy_pct',
  'cbse_mcq_tier3_rdm'
);

INSERT INTO public.rdm_config (key, value, description)
VALUES
  (
    'cbse_mcq_min_accuracy_pct',
    60,
    'CBSE MCQ''s · Minimum accuracy % to win RDM (correct ÷ total × 100, must meet or exceed)'
  ),
  ('cbse_mcq_win_rdm', 5, 'CBSE MCQ''s · Win RDM when accuracy meets minimum % (once per chapter quiz attempt)')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.cbse_mcq_score_bonus_claims
  DROP COLUMN IF EXISTS tier_key;

ALTER TABLE public.cbse_mcq_score_bonus_claims
  ADD COLUMN IF NOT EXISTS eligible boolean NOT NULL DEFAULT false;

UPDATE public.cbse_mcq_score_bonus_claims
SET eligible = (rdm_amount > 0)
WHERE eligible IS DISTINCT FROM (rdm_amount > 0);

DROP FUNCTION IF EXISTS public.compute_cbse_mcq_score_rdm(integer, integer);

-- Ensure win claim uses simple >= min % logic (replaces tier-based version if present).
CREATE OR REPLACE FUNCTION public.claim_cbse_mcq_chapter_score_rdm(
  p_paper_id uuid,
  p_correct integer,
  p_total integer,
  p_attempt_key text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_attempt text;
  v_paper_ok boolean;
  v_pct integer;
  v_min_pct integer;
  v_win_rdm integer;
  v_eligible boolean;
  v_new_rdm integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'unauthenticated');
  END IF;

  v_attempt := trim(both from coalesce(p_attempt_key, ''));
  IF length(v_attempt) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'missing_attempt_key');
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.mock_papers mp
    WHERE mp.id = p_paper_id
      AND mp.published = true
      AND mp.paper_type = 'chapter'
  )
  INTO v_paper_ok;

  IF NOT v_paper_ok THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'paper_not_found');
  END IF;

  IF p_total IS NULL OR p_total <= 0 OR p_correct IS NULL OR p_correct < 0 OR p_correct > p_total THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_score');
  END IF;

  v_pct := ROUND(100.0 * p_correct::numeric / p_total::numeric)::integer;

  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'cbse_mcq_min_accuracy_pct'), 60)
  INTO v_min_pct;
  SELECT COALESCE((SELECT value FROM public.rdm_config WHERE key = 'cbse_mcq_win_rdm'), 5)
  INTO v_win_rdm;

  v_min_pct := GREATEST(0, LEAST(100, v_min_pct));
  v_win_rdm := GREATEST(0, v_win_rdm);
  v_eligible := v_pct >= v_min_pct AND v_win_rdm > 0;

  PERFORM pg_advisory_xact_lock(904323, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1 FROM public.cbse_mcq_score_bonus_claims c
    WHERE c.user_id = v_uid AND c.attempt_key = v_attempt
  ) THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END IF;

  IF NOT v_eligible THEN
    INSERT INTO public.cbse_mcq_score_bonus_claims (
      user_id, paper_id, attempt_key, correct_count, total_questions,
      accuracy_pct, eligible, rdm_amount
    ) VALUES (
      v_uid, p_paper_id, v_attempt, p_correct, p_total, v_pct, false, 0
    );
    RETURN jsonb_build_object(
      'ok', false,
      'denial_reason', 'below_minimum',
      'accuracy_pct', v_pct,
      'min_accuracy_pct', v_min_pct,
      'rdm_amount', 0
    );
  END IF;

  BEGIN
    INSERT INTO public.cbse_mcq_score_bonus_claims (
      user_id, paper_id, attempt_key, correct_count, total_questions,
      accuracy_pct, eligible, rdm_amount
    ) VALUES (
      v_uid, p_paper_id, v_attempt, p_correct, p_total, v_pct, true, v_win_rdm
    );
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'already_claimed_session');
  END;

  v_new_rdm := public.add_rdm(v_uid, v_win_rdm);

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', v_win_rdm,
    'new_rdm_balance', v_new_rdm,
    'accuracy_pct', v_pct,
    'min_accuracy_pct', v_min_pct,
    'eligible', true
  );
END;
$$;
