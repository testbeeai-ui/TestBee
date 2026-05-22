import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/integrations/supabase/server";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";

/** GET /api/buddy/invite/[token] — public preview of an invite. */
export async function GET(
  _request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!token || token.length < 8) {
    return NextResponse.json({ error: "invalid_token" }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set" },
      { status: 500 }
    );
  }

  const { data: invite, error } = await admin
    .from("buddy_invites")
    .select(
      "id, token, inviter_user_id, status, created_at, accepted_at, expires_at"
    )
    .eq("token", token)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!invite) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let inviter: { id: string; name: string | null; avatarUrl: string | null } | null = null;
  if (invite.inviter_user_id) {
    const { data: profileRow } = await admin
      .from("profiles")
      .select("id, name, avatar_url")
      .eq("id", invite.inviter_user_id)
      .maybeSingle();
    if (profileRow) {
      inviter = {
        id: profileRow.id,
        name: profileRow.name ?? null,
        avatarUrl: profileRow.avatar_url ?? null,
      };
    }
  }

  const expiredByTime =
    invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now();
  const effectiveStatus = expiredByTime && invite.status === "pending" ? "expired" : invite.status;

  return NextResponse.json({
    ok: true,
    invite: {
      token: invite.token,
      status: effectiveStatus,
      createdAt: invite.created_at,
      acceptedAt: invite.accepted_at,
      expiresAt: invite.expires_at,
    },
    inviter,
  });
}

/** DELETE /api/buddy/invite/[token] — inviter revokes their own pending invite. */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ token: string }> }
) {
  const csrfFail = enforceSameOriginForCookieAuth(request);
  if (csrfFail) return csrfFail;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const { token } = await context.params;
  if (!token) return NextResponse.json({ error: "invalid_token" }, { status: 400 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buddy_invites")
    .update({ status: "revoked" })
    .eq("token", token)
    .eq("inviter_user_id", auth.user.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "not_found_or_finalized" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
