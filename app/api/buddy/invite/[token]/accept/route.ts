import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { resolveMaxBuddiesForUserId } from "@/lib/buddy/buddyPlanLimits";
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

  const { data: inviteRow, error: inviteErr } = await admin
    .from("buddy_invites")
    .select("inviter_user_id")
    .eq("token", token)
    .maybeSingle();
  if (inviteErr) return NextResponse.json({ error: inviteErr.message }, { status: 500 });
  if (!inviteRow?.inviter_user_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const [acceptorLimit, inviterLimit] = await Promise.all([
    resolveMaxBuddiesForUserId(admin as unknown as Parameters<typeof resolveMaxBuddiesForUserId>[0], auth.user.id),
    resolveMaxBuddiesForUserId(
      admin as unknown as Parameters<typeof resolveMaxBuddiesForUserId>[0],
      inviteRow.inviter_user_id
    ),
  ]);

  const { data, error } = await admin.rpc("accept_buddy_invite", {
    p_token: token,
    p_acceptor_id: auth.user.id,
    p_acceptor_max: acceptorLimit.effectiveCap,
    p_inviter_max: inviterLimit.effectiveCap,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const payload = (data ?? {}) as Record<string, unknown>;
  if (payload.ok !== true) {
    const code = String(payload.error ?? "accept_failed");
    const status =
      code === "acceptor_buddy_limit" || code === "inviter_buddy_limit" ? 403 : 400;
    return NextResponse.json({ ok: false, error: code }, { status });
  }

  return NextResponse.json({ ok: true, ...payload });
}
