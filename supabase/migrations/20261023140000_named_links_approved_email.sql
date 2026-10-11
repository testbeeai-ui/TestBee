-- Name-link email check also matches the approved list, not only signed-in accounts.
-- An approved email can be linked before that person has a login.

ALTER TABLE public.named_page_links
  ALTER COLUMN user_id DROP NOT NULL;

DROP FUNCTION IF EXISTS public.lookup_users_by_email(text);

CREATE FUNCTION public.lookup_users_by_email(p_query text)
RETURNS TABLE(id uuid, email text, name text, role text, source text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public, auth, pg_temp
AS $$
DECLARE
  v_query text;
BEGIN
  v_query := replace(replace(lower(trim(coalesce(p_query, ''))), '%', ''), '_', '');
  IF length(v_query) < 5 OR position('@' IN v_query) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    u.id,
    lower(u.email)::text,
    p.name,
    coalesce(p.role, ae.role),
    'account'::text
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.approved_emails ae ON lower(ae.email) = lower(u.email)
  WHERE u.email IS NOT NULL
    AND (
      lower(u.email) = v_query
      OR lower(u.email) LIKE v_query || '%'
    )
  ORDER BY (lower(u.email) = v_query) DESC, u.email
  LIMIT 8;

  RETURN QUERY
  SELECT
    NULL::uuid,
    ae.email,
    nullif(btrim(concat_ws(' ', ae.first_name, ae.last_name)), ''),
    ae.role,
    'approved'::text
  FROM public.approved_emails ae
  WHERE (
      lower(ae.email) = v_query
      OR lower(ae.email) LIKE v_query || '%'
    )
    AND NOT EXISTS (
      SELECT 1 FROM auth.users u WHERE lower(u.email) = lower(ae.email)
    )
  ORDER BY (lower(ae.email) = v_query) DESC, ae.email
  LIMIT 8;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_users_by_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_users_by_email(text) TO service_role;
