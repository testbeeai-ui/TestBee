import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/integrations/supabase/server";

const BUCKET = "achievement-marksheets";

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const path =
      body &&
      typeof body === "object" &&
      "path" in body &&
      typeof (body as { path?: unknown }).path === "string"
        ? (body as { path: string }).path.trim()
        : "";

    if (!path || path.includes("..") || path.startsWith("/")) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 120);
    if (error || !data?.signedUrl) {
      return NextResponse.json(
        { error: error?.message ?? "Could not create signed URL" },
        { status: 500 }
      );
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (e) {
    console.error("[admin/student-achievements/marksheet-url] POST", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
