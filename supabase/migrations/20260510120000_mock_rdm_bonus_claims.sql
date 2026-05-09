-- Catalog mock: +50 RDM when score >= 60% (correct/total), once per IST day per user,
-- once per paper per user (lifetime). Server recomputes score from mock_questions.

CREATE TABLE IF NOT EXISTS public.mock_rdm_bonus_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  paper_id uuid NOT NULL REFERENCES public.mock_papers (id) ON DELETE CASCADE,
  ist_claim_date date NOT NULL,
  score_percent integer NOT NULL,
  correct_count integer NOT NULL,
  total_questions integer NOT NULL,
  rdm_amount integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mock_rdm_bonus_claims_user_paper UNIQUE (user_id, paper_id),
  CONSTRAINT mock_rdm_bonus_claims_user_ist_day UNIQUE (user_id, ist_claim_date)
);

CREATE INDEX IF NOT EXISTS idx_mock_rdm_bonus_claims_user_created
  ON public.mock_rdm_bonus_claims (user_id, created_at DESC);

COMMENT ON TABLE public.mock_rdm_bonus_claims IS
  'Successful +50 RDM mock bonus: at most one row per user per IST date and one per user per catalog paper.';

ALTER TABLE public.mock_rdm_bonus_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mock_rdm_bonus_claims_select_own" ON public.mock_rdm_bonus_claims;
CREATE POLICY "mock_rdm_bonus_claims_select_own"
  ON public.mock_rdm_bonus_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- No direct INSERT/UPDATE/DELETE for authenticated — RPC only.

CREATE TABLE IF NOT EXISTS public.mock_rdm_bonus_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  paper_id uuid NOT NULL,
  ist_claim_date date NOT NULL,
  eligible boolean NOT NULL DEFAULT false,
  score_percent integer,
  correct_count integer,
  total_questions integer,
  denial_reason text,
  rdm_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mock_rdm_bonus_attempts_user_created
  ON public.mock_rdm_bonus_attempts (user_id, created_at DESC);

COMMENT ON TABLE public.mock_rdm_bonus_attempts IS
  'Audit log for mock 60% RDM bonus API; includes denials and successful grants.';

ALTER TABLE public.mock_rdm_bonus_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mock_rdm_bonus_attempts_select_own" ON public.mock_rdm_bonus_attempts;
CREATE POLICY "mock_rdm_bonus_attempts_select_own"
  ON public.mock_rdm_bonus_attempts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- No direct INSERT for authenticated — RPC only.

