-- Add public role so Gyan++ can tell Prof-Pi / teachers from students
-- without opening the rest of the profiles table.

DROP FUNCTION IF EXISTS public.profile_public_previews(uuid[]);

CREATE FUNCTION public.profile_public_previews(p_ids uuid[])
RETURNS TABLE (id uuid, name text, avatar_url text, role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT p.id, p.name, p.avatar_url, p.role
  FROM public.profiles p
  WHERE p.id = ANY (COALESCE(p_ids, '{}'::uuid[]));
$$;

COMMENT ON FUNCTION public.profile_public_previews(uuid[]) IS
  'Public display fields (name, avatar, role) for feed author chips. Bypasses own-row profiles RLS; does not expose private profile columns.';

REVOKE ALL ON FUNCTION public.profile_public_previews(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_public_previews(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_public_previews(uuid[]) TO service_role;
