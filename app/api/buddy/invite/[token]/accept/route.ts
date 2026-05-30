import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";

/** POST /api/buddy/invite/[token]/accept — accept the invite as the signed-in user. */
export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const csrfFail = enforceSameOriginForCookieAuth(request);
  if (csrfFail) return csrfFail;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const { token } = await context.params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const { data, error } = await admin.rpc("accept_buddy_invite", {
    p_token: token,
    p_acceptor_id: auth.user.id,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok !== true) {
    return NextResponse.json(
      { ok: false, error: String(payload.error ?? "accept_failed") },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, ...payload });
}
