-- Free-trial checklist: one Gyan++ step (browse + post + engage) instead of three separate tasks.

CREATE OR REPLACE FUNCTION public._gyan_plus_onboarding_complete(p_progress jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE((p_progress ->> 'gyan_plus')::boolean, false)
    OR (
      COALESCE((p_progress ->> 'gyan_browse')::boolean, false)
      AND COALESCE((p_progress ->> 'gyan_post')::boolean, false)
      AND COALESCE((p_progress ->> 'gyan_engagement')::boolean, false)
    );
$$;

CREATE OR REPLACE FUNCTION public._free_trial_onboarding_task_ids()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ARRAY[
    'magic_wall',
    'lessons',
    'prep_classes',
    'prep_mcq',
    'gyan_plus',
    'earn_buddy',
    'earn_challenge',
    'news_blog',
    'edufund',
    'profile'
  ]::text[];
$$;

CREATE OR REPLACE FUNCTION public._free_trial_onboarding_all_complete(p_progress jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(public._free_trial_onboarding_task_ids()) AS tid(task_id)
    WHERE CASE
      WHEN tid.task_id = 'gyan_plus' THEN NOT public._gyan_plus_onboarding_complete(p_progress)
      ELSE COALESCE((p_progress ->> tid.task_id)::boolean, false) IS NOT TRUE
    END
  );
$$;

UPDATE public.rdm_config
SET description = 'RDM paid when a student completes all 10 free-trial onboarding checklist tasks and claims (also drives welcome-bonus copy in the trial wizard).'
WHERE key = 'free_trial_checklist_reward_rdm';
