import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { SITE_PRESENCE_HEARTBEAT_MS } from "@/lib/dashboard/sitePresenceConstants";
import {
  clearSitePresenceBuffer,
  isSitePresenceBufferEnabled,
  touchSitePresenceBuffer,
} from "@/lib/presence/sitePresenceBuffer";

/** POST /api/user/site-presence — upsert site presence or handle explicit offline signal. */
export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    const body = (await request.json().catch(() => null)) as {
      offline?: boolean;
      /** Set on sign-out only — clears presence rows. Tab hide uses soft offline (no delete). */
      signedOut?: boolean;
    } | null;

    if (body?.offline) {
      await clearSitePresenceBuffer(user.id);
      await Promise.all([
        supabase
          .from("student_site_presence" as never)
          .delete()
          .eq("user_id" as never, user.id as never),
        supabase
          .from("student_learning_presence" as never)
          .delete()
          .eq("user_id" as never, user.id as never),
        supabase
          .from("student_gyan_presence" as never)
          .delete()
          .eq("user_id" as never, user.id as never),
      ]);
      return NextResponse.json({ ok: true, offline: true, cleared: true });
    }

    const now = new Date().toISOString();
    const useBuffer = isSitePresenceBufferEnabled();

    if (useBuffer) {
      await touchSitePresenceBuffer(user.id, now);
      return NextResponse.json({ ok: true, updatedAt: now, skipped: false, buffered: true });
    }

    const { data: existing } = await supabase
      .from("student_site_presence" as never)
      .select("updated_at")
      .eq("user_id" as never, user.id as never)
      .maybeSingle();

    const existingRow = existing as { updated_at: string } | null;
    if (existingRow?.updated_at) {
      const ageMs = Date.now() - new Date(existingRow.updated_at).getTime();
      if (ageMs >= 0 && ageMs < SITE_PRESENCE_HEARTBEAT_MS) {
        const { error: touchErr } = await supabase
          .from("student_site_presence" as never)
          .update({ updated_at: now } as never)
          .eq("user_id" as never, user.id as never);
        if (touchErr) return NextResponse.json({ error: touchErr.message }, { status: 500 });
        return NextResponse.json({ ok: true, updatedAt: now, skipped: true });
      }
    }

    const { error } = await supabase
      .from("student_site_presence" as never)
      .upsert({ user_id: user.id, updated_at: now } as never, { onConflict: "user_id" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, updatedAt: now, skipped: false });
  } catch (e) {
    console.error("site-presence POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
