-- Run ONCE in Supabase → SQL Editor (after obsolete local migration files were removed).

-- A) Remove unused tier config + dead function (frees a few rows; stops confusion)
DELETE FROM public.rdm_config
WHERE key IN (
  'cbse_mcq_tier1_min_accuracy_pct',
  'cbse_mcq_tier1_rdm',
  'cbse_mcq_tier2_min_accuracy_pct',
  'cbse_mcq_tier2_rdm',
  'cbse_mcq_tier3_min_accuracy_pct',
  'cbse_mcq_tier3_rdm'
);

DROP FUNCTION IF EXISTS public.compute_cbse_mcq_score_rdm(integer, integer);

ALTER TABLE public.cbse_mcq_score_bonus_claims
  DROP COLUMN IF EXISTS tier_key;

-- B) Drop duplicate migration history for the deleted simplify file (version 20260621150000)
DELETE FROM supabase_migrations.schema_migrations
WHERE version = '20260621150000';

-- C) Then push the new cleanup migration from the repo:
--     supabase db push
--     (applies 20260621160000_cbse_mcq_rdm_drop_obsolete.sql if not already applied)
