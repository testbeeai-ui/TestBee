import { NextResponse } from "next/server";
import { createAdminClient } from "@/integrations/supabase/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { parseTeacherProfileMetaFromBio } from "@/lib/profile/teacherProfileMeta";

/**
 * Lists classrooms for the Explore grid on /classrooms (students).
 * Uses the service role when SUPABASE_SERVICE_ROLE_KEY is set so listing works even if
 * client-side RLS policies are missing or misconfigured on the Supabase project.
 * Still requires a logged-in user. Hides classes whose teacher profile visibility is invite_only
 * (including when using the service role client).
 *
 * Auth: browser Supabase uses localStorage for the session, so cookie-only SSR auth is often empty.
 * Clients should send `Authorization: Bearer <access_token>`; getSupabaseAndUser falls back to that.
 */
export async function GET(request: Request) {
  try {
    const auth = await getSupabaseAndUser(request);
    if (!auth?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = createAdminClient();
    const db = admin ?? auth.supabase;

    // Supabase generated TS types may not include newly added columns yet (e.g. allow_adhoc_trial).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrow escape hatch until types are regenerated
    const { data: allClassrooms, error: cErr } = await (db as any)
      .from("classrooms")
      .select("id, name, subject, section, description, type, teacher_id, allow_adhoc_trial")
      .order("created_at", { ascending: false });

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    type Row = {
      id: string;
      name: string;
      subject: string | null;
      section: string | null;
      description: string | null;
      type: string;
      teacher_id: string;
      allow_adhoc_trial?: boolean | null;
    };

    const list = (allClassrooms ?? []) as Row[];
    if (list.length === 0) {
      return NextResponse.json({ classrooms: [] });
    }

    const teacherIds = [...new Set(list.map((c) => c.teacher_id))];
    type TeacherProfileRow = {
      id: string;
      name: string | null;
      visibility: string;
      avatar_url: string | null;
      bio: string | null;
      subjects: string[] | null;
      exam_tags: string[] | null;
      teaching_levels: number[] | null;
    };
    type TeacherDetailsRow = {
      teacher_id: string;
      location: string | null;
      qualification: string | null;
      experience: string | null;
      verification_status: string | null;
    };
    const profileMap = new Map<string, TeacherProfileRow>();
    const detailsMap = new Map<string, TeacherDetailsRow>();

    if (teacherIds.length > 0) {
      const { data: teacherProfiles, error: pErr } = await db
        .from("profiles")
        .select("id, name, visibility, avatar_url, bio, subjects, exam_tags, teaching_levels")
        .in("id", teacherIds);

      if (pErr) {
        return NextResponse.json({ error: pErr.message }, { status: 500 });
      }
      (teacherProfiles ?? []).forEach((p) => profileMap.set(p.id, p as TeacherProfileRow));

      // Public profile preview fields only; do not expose private email/phone/doc links here.
      const { data: teacherDetails } = await (
        db as unknown as {
          from: (table: "teacher_profile_details") => {
            select: (columns: string) => {
              in: (
                column: "teacher_id",
                values: string[]
              ) => PromiseLike<{ data: TeacherDetailsRow[] | null }>;
            };
          };
        }
      )
        .from("teacher_profile_details")
        .select("teacher_id, location, qualification, experience, verification_status")
        .in("teacher_id", teacherIds);
      (teacherDetails ?? []).forEach((p: TeacherDetailsRow) => detailsMap.set(p.teacher_id, p));
    }

    const withTeacher = list
      .map((c) => {
        const p = profileMap.get(c.teacher_id);
        const details = detailsMap.get(c.teacher_id);
        const profileMeta = parseTeacherProfileMetaFromBio(p?.bio);
        const metaDetails = profileMeta.details;
        return {
          ...c,
          teacher_name: p?.name ?? null,
          teacher_visibility: p?.visibility ?? null,
          teacher_avatar_url: p?.avatar_url ?? null,
          teacher_bio: profileMeta.studentBio || null,
          teacher_subjects: p?.subjects ?? null,
          teacher_exam_tags: p?.exam_tags ?? null,
          teacher_teaching_levels: p?.teaching_levels ?? null,
          teacher_location: details?.location ?? metaDetails.location ?? null,
          teacher_qualification: details?.qualification ?? metaDetails.qualification ?? null,
          teacher_experience: details?.experience ?? metaDetails.experience ?? null,
          teacher_verification_status: details?.verification_status ?? null,
        };
      })
      .filter((c) => c.teacher_visibility !== "invite_only")
      // Reliable: if teacher disables trial access, hide from Explore list.
      .filter((c) => c.allow_adhoc_trial !== false);

    const classroomIds = withTeacher.map((c) => c.id);
    const ratingMap = new Map<string, { sum: number; count: number }>();

    if (classroomIds.length > 0) {
      // `classroom_reviews` exists in Postgres (see migrations) but may be absent from generated TS types.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- narrow escape hatch until types include this table
      const { data: reviewData } = await (db as any)
        .from("classroom_reviews")
        .select("classroom_id, rating")
        .in("classroom_id", classroomIds);

      (reviewData ?? []).forEach((r: { classroom_id: string; rating: number }) => {
        const existing = ratingMap.get(r.classroom_id) ?? { sum: 0, count: 0 };
        existing.sum += r.rating;
        existing.count += 1;
        ratingMap.set(r.classroom_id, existing);
      });
    }

    const classrooms = withTeacher.map((c) => {
      const stats = ratingMap.get(c.id);
      if (!stats) {
        return {
          ...c,
          avg_rating: undefined as number | undefined,
          review_count: undefined as number | undefined,
        };
      }
      return {
        ...c,
        avg_rating: Math.round((stats.sum / stats.count) * 10) / 10,
        review_count: stats.count,
      };
    });

    return NextResponse.json({ classrooms });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
