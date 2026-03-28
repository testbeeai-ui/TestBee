import { createClient, createClientWithToken } from "@/integrations/supabase/server";

/** Resolve Supabase client + user from cookies or Bearer token (API routes). */
export async function getSupabaseAndUser(request: Request) {
  const cookieClient = await createClient();
  let user = (await cookieClient.auth.getUser()).data?.user ?? null;
  if (!user) {
    const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
    if (token) {
      const {
        data: { user: tokenUser },
      } = await cookieClient.auth.getUser(token);
      user = tokenUser ?? null;
      if (user) {
        return { supabase: createClientWithToken(token), user };
      }
    }
  }
  return user ? { supabase: cookieClient, user } : null;
}
