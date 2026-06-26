import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { enforceSameOriginForCookieAuth } from "@/lib/auth/securityGuards";
import { createAdminClient } from "@/integrations/supabase/server";

export const runtime = "nodejs";

type Body = { email?: string };

/** Remove a pending invite so the teacher can add + resend again. */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const originBlock = enforceSameOriginForCookieAuth(request);
  if (originBlock) return originBlock;

  const ctx = await getSupabaseAndUser(request);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: classroomId } = await context.params;
  if (!classroomId?.trim()) {
    return NextResponse.json({ error: "Invalid classroom" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase() ?? "";
  if (!email) {
    return NextResponse.json({ error: "Email required" }, { status: 400 });
  }

  const { supabase, user } = ctx;
  const { data: classroom } = await supabase
    .from("classrooms")
    .select("id")
    .eq("id", classroomId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!classroom) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }

  const { data: row } = await admin
    .from("classroom_invite_recipients")
    .select("id, linked_user_id, paid_bonus_awarded_at")
    .eq("classroom_id", classroomId)
    .eq("email", email)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ ok: true, removed: false });
  }

  if (row.linked_user_id || row.paid_bonus_awarded_at) {
    return NextResponse.json(
      { error: "Cannot remove — student already joined or subscribed" },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("classroom_invite_recipients")
    .delete()
    .eq("id", row.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, removed: true });
}
