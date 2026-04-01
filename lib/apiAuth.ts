import { createClient, createClientWithToken } from "@/integrations/supabase/server";

/** Resolve Supabase client + user from cookies or Bearer token (API routes). */
export async function getSupabaseAndUser(request: Request) {
  const cookieClient = await createClient();
  const user = (await cookieClient.auth.getUser()).data?.user ?? null;
  if (!user) {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      // Validate JWT via GoTrue (passing the jwt explicitly); token-scoped client has no auth session in memory.
      const {
        data: { user: tokenUser },
        error,
      } = await cookieClient.auth.getUser(token);
      if (!error && tokenUser) {
        return { supabase: createClientWithToken(token), user: tokenUser };
      }
    }
  }
  return user ? { supabase: cookieClient, user } : null;
}
