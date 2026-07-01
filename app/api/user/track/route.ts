import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { createAdminClient } from "@/integrations/supabase/server";

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx?.user) {
      // Anonymous visitors — no event row; avoid noisy 401 in dev/network tab.
      return new NextResponse(null, { status: 204 });
    }

    const body = await request.json();
    const { event_name, event_data, page, session_id } = body;

    if (!event_name || typeof event_name !== "string") {
      return NextResponse.json({ error: "event_name required" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    await (admin.from("student_events" as any) as any).insert({
      user_id: ctx.user.id,
      event_name: event_name.slice(0, 100),
      event_data: event_data ?? {},
      page: page?.slice(0, 500) ?? null,
      session_id: session_id?.slice(0, 100) ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
