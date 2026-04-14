import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/integrations/supabase/server";
import { computeAccountState, isProtectedSystemAccount } from "@/lib/adminGovernance";

type AdminUserRow = {
  id: string;
  email: string | null;
  role: string | null;
  name: string | null;
  classLevel: number | null;
  stream: string | null;
  subjectCombo: string | null;
  rdm: number;
  streakMinutes: number;
  createdAt: string | null;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  suspendedUntil: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  deleteScheduledFor: string | null;
  isBanned: boolean;
  status: "active" | "suspended" | "banned" | "soft_deleted";
  canAct: boolean;
  actionLockedReason: string | null;
};

export async function GET(request: Request) {
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

    const url = new URL(request.url);
    const rawPage = Number(url.searchParams.get("page") ?? "1");
    const rawPerPage = Number(url.searchParams.get("perPage") ?? "200");
    const search = (url.searchParams.get("search") ?? "").trim().toLowerCase();
    const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;
    const perPage = Number.isFinite(rawPerPage) ? Math.max(1, Math.min(1000, Math.floor(rawPerPage))) : 200;

    const authRes = await admin.auth.admin.listUsers({ page, perPage });
    if (authRes.error) {
      return NextResponse.json({ error: authRes.error.message }, { status: 500 });
    }
    const authUsers = authRes.data.users ?? [];
    const userIds = authUsers.map((u) => u.id);

    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, role, name, class_level, stream, subject_combo, rdm")
      .in("id", userIds);
    if (profilesError) {
      return NextResponse.json({ error: profilesError.message }, { status: 500 });
    }

    const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
    const rows: AdminUserRow[] = authUsers
      .map((u) => {
        const p = profileById.get(u.id);
        const appMeta =
          u.app_metadata && typeof u.app_metadata === "object" && !Array.isArray(u.app_metadata)
            ? (u.app_metadata as Record<string, unknown>)
            : {};
        const suspendedUntil =
          typeof appMeta.admin_suspended_until === "string" ? appMeta.admin_suspended_until : null;
        const deletedAt = typeof appMeta.admin_deleted_at === "string" ? appMeta.admin_deleted_at : null;
        const deletedBy = typeof appMeta.admin_deleted_by === "string" ? appMeta.admin_deleted_by : null;
        const deleteScheduledFor =
          typeof appMeta.admin_delete_scheduled_for === "string"
            ? appMeta.admin_delete_scheduled_for
            : null;
        const bannedUntil = u.banned_until ?? null;
        const isBanned = Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());
        const status = computeAccountState({
          bannedUntil,
          appMetadata: appMeta,
        });
        const protectedSystem = isProtectedSystemAccount({
          email: u.email ?? null,
          role: p?.role ?? null,
        });
        const selfAccount = u.id === ctx.user.id;
        const canAct = !protectedSystem && !selfAccount;
        const actionLockedReason = selfAccount
          ? "Self account locked"
          : protectedSystem
            ? "Protected system account"
            : null;
        return {
          id: u.id,
          email: u.email ?? null,
          role: p?.role ?? null,
          name: p?.name ?? null,
          classLevel: p?.class_level ?? null,
          stream: p?.stream ?? null,
          subjectCombo: p?.subject_combo ?? null,
          rdm: Number(p?.rdm ?? 0),
          streakMinutes: 0,
          createdAt: u.created_at ?? null,
          lastSignInAt: u.last_sign_in_at ?? null,
          bannedUntil,
          suspendedUntil,
          deletedAt,
          deletedBy,
          deleteScheduledFor,
          isBanned,
          status,
          canAct,
          actionLockedReason,
        };
      })
      .filter((u) => {
        if (!search) return true;
        const hay = [u.email ?? "", u.name ?? "", u.role ?? "", u.stream ?? "", u.subjectCombo ?? ""]
          .join(" ")
          .toLowerCase();
        return hay.includes(search);
      });

    return NextResponse.json({
      users: rows,
      pagination: {
        page,
        perPage,
        total: authRes.data.total ?? rows.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
