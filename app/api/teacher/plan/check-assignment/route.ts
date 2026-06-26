import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import { assertTeacherCanCreateAssignment } from "@/lib/teacherPortal/teacherPlanServer";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const originBlock = enforceSameOriginForCookieAuth(request);
  if (originBlock) return originBlock;

  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, supabase } = ctx;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "teacher") {
    return NextResponse.json({ error: "Teachers only" }, { status: 403 });
  }

  const check = await assertTeacherCanCreateAssignment(user.id);
  if (!check.ok) {
    return NextResponse.json({ error: check.error, code: check.code }, { status: 403 });
  }

  return NextResponse.json({ ok: true, remaining: check.remaining });
}
