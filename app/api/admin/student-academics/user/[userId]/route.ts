import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import { createAdminClient } from "@/integrations/supabase/server";

function rowMatchesClassX(exam: string): boolean {
  const e = (exam || "").toLowerCase();
  return e.includes("class x") || e.includes("class 10");
}
function rowMatchesClassXI(exam: string): boolean {
  const e = (exam || "").toLowerCase();
  return e.includes("puc i") || e.includes("class xi") || e.includes("class 11");
}
function rowMatchesClassXII(exam: string): boolean {
  const e = (exam || "").toLowerCase();
  return e.includes("puc ii") || e.includes("class xii") || e.includes("class 12");
}

function parseSubjects(raw: Record<string, unknown> | null): {
  physicsScience?: string;
  mathematics?: string;
  chemistry?: string;
  english?: string;
  socialScience?: string;
  secondLanguage?: string;
} | null {
  if (!raw) return null;
  return {
    physicsScience: typeof raw.physicsScience === "string" ? raw.physicsScience : undefined,
    mathematics: typeof raw.mathematics === "string" ? raw.mathematics : undefined,
    chemistry: typeof raw.chemistry === "string" ? raw.chemistry : undefined,
    english: typeof raw.english === "string" ? raw.english : undefined,
    socialScience: typeof raw.socialScience === "string" ? raw.socialScience : undefined,
    secondLanguage: typeof raw.secondLanguage === "string" ? raw.secondLanguage : undefined,
  };
}

function parseCoaching(
  raw: Record<string, unknown> | null
): { instituteName?: string; attendingSince?: string } | null {
  if (!raw) return null;
  return {
    instituteName: typeof raw.instituteName === "string" ? raw.instituteName : undefined,
    attendingSince: typeof raw.attendingSince === "string" ? raw.attendingSince : undefined,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const { userId } = await params;
    if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

    const [{ data: profile, error: profileError }, { data: academics, error: academicsError }] =
      await Promise.all([
        admin
          .from("profiles")
          .select("id, name, academic_record_extras")
          .eq("id", userId)
          .maybeSingle(),
        admin
          .from("profile_academics")
          .select("exam, board, score, verified, academic_year")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
      ]);

    if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });
    if (academicsError)
      return NextResponse.json({ error: academicsError.message }, { status: 500 });

    const classX = (academics ?? []).find((a) => rowMatchesClassX(a.exam));
    const classXI = (academics ?? []).find((a) => rowMatchesClassXI(a.exam));
    const classXII = (academics ?? []).find((a) => rowMatchesClassXII(a.exam));
    const extras =
      profile?.academic_record_extras && typeof profile.academic_record_extras === "object"
        ? (profile.academic_record_extras as Record<string, unknown>)
        : null;
    const classXSubjectsRaw =
      extras?.classXSubjects && typeof extras.classXSubjects === "object"
        ? (extras.classXSubjects as Record<string, unknown>)
        : null;
    const classXISubjectsRaw =
      extras?.classXISubjects && typeof extras.classXISubjects === "object"
        ? (extras.classXISubjects as Record<string, unknown>)
        : null;
    const classXIISubjectsRaw =
      extras?.classXIISubjects && typeof extras.classXIISubjects === "object"
        ? (extras.classXIISubjects as Record<string, unknown>)
        : null;
    const coachingRaw =
      extras?.coaching && typeof extras.coaching === "object"
        ? (extras.coaching as Record<string, unknown>)
        : null;
    const coachingXiRaw =
      extras?.coachingXI && typeof extras.coachingXI === "object"
        ? (extras.coachingXI as Record<string, unknown>)
        : null;
    const coachingXiiRaw =
      extras?.coachingXII && typeof extras.coachingXII === "object"
        ? (extras.coachingXII as Record<string, unknown>)
        : null;

    return NextResponse.json({
      user_id: userId,
      student_name: profile?.name ?? null,
      classX: classX
        ? {
            board: classX.board ?? null,
            year: classX.academic_year ?? null,
            score: classX.score ?? null,
            verified: classX.verified ?? null,
          }
        : null,
      classXI: classXI
        ? {
            board: classXI.board ?? null,
            year: classXI.academic_year ?? null,
            score: classXI.score ?? null,
            verified: classXI.verified ?? null,
          }
        : null,
      classXII: classXII
        ? {
            board: classXII.board ?? null,
            year: classXII.academic_year ?? null,
            score: classXII.score ?? null,
            verified: classXII.verified ?? null,
          }
        : null,
      classXSubjects: parseSubjects(classXSubjectsRaw),
      classXISubjects: parseSubjects(classXISubjectsRaw),
      classXIISubjects: parseSubjects(classXIISubjectsRaw),
      coaching: parseCoaching(coachingRaw),
      coachingXI: parseCoaching(coachingXiRaw),
      coachingXII: parseCoaching(coachingXiiRaw),
      puc2InternalsPercent:
        extras && typeof extras.puc2InternalsPercent === "string"
          ? extras.puc2InternalsPercent
          : undefined,
    });
  } catch (e) {
    console.error("[admin/student-academics/user/:userId] GET", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
