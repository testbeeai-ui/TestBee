import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { createAdminClient, createClient } from "@/integrations/supabase/server";
import { listActiveBuddyPairsForUser } from "@/lib/buddy/activeBuddyLink";
import { resolveMaxBuddiesForUserId } from "@/lib/buddy/buddyPlanLimits";
import {
  enforceSameOriginForCookieAuth,
  requireAuthenticatedUser,
} from "@/lib/auth/securityGuards";

function generateInviteToken(): string {
  return randomBytes(9).toString("base64url");
}

function buildShareUrl(request: Request, token: string): string {
  const origin = request.headers.get("origin");
  if (origin) return `${origin}/buddy-join/${token}`;
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "edublast.in";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/buddy-join/${token}`;
}

function buildWaText(inviterName: string | null, shareUrl: string): string {
  const who = inviterName?.trim() ? inviterName.trim() : "I";
  return [
    `${who} on EduBlast wants to learn with you as a Study Buddy.`,
    `Track each other's progress and earn together.`,
    "",
    "Join here:",
    shareUrl,
  ].join("\n");
}

/** POST /api/buddy/invite — create an invite token for the signed-in user. */
export async function POST(request: Request) {
  const csrfFail = enforceSameOriginForCookieAuth(request);
  if (csrfFail) return csrfFail;

  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const supabase = await createClient();
  const uid = auth.user.id;

  const { data: profileRow, error: profileErr } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", uid)
    .maybeSingle();
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
  }

  const [pairsResult, buddyLimit] = await Promise.all([
    listActiveBuddyPairsForUser(admin, uid),
    resolveMaxBuddiesForUserId(admin as unknown as Parameters<typeof resolveMaxBuddiesForUserId>[0], uid),
  ]);
  if (pairsResult.error) {
    return NextResponse.json({ error: pairsResult.error }, { status: 500 });
  }
  if (buddyLimit.rawLimit === 0) {
    return NextResponse.json(
      { error: "Learning buddies are not available on your current plan." },
      { status: 403 }
    );
  }
  if (pairsResult.pairs.length >= buddyLimit.effectiveCap) {
    return NextResponse.json(
      {
        error: `Active learning buddy limit reached (${buddyLimit.unlimited ? "unlimited" : buddyLimit.rawLimit}). End a buddy pair before inviting another.`,
      },
      { status: 403 }
    );
  }

  let lastError: string | null = null;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = generateInviteToken();
    const { data: inserted, error } = await supabase
      .from("buddy_invites")
      .insert({ inviter_user_id: uid, token, status: "pending" })
      .select("id, token, created_at, expires_at, status")
      .maybeSingle();
    if (!error && inserted) {
      const shareUrl = buildShareUrl(request, inserted.token);
      return NextResponse.json({
        ok: true,
        invite: inserted,
        shareUrl,
        waText: buildWaText(profileRow?.name ?? null, shareUrl),
      });
    }
    lastError = error?.message ?? null;
    if (error && error.code !== "23505") break;
  }

  return NextResponse.json({ error: lastError ?? "Failed to create invite" }, { status: 500 });
}
