import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import {
  computeAccountState,
  futureIsoFromDays,
  isProtectedSystemAccount,
  parseGovernanceMeta,
} from "@/lib/adminGovernance";

type ActionType =
  | "ban"
  | "unban"
  | "suspend"
  | "unsuspend"
  | "soft_delete"
  | "restore";

type Body = {
  userId?: string;
  action?: ActionType;
  reason?: string;
  suspendDays?: number;
};

function parseAction(value: unknown): ActionType | null {
  if (typeof value !== "string") return null;
  const allowed: ActionType[] = ["ban", "unban", "suspend", "unsuspend", "soft_delete", "restore"];
  return allowed.includes(value as ActionType) ? (value as ActionType) : null;
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const body = (await request.json()) as Body;
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const action = parseAction(body.action);
    const reason = typeof body.reason === "string" ? body.reason.slice(0, 500) : "";
    const suspendDays = Number.isFinite(body.suspendDays)
      ? Math.max(1, Math.min(365, Math.floor(Number(body.suspendDays))))
      : 7;

    if (!userId || !action) {
      return NextResponse.json({ error: "userId and valid action are required" }, { status: 400 });
    }
    if (userId === ctx.user.id) {
      return NextResponse.json({ error: "You cannot apply governance actions on your own account" }, { status: 400 });
    }

    const getUserRes = await admin.auth.admin.getUserById(userId);
    if (getUserRes.error || !getUserRes.data.user) {
      return NextResponse.json({ error: getUserRes.error?.message || "User not found" }, { status: 404 });
    }
    const target = getUserRes.data.user;
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();
    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    if (
      isProtectedSystemAccount({
        email: target.email ?? null,
        role: profile?.role ?? null,
      })
    ) {
      return NextResponse.json({ error: "Protected system accounts cannot be modified" }, { status: 403 });
    }

    const oldMeta = parseGovernanceMeta(target.app_metadata);
    const oldState = computeAccountState({
      bannedUntil: target.banned_until,
      appMetadata: oldMeta,
    });

    const nextMeta = { ...oldMeta };
    let banDuration: string | undefined;

    if (action === "ban") {
      banDuration = "876000h";
    } else if (action === "unban") {
      banDuration = "none";
    } else if (action === "suspend") {
      nextMeta.admin_suspended_until = futureIsoFromDays(suspendDays);
      nextMeta.admin_soft_deleted = false;
      nextMeta.admin_deleted_at = null;
      nextMeta.admin_deleted_by = null;
    } else if (action === "unsuspend") {
      nextMeta.admin_suspended_until = null;
    } else if (action === "soft_delete") {
      nextMeta.admin_soft_deleted = true;
      nextMeta.admin_deleted_at = new Date().toISOString();
      nextMeta.admin_deleted_by = ctx.user.id;
      nextMeta.admin_delete_scheduled_for = futureIsoFromDays(7);
      nextMeta.admin_suspended_until = null;
      banDuration = "none";
    } else if (action === "restore") {
      nextMeta.admin_soft_deleted = false;
      nextMeta.admin_deleted_at = null;
      nextMeta.admin_deleted_by = null;
      nextMeta.admin_delete_scheduled_for = null;
      nextMeta.admin_suspended_until = null;
      banDuration = "none";
    }

    const updatePayload: Record<string, unknown> = {
      app_metadata: nextMeta,
    };
    if (banDuration !== undefined) updatePayload.ban_duration = banDuration;

    const updateRes = await admin.auth.admin.updateUserById(userId, updatePayload);
    if (updateRes.error || !updateRes.data.user) {
      return NextResponse.json({ error: updateRes.error?.message || "Failed to update user" }, { status: 500 });
    }

    const updated = updateRes.data.user;
    const newMeta = parseGovernanceMeta(updated.app_metadata);
    const newState = computeAccountState({
      bannedUntil: updated.banned_until,
      appMetadata: newMeta,
    });

    // Audit log insert (best effort).
    const adminAny = admin as unknown as {
      from: (table: string) => { insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }> };
    };
    await adminAny.from("admin_user_actions").insert({
      target_user_id: userId,
      actor_user_id: ctx.user.id,
      action_type: action,
      reason: reason || null,
      old_state: {
        status: oldState,
        banned_until: target.banned_until ?? null,
        app_metadata: oldMeta,
      },
      new_state: {
        status: newState,
        banned_until: updated.banned_until ?? null,
        app_metadata: newMeta,
      },
    });

    return NextResponse.json({
      ok: true,
      action,
      userId,
      oldStatus: oldState,
      newStatus: newState,
      bannedUntil: updated.banned_until ?? null,
      suspendedUntil:
        typeof newMeta.admin_suspended_until === "string" ? newMeta.admin_suspended_until : null,
      deletedAt: typeof newMeta.admin_deleted_at === "string" ? newMeta.admin_deleted_at : null,
      deleteScheduledFor:
        typeof newMeta.admin_delete_scheduled_for === "string"
          ? newMeta.admin_delete_scheduled_for
          : null,
      changedAt: new Date().toISOString(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
