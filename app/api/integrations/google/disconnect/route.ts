import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
async function revokeGoogleToken(token: string): Promise<void> {
  try {
    await fetch("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
    });
  } catch {
    /* best-effort */
  }
}

export async function POST(request: Request) {
  const headerAuth = request.headers.get("authorization") || "";
  const bearer = headerAuth.toLowerCase().startsWith("bearer ") ? headerAuth.slice(7).trim() : "";
  const supabase = bearer ? createClientWithToken(bearer) : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  const { data: row } = await admin
    .from("teacher_google_calendar_tokens")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (row?.refresh_token) {
    await revokeGoogleToken(row.refresh_token);
  }

  const { error: delErr } = await admin
    .from("teacher_google_calendar_tokens")
    .delete()
    .eq("user_id", user.id);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  const { error: profErr } = await admin
    .from("profiles")
    .update({ google_connected: false, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
