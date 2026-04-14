import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/integrations/supabase/server";

type Body = {
  userId?: string;
  banned?: boolean;
};

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
    const banned = Boolean(body.banned);
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    // Avoid locking out the currently logged-in admin performing the action.
    if (userId === ctx.user.id && banned) {
      return NextResponse.json({ error: "You cannot ban your own admin account" }, { status: 400 });
    }

    if (userId === ctx.user.id && banned) {
      return NextResponse.json({ error: "You cannot ban your own admin account" }, { status: 400 });
    }

    const { data, error } = await admin.auth.admin.updateUserById(userId, {
      ban_duration: banned ? "876000h" : "none",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      userId,
      banned,
      bannedUntil: data.user?.banned_until ?? null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