CREATE OR REPLACE FUNCTION public.claim_mock_rdm_bonus(p_paper_id uuid, p_answer_indices integer[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ist date;
  v_total integer;
  v_correct integer := 0;
  v_expected integer;
  v_given integer;
  v_score_pct integer;
  v_eligible boolean;
  r record;
  v_idx integer := 1;
  v_new_rdm integer;
  v_paper_ok boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'unauthenticated');
  END IF;

  v_ist := (timezone('Asia/Kolkata', clock_timestamp()))::date;

  SELECT EXISTS (
    SELECT 1 FROM public.mock_papers mp
    WHERE mp.id = p_paper_id AND mp.published = true
  )
  INTO v_paper_ok;

  IF NOT v_paper_ok THEN
    INSERT INTO public.mock_rdm_bonus_attempts (
      user_id, paper_id, ist_claim_date, eligible, score_percent, denial_reason, rdm_awarded
    ) VALUES (v_uid, p_paper_id, v_ist, false, NULL, 'paper_not_found', 0);
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'paper_not_found');
  END IF;

  SELECT COUNT(*)::integer INTO v_total FROM public.mock_questions mq WHERE mq.paper_id = p_paper_id;

  IF v_total IS NULL OR v_total <= 0 THEN
    INSERT INTO public.mock_rdm_bonus_attempts (
      user_id, paper_id, ist_claim_date, eligible, score_percent, denial_reason, rdm_awarded
    ) VALUES (v_uid, p_paper_id, v_ist, false, NULL, 'no_questions', 0);
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'no_questions');
  END IF;

  IF p_answer_indices IS NULL OR array_length(p_answer_indices, 1) IS DISTINCT FROM v_total THEN
    INSERT INTO public.mock_rdm_bonus_attempts (
      user_id, paper_id, ist_claim_date, eligible, score_percent, denial_reason, rdm_awarded, total_questions
    ) VALUES (v_uid, p_paper_id, v_ist, false, NULL, 'invalid_payload', 0, v_total);
    RETURN jsonb_build_object('ok', false, 'denial_reason', 'invalid_payload', 'expected_answers', v_total);
  END IF;

  FOR r IN
    SELECT mq.correct_letter
    FROM public.mock_questions mq
    WHERE mq.paper_id = p_paper_id
    ORDER BY mq.sort_order
  LOOP
    v_expected := ascii(trim(both from upper(r.correct_letter::text))) - 65;
    IF v_expected < 0 OR v_expected > 3 THEN
      v_expected := 0;
    END IF;

    v_given := p_answer_indices[v_idx];
    IF v_given IS NOT NULL AND v_given >= 0 AND v_given <= 3 AND v_given = v_expected THEN
      v_correct := v_correct + 1;
    END IF;
    v_idx := v_idx + 1;
  END LOOP;

  v_score_pct := ROUND(100.0 * v_correct::numeric / v_total::numeric)::integer;
  v_eligible := (100 * v_correct >= 60 * v_total);

  IF NOT v_eligible THEN
    INSERT INTO public.mock_rdm_bonus_attempts (
      user_id, paper_id, ist_claim_date, eligible, score_percent, correct_count, total_questions,
      denial_reason, rdm_awarded
    ) VALUES (
      v_uid, p_paper_id, v_ist, false, v_score_pct, v_correct, v_total, 'below_60', 0
    );
    RETURN jsonb_build_object(
      'ok', false,
      'denial_reason', 'below_60',
      'score_percent', v_score_pct,
      'correct_count', v_correct,
      'total_questions', v_total
    );
  END IF;

  PERFORM pg_advisory_xact_lock(904321, hashtext(v_uid::text));

  IF EXISTS (
    SELECT 1 FROM public.mock_rdm_bonus_claims c WHERE c.user_id = v_uid AND c.paper_id = p_paper_id
  ) THEN
    INSERT INTO public.mock_rdm_bonus_attempts (
      user_id, paper_id, ist_claim_date, eligible, score_percent, correct_count, total_questions,
      denial_reason, rdm_awarded
    ) VALUES (
      v_uid, p_paper_id, v_ist, true, v_score_pct, v_correct, v_total, 'already_claimed_paper', 0
    );
    RETURN jsonb_build_object(
      'ok', false,
      'denial_reason', 'already_claimed_paper',
      'score_percent', v_score_pct,
      'correct_count', v_correct,
      'total_questions', v_total
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.mock_rdm_bonus_claims c WHERE c.user_id = v_uid AND c.ist_claim_date = v_ist
  ) THEN
    INSERT INTO public.mock_rdm_bonus_attempts (
      user_id, paper_id, ist_claim_date, eligible, score_percent, correct_count, total_questions,
      denial_reason, rdm_awarded
    ) VALUES (
      v_uid, p_paper_id, v_ist, true, v_score_pct, v_correct, v_total, 'already_claimed_today', 0
    );
    RETURN jsonb_build_object(
      'ok', false,
      'denial_reason', 'already_claimed_today',
      'score_percent', v_score_pct,
      'correct_count', v_correct,
      'total_questions', v_total
    );
  END IF;

  INSERT INTO public.mock_rdm_bonus_claims (
    user_id, paper_id, ist_claim_date, score_percent, correct_count, total_questions, rdm_amount
  ) VALUES (
    v_uid, p_paper_id, v_ist, v_score_pct, v_correct, v_total, 50
  );

  v_new_rdm := public.add_rdm(v_uid, 50);

  INSERT INTO public.mock_rdm_bonus_attempts (
    user_id, paper_id, ist_claim_date, eligible, score_percent, correct_count, total_questions,
    denial_reason, rdm_awarded
  ) VALUES (
    v_uid, p_paper_id, v_ist, true, v_score_pct, v_correct, v_total, NULL, 50
  );

  RETURN jsonb_build_object(
    'ok', true,
    'rdm_awarded', 50,
    'new_rdm_balance', v_new_rdm,
    'score_percent', v_score_pct,
    'correct_count', v_correct,
    'total_questions', v_total,
    'ist_claim_date', v_ist
  );
END;
$$;

COMMENT ON FUNCTION public.claim_mock_rdm_bonus IS
  'Authenticated: verify mock answers vs DB, grant +50 RDM if >=60% and daily/paper uniqueness (IST).';

REVOKE ALL ON FUNCTION public.claim_mock_rdm_bonus(uuid, integer[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_mock_rdm_bonus(uuid, integer[]) TO authenticated;
