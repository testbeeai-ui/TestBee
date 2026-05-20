import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/integrations/supabase/server";
import { isAdminUser } from "@/lib/admin/admin";

type AuthSuccess = {
  user: User;
  accessToken: string | null;
};

type AuthResult =
  | AuthSuccess
  | {
      response: NextResponse;
    };

export function getBearerToken(request: Request): string | null {
  const raw = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
  if (!raw.toLowerCase().startsWith("bearer ")) return null;
  const token = raw.slice(7).trim();
  return token.length > 0 ? token : null;
}

export async function requireAuthenticatedUser(request: Request): Promise<AuthResult> {
  const cookieClient = await createClient();
  const bearer = getBearerToken(request);

  if (bearer) {
    const {
      data: { user: tokenUser },
    } = await cookieClient.auth.getUser(bearer);
    if (tokenUser) return { user: tokenUser, accessToken: bearer };
  }

  const {
    data: { user },
  } = await cookieClient.auth.getUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { user, accessToken: null };
}

export async function requireAdminUser(request: Request): Promise<AuthResult> {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth;

  const supabase = await createClient();
  const ok = await isAdminUser(supabase, auth.user.id);
  if (!ok) {
    return { response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return auth;
}

/**
 * CSRF guard for state-changing endpoints that accept cookie auth.
 * If Bearer token is used, this check is skipped for API clients.
 */
export function enforceSameOriginForCookieAuth(request: Request): NextResponse | null {
  if (getBearerToken(request)) return null;

  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (!host || !origin) {
    return NextResponse.json({ error: "Missing origin/host headers." }, { status: 403 });
  }
  const expected = `${proto}://${host}`;
  if (origin !== expected) {
    return NextResponse.json({ error: "Cross-site request blocked." }, { status: 403 });
  }
  return null;
}

export function isDangerousRouteEnabled(envFlag: string): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env[envFlag] === "true";
}
