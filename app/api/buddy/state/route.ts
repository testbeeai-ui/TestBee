import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/integrations/supabase/server";
import { listActiveBuddyPairsForUser } from "@/lib/buddy/activeBuddyLink";
import { BUDDY_MAX_ACTIVE } from "@/lib/buddy/buddyPrivacy";
import { normalizeBuddyRdm } from "@/lib/buddy/buddyClient";
import { requireAuthenticatedUser } from "@/lib/auth/securityGuards";

/** GET /api/buddy/state — active buddies (multi) and pending invites. */
export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const supabase = await createClient();
  const uid = auth.user.id;
  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set" },
      { status: 500 }
    );
  }

  const [pairsResult, invitesRes] = await Promise.all([
    listActiveBuddyPairsForUser(admin, uid),
    supabase
      .from("buddy_invites")
      .select("id, token, status, created_at, expires_at")
      .eq("inviter_user_id", uid)
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  if (pairsResult.error) {
    return NextResponse.json({ error: pairsResult.error }, { status: 500 });
  }
  if (invitesRes.error) {
    return NextResponse.json({ error: invitesRes.error.message }, { status: 500 });
  }

  const pairRows = pairsResult.pairs;
  const buddyIds = pairRows.map((r) => r.buddy_user_id);
  const buddies: Array<{
    id: string;
    name: string | null;
    avatarUrl: string | null;
    classLevel: number | null;
    rdm: number;
    pairedAt: string;
  }> = [];

  if (buddyIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, name, avatar_url, class_level, rdm")
      .in("id", buddyIds);

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

    for (const row of pairRows) {
      const profileRow = profileById.get(row.buddy_user_id);
      buddies.push({
        id: row.buddy_user_id,
        name: profileRow?.name ?? null,
        avatarUrl: profileRow?.avatar_url ?? null,
        classLevel:
          typeof profileRow?.class_level === "number" ? profileRow.class_level : null,
        rdm: normalizeBuddyRdm(profileRow?.rdm),
        pairedAt: row.created_at,
      });
    }
  }

  const buddy = buddies[0] ?? null;

  return NextResponse.json(
    {
    buddies,
    buddy,
    pendingInvites: (invitesRes.data ?? []).map((row) => ({
      id: row.id,
      token: row.token,
      status: row.status,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    })),
    maxBuddies: BUDDY_MAX_ACTIVE,
    },
    { headers: { "Cache-Control": "private, no-store, max-age=0" } }
  );
}
