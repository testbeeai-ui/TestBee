import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { createClient } from "@/integrations/supabase/server";

export const runtime = "nodejs";

function teacherDisplayName(profile: {
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
} | null): string | null {
  if (!profile) return null;
  const combined = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
  return combined || profile.name?.trim() || null;
}

/** Public classroom preview by join code (for /join before sign-in). */
export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code")?.trim().toUpperCase() ?? "";
  if (code.length < 6) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lookup_classroom_by_join_code", {
    p_code: code,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const payload = data as {
    ok?: boolean;
    classroom?: { teacher_id?: string } | null;
    error?: string;
  } | null;

  if (!payload?.ok) {
    return NextResponse.json({ error: payload?.error ?? "Lookup failed" }, { status: 400 });
  }

  if (!payload.classroom) {
    return NextResponse.json({ classroom: null, teacherName: null });
  }

  let teacherName: string | null = null;
  const teacherId = payload.classroom.teacher_id;
  if (teacherId) {
    const admin = createAdminClient();
    if (admin) {
      const { data: teacher } = await admin
        .from("profiles")
        .select("name, first_name, last_name")
        .eq("id", teacherId)
        .maybeSingle();
      teacherName = teacherDisplayName(teacher);
    }
  }

  return NextResponse.json({
    classroom: payload.classroom,
    teacherName,
  });
}
