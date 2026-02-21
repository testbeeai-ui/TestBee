import { NextResponse } from 'next/server';
import { createClient } from '@/integrations/supabase/server';
import { createAdminClient } from '@/integrations/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      classroom_id: classroomId,
      title,
      scheduled_at: scheduledAt,
      duration_minutes: durationMinutes,
      meet_link: meetLink,
    } = body;

    if (!classroomId || !title?.trim() || !scheduledAt || typeof durationMinutes !== 'number') {
      return NextResponse.json(
        { error: 'classroom_id, title, scheduled_at, and duration_minutes required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    let user = (await supabase.auth.getUser()).data?.user ?? null;
    if (!user && token) {
      const { data: { user: u } } = await supabase.auth.getUser(token);
      user = u ?? null;
    }
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Use admin so classroom is found when API is called with Bearer token (no cookie session)
    const { data: classroom } = await admin
      .from('classrooms')
      .select('id, teacher_id')
      .eq('id', classroomId)
      .single();

    if (!classroom || classroom.teacher_id !== user.id) {
      return NextResponse.json({ error: 'Only the class teacher can schedule a live session' }, { status: 403 });
    }

    const { data: session, error: sessionError } = await admin
      .from('live_sessions')
      .insert({
        classroom_id: classroomId,
        teacher_id: user.id,
        title: title.trim(),
        scheduled_at: scheduledAt,
        duration_minutes: durationMinutes,
        meet_link: meetLink ?? null,
        status: 'scheduled',
      })
      .select('id, title, scheduled_at, duration_minutes, meet_link, status')
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: sessionError?.message ?? 'Failed to create session' },
        { status: 500 }
      );
    }

    // Live sessions are separate from Posts: they appear only in the Live tab, not as posts.
    return NextResponse.json({ session });
  } catch (e) {
    console.error('live schedule error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
