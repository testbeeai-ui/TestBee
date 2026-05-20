import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAssignmentTaskKind, type AssignmentTaskKind } from "@/lib/classroom/assignmentTasks";
import { syncAssignmentTasksForKinds } from "@/lib/classroom/syncAssignmentTaskProgress";

/** POST { kinds: AssignmentTaskKind[] } — best-effort sync after in-app activity (Daily Gauntlet, etc.). */
export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const rawKinds = (body as { kinds?: unknown }).kinds;
    const kinds: AssignmentTaskKind[] = Array.isArray(rawKinds)
      ? rawKinds.filter(isAssignmentTaskKind)
      : [];
    if (kinds.length === 0) {
      return NextResponse.json(
        { error: "kinds must be a non-empty array of valid task kinds" },
        { status: 400 }
      );
    }

    const result = await syncAssignmentTasksForKinds(supabase, user.id, kinds);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    console.error("[assignment-task-sync]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
