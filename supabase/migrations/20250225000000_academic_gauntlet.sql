-- 1. Create the table completely if missing
CREATE TABLE IF NOT EXISTS public.daily_gauntlet_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  gauntlet_date date NOT NULL,
  domain text NOT NULL DEFAULT 'funbrain',
  total_time_ms integer NOT NULL,
  correct_count integer NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, gauntlet_date, domain)
);

-- 2. Add domain if table existed but was missing domain
ALTER TABLE public.daily_gauntlet_attempts ADD COLUMN IF NOT EXISTS domain text NOT NULL DEFAULT 'funbrain';

-- 3. Drop old unique constraint if it exists (which prevents multiple domains per day)
ALTER TABLE public.daily_gauntlet_attempts DROP CONSTRAINT IF EXISTS daily_gauntlet_attempts_user_id_gauntlet_date_key;
DROP INDEX IF EXISTS idx_daily_gauntlet_user_date;

-- 4. Re-add new unique constraint that INCLUDES domain
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'public.daily_gauntlet_attempts'::regclass 
    AND conname = 'daily_gauntlet_attempts_user_id_gauntlet_date_domain_key'
  ) THEN
    ALTER TABLE public.daily_gauntlet_attempts ADD CONSTRAINT daily_gauntlet_attempts_user_id_gauntlet_date_domain_key UNIQUE (user_id, gauntlet_date, domain);
  END IF;
END $$;

-- 5. Enable RLS and setup policies so answers can be saved
ALTER TABLE public.daily_gauntlet_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own daily_gauntlet_attempts" ON public.daily_gauntlet_attempts;
CREATE POLICY "Users insert own daily_gauntlet_attempts" 
  ON public.daily_gauntlet_attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own daily_gauntlet_attempts" ON public.daily_gauntlet_attempts;
CREATE POLICY "Users update own daily_gauntlet_attempts" 
  ON public.daily_gauntlet_attempts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated can read daily_gauntlet_attempts" ON public.daily_gauntlet_attempts;
CREATE POLICY "Authenticated can read daily_gauntlet_attempts" 
  ON public.daily_gauntlet_attempts FOR SELECT TO authenticated USING (true);

-- 6. Create Questions RPC
CREATE OR REPLACE FUNCTION public.get_daily_gauntlet_questions(p_date date, p_domain text DEFAULT 'funbrain')
RETURNS TABLE(id uuid, content jsonb, options jsonb, correct_answer_index integer, explanation text, difficulty_rating integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT q.id, q.content, q.options, q.correct_answer_index, q.explanation, q.difficulty_rating
  FROM public.play_questions q
  WHERE q.domain = p_domain
  ORDER BY md5(q.id::text || p_date::text)
  LIMIT 10;
END;
$$;


-- 7. Create Submit RPC
CREATE OR REPLACE FUNCTION public.submit_daily_gauntlet(p_gauntlet_date date, p_results jsonb, p_domain text DEFAULT 'funbrain')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id uuid := auth.uid();
  r jsonb; v_total_ms int := 0; v_correct int := 0;
  v_question_id uuid; v_ok boolean; v_time_ms int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_question_id := (r->>'question_id')::uuid;
    v_ok := (r->>'is_correct')::boolean;
    v_time_ms := (r->>'time_taken_ms')::int;
    v_total_ms := v_total_ms + COALESCE(v_time_ms, 0);
    IF v_ok THEN v_correct := v_correct + 1; END IF;
    PERFORM public.record_play_result(v_question_id, v_ok, v_time_ms, NULL);
  END LOOP;
  INSERT INTO public.daily_gauntlet_attempts (user_id, gauntlet_date, domain, total_time_ms, correct_count)
  VALUES (v_user_id, p_gauntlet_date, p_domain, v_total_ms, v_correct)
  ON CONFLICT (user_id, gauntlet_date, domain) DO UPDATE SET
    total_time_ms = EXCLUDED.total_time_ms,
    correct_count = EXCLUDED.correct_count,
    completed_at = now();
  RETURN jsonb_build_object('ok', true, 'correct_count', v_correct, 'total_time_ms', v_total_ms);
END;
$$;

-- 8. Create Leaderboard RPC
CREATE OR REPLACE FUNCTION public.get_daily_gauntlet_leaderboard(p_gauntlet_date date, p_domain text DEFAULT 'funbrain')
RETURNS TABLE(rank bigint, user_id uuid, display_name text, correct_count integer, total_time_ms integer, completed_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT
    row_number() OVER (ORDER BY g.correct_count DESC, g.total_time_ms ASC)::bigint,
    g.user_id, p.name AS display_name, g.correct_count, g.total_time_ms, g.completed_at
  FROM public.daily_gauntlet_attempts g
  LEFT JOIN public.profiles p ON p.id = g.user_id
  WHERE g.gauntlet_date = p_gauntlet_date AND g.domain = p_domain
  ORDER BY g.correct_count DESC, g.total_time_ms ASC;
END;
$$;
