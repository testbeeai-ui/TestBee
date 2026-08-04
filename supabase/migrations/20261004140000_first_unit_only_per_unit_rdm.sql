-- Per-unit RDM only on first quiz set / first numerals pack (still ≥60%).
-- Later sets/packs: no per-unit credit; overall bonus unchanged.

UPDATE public.rdm_config
SET description = 'Lessons/Dive · Quiz set 1 ≥60% RDM (once per subtopic; sets 2+ not eligible)'
WHERE key = 'subtopic_quiz_set_rdm';

UPDATE public.rdm_config
SET description = 'Lessons/Dive · First numerals formula pack ≥60% RDM (once per subtopic; later packs not eligible)'
WHERE key = 'subtopic_numerals_formula_rdm';

-- Functions updated live via apply; keep file as source of truth for fresh envs.
-- claim_quiz_set_complete_rdm: rejects p_quiz_set <> 1 with reason not_first_set
-- claim_numerals_formula_complete_rdm: rejects non-first pack-with-questions with not_first_formula
SELECT 1;
