import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { event_name, event_data, page, session_id } = body;

    if (!event_name || typeof event_name !== "string") {
      return NextResponse.json({ error: "event_name required" }, { status: 400 });
    }

    // Insert via service role to bypass RLS (user already authenticated)
    const { createAdminClient } = await import("@/integrations/supabase/server");
    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "Server error" }, { status: 500 });
    }

    await (admin.from("student_events" as any) as any).insert({
      user_id: user.id,
      event_name: event_name.slice(0, 100), // cap length
      event_data: event_data ?? {},
      page: page?.slice(0, 500) ?? null,
      session_id: session_id?.slice(0, 100) ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
