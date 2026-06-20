-- Average catalog mock score (%) per PCM subject for the current user.
-- Latest scored attempt per paper (mock_rdm_bonus_attempts), joined to mock_papers.
-- Bucketed by primary subject: lower(trim(mock_papers.subjects_covered[1])), default math.

CREATE OR REPLACE FUNCTION public.get_user_mock_subject_score_averages()
RETURNS TABLE(subject text, avg_pct integer, paper_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest_per_paper AS (
    SELECT DISTINCT ON (m.paper_id)
      m.paper_id,
      m.score_percent
    FROM public.mock_rdm_bonus_attempts m
    WHERE m.user_id = auth.uid()
      AND m.score_percent IS NOT NULL
      AND m.score_percent >= 0
      AND m.score_percent <= 100
    ORDER BY m.paper_id, m.created_at DESC
  ),
  labeled AS (
    SELECT
      CASE
        WHEN mp.subjects_covered IS NOT NULL AND array_length(mp.subjects_covered, 1) >= 1 THEN
          lower(trim(mp.subjects_covered[1]))
        ELSE 'math'
      END AS subj,
      l.score_percent::numeric AS pct
    FROM latest_per_paper l
    INNER JOIN public.mock_papers mp ON mp.id = l.paper_id
  )
  SELECT
    labeled.subj AS subject,
    ROUND(AVG(labeled.pct))::integer AS avg_pct,
    COUNT(*)::bigint AS paper_count
  FROM labeled
  WHERE labeled.subj IN ('physics', 'chemistry', 'math')
  GROUP BY labeled.subj;
$$;

REVOKE ALL ON FUNCTION public.get_user_mock_subject_score_averages() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_mock_subject_score_averages() TO authenticated;

COMMENT ON FUNCTION public.get_user_mock_subject_score_averages() IS
  'Student profile: mean catalog mock % per subject — latest attempt per paper, primary subject from subjects_covered[1].';
