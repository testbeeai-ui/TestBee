-- Community / Gyan++ feeds embed profiles(name, avatar_url). Production RLS on
-- profiles is "Users read own profile" only, so other authors resolve as null
-- and the UI falls back to "Learner". This RPC returns only public display
-- fields (not phone, cards, or other private columns).

CREATE OR REPLACE FUNCTION public.profile_public_previews(p_ids uuid[])
RETURNS TABLE (id uuid, name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT p.id, p.name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY (COALESCE(p_ids, '{}'::uuid[]));
$$;

COMMENT ON FUNCTION public.profile_public_previews(uuid[]) IS
  'Public display fields (name, avatar) for feed author chips. Bypasses own-row profiles RLS; does not expose private profile columns.';

REVOKE ALL ON FUNCTION public.profile_public_previews(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_public_previews(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_public_previews(uuid[]) TO service_role;
