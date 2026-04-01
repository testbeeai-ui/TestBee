import { NextResponse } from 'next/server';
import { createAdminClient } from '@/integrations/supabase/server';
import { getSupabaseAndUser } from '@/lib/apiAuth';

/**
 * Lists classrooms for the Explore grid on /classrooms (students).
 * Uses the service role when SUPABASE_SERVICE_ROLE_KEY is set so listing works even if
 * client-side RLS policies are missing or misconfigured on the Supabase project.
 * Still requires a logged-in user. Hides classes whose teacher profile visibility is invite_only.
 *
 * Auth: browser Supabase uses localStorage for the session, so cookie-only SSR auth is often empty.
 * Clients should send `Authorization: Bearer <access_token>`; getSupabaseAndUser falls back to that.
 */
export async function GET(request: Request) {
  try {
    const auth = await getSupabaseAndUser(request);
    if (!auth?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    const db = admin ?? auth.supabase;
    /** Service role can read all rows; visibility filter is only for user-JWT (RLS-aligned) browsing. */
    const skipInviteOnlyFilter = !!admin;

    const { data: allClassrooms, error: cErr } = await db
      .from('classrooms')
      .select('id, name, subject, section, description, type, teacher_id')
      .order('created_at', { ascending: false });

    if (cErr) {
      return NextResponse.json({ error: cErr.message }, { status: 500 });
    }

    const list = allClassrooms ?? [];
    if (list.length === 0) {
      return NextResponse.json({ classrooms: [] });
    }

    const teacherIds = [...new Set(list.map((c) => c.teacher_id))];
    const profileMap = new Map<string, { id: string; name: string | null; visibility: string }>();

    if (teacherIds.length > 0) {
      const { data: teacherProfiles, error: pErr } = await db
        .from('profiles')
        .select('id, name, visibility')
        .in('id', teacherIds);

      if (pErr) {
        return NextResponse.json({ error: pErr.message }, { status: 500 });
      }
      (teacherProfiles ?? []).forEach((p) => profileMap.set(p.id, p));
    }

    type Row = (typeof list)[number];
    const withTeacher = list
      .map((c: Row) => {
        const p = profileMap.get(c.teacher_id);
        return {
          ...c,
          teacher_name: p?.name ?? null,
          teacher_visibility: p?.visibility ?? null,
        };
      })
      .filter((c) => skipInviteOnlyFilter || c.teacher_visibility !== 'invite_only');

    const classroomIds = withTeacher.map((c) => c.id);
    const ratingMap = new Map<string, { sum: number; count: number }>();

    if (classroomIds.length > 0) {
      const { data: reviewData } = await (db as any)
        .from('classroom_reviews')
        .select('classroom_id, rating')
        .in('classroom_id', classroomIds);

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
        return { ...c, avg_rating: undefined as number | undefined, review_count: undefined as number | undefined };
      }
      return {
        ...c,
        avg_rating: Math.round((stats.sum / stats.count) * 10) / 10,
        review_count: stats.count,
      };
    });

    return NextResponse.json({ classrooms });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
