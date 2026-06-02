-- The subscription-limit overload is called only by the Next.js API using service_role.
-- Keep clients from bypassing API-computed buddy caps or spoofing p_acceptor_id.

REVOKE ALL ON FUNCTION public.accept_buddy_invite(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_buddy_invite(text, uuid) FROM anon;
REVOKE ALL ON FUNCTION public.accept_buddy_invite(text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_buddy_invite(text, uuid) TO service_role;

REVOKE ALL ON FUNCTION public.accept_buddy_invite(text, uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.accept_buddy_invite(text, uuid, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.accept_buddy_invite(text, uuid, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.accept_buddy_invite(text, uuid, integer, integer) TO service_role;
