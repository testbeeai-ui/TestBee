import { createClient, createClientWithToken } from "@/integrations/supabase/server";
import { type AuthedUser, authedUserFromUser, verifyAuthedUser } from "@/lib/auth/verifiedUser";

function readBearer(request: Request): string {
  return (
    request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ?? ""
  );
}

/**
 * Resolve Supabase client + user from cookies or Bearer token (API routes).
 * When `Authorization: Bearer` is sent, validate it first so the API matches the same session
 * as the client (e.g. Prof-Pi right after posting a doubt). Cookie-only first would ignore a
 * valid Bearer and could mis-attribute the caller in edge cases.
 *
 * The token is verified locally (see `verifyAuthedUser`). Only an unverifiable or
 * expired token falls through to the Auth server, which can still refresh it.
 */
export async function getSupabaseAndUser(
  request: Request
): Promise<{ supabase: Awaited<ReturnType<typeof createClient>>; user: AuthedUser } | null> {
  const cookieClient = await createClient();
  const bearer = readBearer(request);

  if (bearer) {
    const fromBearer = await verifyAuthedUser(cookieClient, bearer);
    if (fromBearer) {
      return { supabase: createClientWithToken(bearer), user: fromBearer };
    }
  }

  const fromCookies = await verifyAuthedUser(cookieClient);
  if (fromCookies) {
    return { supabase: cookieClient, user: fromCookies };
  }

  const user = (await cookieClient.auth.getUser()).data?.user ?? null;
  return user ? { supabase: cookieClient, user: authedUserFromUser(user) } : null;
}

/**
 * Same as `getSupabaseAndUser` but returns the full Supabase `User` record.
 *
 * Costs an Auth server round trip, so use it only where account fields absent from
 * the access token are required (e.g. `created_at`, `last_sign_in_at`).
 */
export async function getSupabaseAndFullUser(request: Request) {
  const cookieClient = await createClient();
  const bearer = readBearer(request);

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
