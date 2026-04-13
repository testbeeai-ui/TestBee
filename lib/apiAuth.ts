import { createClient, createClientWithToken } from "@/integrations/supabase/server";

/**
 * Resolve Supabase client + user from cookies or Bearer token (API routes).
 * When `Authorization: Bearer` is sent, validate it first so the API matches the same session
 * as the client (e.g. Prof-Pi right after posting a doubt). Cookie-only first would ignore a
 * valid Bearer and could mis-attribute the caller in edge cases.
 */
export async function getSupabaseAndUser(request: Request) {
  const cookieClient = await createClient();
  const bearer = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim() ?? "";

  if (bearer) {
    const {
      data: { user: tokenUser },
      error,
    } = await cookieClient.auth.getUser(bearer);
    if (!error && tokenUser) {
      return { supabase: createClientWithToken(bearer), user: tokenUser };
    }
  }

  const user = (await cookieClient.auth.getUser()).data?.user ?? null;
  return user ? { supabase: cookieClient, user } : null;
}
