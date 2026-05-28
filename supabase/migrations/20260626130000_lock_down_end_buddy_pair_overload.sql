-- Lock down the multi-buddy overload added after the original one-arg RPC.
-- Only server routes using the service role should be able to end buddy pairs.

REVOKE ALL ON FUNCTION public.end_buddy_pair(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_buddy_pair(uuid, uuid) TO service_role;
