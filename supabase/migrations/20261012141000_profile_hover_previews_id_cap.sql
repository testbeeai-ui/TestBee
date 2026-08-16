-- Cap batched hover lookups so one authenticated call cannot scan unbounded ids.

DROP FUNCTION IF EXISTS public.profile_public_previews(uuid[]);

CREATE FUNCTION public.profile_public_previews(p_ids uuid[])
RETURNS TABLE (
  id uuid,
  name text,
  avatar_url text,
  role text,
  rdm integer,
  created_at timestamp with time zone,
  questions_asked integer,
  answers_given integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  WITH wanted AS (
    SELECT DISTINCT x AS id
    FROM unnest(COALESCE(p_ids[1:200], '{}'::uuid[])) AS x
  )
  SELECT
    p.id,
    p.name,
    p.avatar_url,
    p.role,
    COALESCE(p.rdm, 0)::integer AS rdm,
    p.created_at,
    COALESCE(dq.n, 0)::integer AS questions_asked,
    COALESCE(aq.n, 0)::integer AS answers_given
  FROM wanted w
  JOIN public.profiles p ON p.id = w.id
  LEFT JOIN (
    SELECT d.user_id, count(*) AS n
    FROM public.doubts d
    WHERE d.user_id IN (SELECT id FROM wanted)
    GROUP BY d.user_id
  ) dq ON dq.user_id = p.id
  LEFT JOIN (
    SELECT a.user_id, count(*) AS n
    FROM public.doubt_answers a
    WHERE a.user_id IN (SELECT id FROM wanted)
      AND COALESCE(a.hidden, false) = false
    GROUP BY a.user_id
  ) aq ON aq.user_id = p.id;
$$;

COMMENT ON FUNCTION public.profile_public_previews(uuid[]) IS
  'Batched public hover fields for feed authors (max 200 ids). SECURITY DEFINER; no private profile columns.';

REVOKE ALL ON FUNCTION public.profile_public_previews(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_public_previews(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_public_previews(uuid[]) TO service_role;
