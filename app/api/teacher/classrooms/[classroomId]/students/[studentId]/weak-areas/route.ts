import { NextResponse } from "next/server";
import {
  createAdminClient,
  createClient,
  createClientWithToken,
} from "@/integrations/supabase/server";
import { parseBitsTestAttemptsStore } from "@/lib/play/bits/parseBitsTestAttemptsStore";

type WeakAreaRow = { topic: string; pct: number; answered: number };

function normalizeToken(input: string | null | undefined): string {
  return String(input ?? "")
    .trim()
    .replace(/^Bearer\s+/i, "");
}

function sanitizeText(value: unknown, maxLen = 140): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classroomId: string; studentId: string }> }
) {
  const { classroomId, studentId } = await params;
  if (!classroomId || !studentId) {
    return NextResponse.json({ error: "classroomId and studentId required" }, { status: 400 });
  }

  const bearer = normalizeToken(request.headers.get("authorization"));
  const supabase = bearer ? createClientWithToken(bearer) : await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server is missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  // Teacher authorization: must own the classroom.
  const { data: room, error: roomErr } = await admin
    .from("classrooms")
    .select("id, teacher_id")
    .eq("id", classroomId)
    .maybeSingle();
  if (roomErr || !room) return NextResponse.json({ error: "Classroom not found" }, { status: 404 });
  if (room.teacher_id !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify the student belongs to the classroom (prevents scraping other users).
  const { data: membership, error: memberErr } = await admin
    .from("classroom_members")
    .select("user_id, role")
    .eq("classroom_id", classroomId)
    .eq("user_id", studentId)
    .maybeSingle();
  if (memberErr || !membership) {
    return NextResponse.json({ error: "Student not found in classroom" }, { status: 404 });
  }
  if (membership.role === "teacher") {
    return NextResponse.json({ error: "Target must be a student" }, { status: 400 });
  }

  const { data: profile, error: profileErr } = await admin
    .from("profiles")
    .select("id, bits_test_attempts")
    .eq("id", studentId)
    .maybeSingle();
  if (profileErr || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const attempts = parseBitsTestAttemptsStore(
    (profile as { bits_test_attempts?: unknown }).bits_test_attempts
  );

  // Aggregate by topic, weighted by answered count.
  const byTopic = new Map<string, { correct: number; answered: number }>();
  for (const row of attempts) {
    const answered = Math.max(0, Number(row.correctCount) + Number(row.wrongCount));
    if (answered <= 0) continue;
    const topic = sanitizeText(row.topic, 80);
    if (!topic) continue;
    const existing = byTopic.get(topic) ?? { correct: 0, answered: 0 };
    existing.correct += Math.max(0, Number(row.correctCount) || 0);
    existing.answered += answered;
    byTopic.set(topic, existing);
  }

  const rows: WeakAreaRow[] = Array.from(byTopic.entries())
    .map(([topic, agg]) => {
      const pct = agg.answered > 0 ? Math.round((100 * agg.correct) / agg.answered) : 0;
      return { topic, pct, answered: agg.answered };
    })
    .filter((r) => r.answered >= 5) // ignore tiny samples
    .sort((a, b) => a.pct - b.pct);

  const weakAreas = rows.filter((r) => r.pct < 65).slice(0, 4);

  return NextResponse.json({ weakAreas, sampleSize: attempts.length });
}
