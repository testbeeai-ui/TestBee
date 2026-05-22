import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";

const HEARTBEAT_MS = 2 * 60 * 1000;

/** POST /api/user/gyan-presence — heartbeat while the user is on Gyan++ for Learning Buddy. */
export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    type GyanPresenceRow = { updated_at: string };

    const { data: existing } = await supabase
      .from("student_gyan_presence" as never)
      .select("updated_at")
      .eq("user_id" as never, user.id as never)
      .maybeSingle();

    const existingRow = existing as unknown as GyanPresenceRow | null;
    const now = new Date().toISOString();
    if (existingRow?.updated_at) {
      const ageMs = Date.now() - new Date(existingRow.updated_at).getTime();
      if (ageMs >= 0 && ageMs < HEARTBEAT_MS) {
        await supabase
          .from("student_gyan_presence" as never)
          .update({ updated_at: now } as never)
          .eq("user_id" as never, user.id as never);
        return NextResponse.json({
          ok: true,
          updatedAt: now,
          skipped: true,
        });
      }
    }
    const { error } = await supabase.from("student_gyan_presence" as never).upsert(
      { user_id: user.id, updated_at: now } as never,
      { onConflict: "user_id" }
    );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, updatedAt: now, skipped: false });
  } catch (e) {
    console.error("gyan-presence POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
