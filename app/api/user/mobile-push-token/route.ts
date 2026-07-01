import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";

const PLATFORMS = new Set(["android", "ios", "web"]);

type RegisterBody = {
  token?: string;
  platform?: string;
};

/** GET — list registered push tokens for the signed-in user (ids only, for settings UI). */
export async function GET(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await auth.supabase
    .from("mobile_push_tokens")
    .select("token, platform, updated_at")
    .eq("user_id", auth.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    tokens: (data ?? []).map((row) => ({
      platform: row.platform,
      updatedAt: row.updated_at,
      tokenSuffix: row.token.slice(-8),
    })),
  });
}

/** POST — register or refresh an Expo push token for this device. */
export async function POST(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  const platform = typeof body.platform === "string" ? body.platform.trim().toLowerCase() : "";

  if (!token || token.length < 20) {
    return NextResponse.json({ error: "Invalid push token" }, { status: 400 });
  }
  if (!PLATFORMS.has(platform)) {
    return NextResponse.json({ error: "Invalid platform" }, { status: 400 });
  }

  const { error } = await auth.supabase.from("mobile_push_tokens").upsert(
    {
      user_id: auth.user.id,
      token,
      platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,token" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** DELETE — unregister a push token (body: { token }). */
export async function DELETE(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = typeof body.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Token required" }, { status: 400 });
  }

  const { error } = await auth.supabase
    .from("mobile_push_tokens")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("token", token);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
