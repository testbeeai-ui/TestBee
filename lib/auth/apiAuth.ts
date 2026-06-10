import { createClient, createClientWithToken } from "@/integrations/supabase/server";
import { evaluateWhitelistGate } from "@/lib/waitlist/whitelistGate";
import type { User } from "@supabase/supabase-js";

type ApiAuthOptions = {
  /** Set false only for endpoints that intentionally perform their own whitelist decision. */
  enforceWhitelist?: boolean;
};

type ApiAuthContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: User;
};

async function maybeApplyWhitelistGate(
  ctx: ApiAuthContext,
  options: ApiAuthOptions
): Promise<ApiAuthContext | null> {
  if (options.enforceWhitelist === false) return ctx;

  const gate = await evaluateWhitelistGate(ctx.supabase, {
    userId: ctx.user.id,
    email: ctx.user.email,
    onboardingComplete: false,
  });

  return gate.allowed ? ctx : null;
}

/**
 * Resolve Supabase client + user from cookies or Bearer token (API routes).
 * When `Authorization: Bearer` is sent, validate it first so the API matches the same session
 * as the client (e.g. Prof-Pi right after posting a doubt). Cookie-only first would ignore a
 * valid Bearer and could mis-attribute the caller in edge cases.
 */
export async function getSupabaseAndUser(
  request: Request,
  options: ApiAuthOptions = {}
) {
  const cookieClient = await createClient();
  const bearer =
    request.headers
      .get("Authorization")
      ?.replace(/^Bearer\s+/i, "")
      .trim() ?? "";

  if (bearer) {
    const {
      data: { user: tokenUser },
      error,
    } = await cookieClient.auth.getUser(bearer);
    if (!error && tokenUser) {
      return maybeApplyWhitelistGate(
        { supabase: createClientWithToken(bearer), user: tokenUser },
        options
      );
    }
  }

  const user = (await cookieClient.auth.getUser()).data?.user ?? null;
  return user ? maybeApplyWhitelistGate({ supabase: cookieClient, user }, options) : null;
}
