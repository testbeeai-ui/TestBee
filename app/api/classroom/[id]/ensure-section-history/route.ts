import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient, createClientWithToken } from "@/integrations/supabase/server";

/**
 * Best-effort repair for temporal section history.
 * Ensures the authenticated student has an open `student_section_history` interval matching
 * their current `classroom_members.section_id` (or NULL for unassigned).
 *
 * This helps when membership/section changes happened before triggers existed or migrations were applied.
 */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: classroomId } = await ctx.params;
  if (!classroomId) return NextResponse.json({ error: "Classroom id required." }, { status: 400 });

  const headerAuth = request.headers.get("authorization") || "";
  const bearer = headerAuth.toLowerCase().startsWith("bearer ") ? headerAuth.slice(7).trim() : "";
  const supabase = bearer ? createClientWithToken(bearer) : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  // Ensure user is an actual member of the classroom (students only).
  const { data: member, error: memErr } = await admin
    .from("classroom_members")
    .select("user_id, role, joined_at, section_id")
    .eq("classroom_id", classroomId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (memErr || !member) return NextResponse.json({ error: "Not a member." }, { status: 403 });
  if ((member.role ?? "").toLowerCase() === "teacher")
    return NextResponse.json({ ok: true, skipped: "teacher" }, { status: 200 });

  const desiredSectionId = (member as { section_id?: string | null }).section_id ?? null;
  // joined_at in classroom_members is class enrollment time, not section-entry time.
  // For section intervals we treat the repair moment as the transfer timestamp (now),
  // so pending-exception logic behaves correctly.
  const joinedAt =
    desiredSectionId == null
      ? ((member as { joined_at?: string | null }).joined_at ?? new Date().toISOString())
      : new Date().toISOString();

  const { data: openRow } = await admin
    .from("student_section_history" as any)
    .select("id, section_id, joined_at")
    .eq("classroom_id", classroomId)
    .eq("user_id", user.id)
    .is("left_at", null)
    .maybeSingle();

  const openSectionId = (openRow as { section_id?: string | null } | null)?.section_id ?? null;
  if (openRow && openSectionId === desiredSectionId) {
    return NextResponse.json({ ok: true, repaired: false }, { status: 200 });
  }

  // Close any open interval(s) then open the desired interval.
  await admin
    .from("student_section_history" as any)
    .update({ left_at: new Date().toISOString() })
    .eq("classroom_id", classroomId)
    .eq("user_id", user.id)
    .is("left_at", null);

  const { error: insErr } = await admin.from("student_section_history" as any).insert({
    classroom_id: classroomId,
    user_id: user.id,
    section_id: desiredSectionId,
    joined_at: joinedAt,
    left_at: null,
  });
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, repaired: true }, { status: 200 });
}

