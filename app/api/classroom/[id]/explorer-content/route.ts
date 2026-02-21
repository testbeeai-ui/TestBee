import { NextResponse } from 'next/server';
import { createClient } from '@/integrations/supabase/server';
import { createAdminClient } from '@/integrations/supabase/server';

const EXPLORATION_MINUTES = 10;

/** Returns posts and live_sessions for explorers (bypasses RLS). Ensures explorers always see content. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: classroomId } = await params;
  if (!classroomId) {
    return NextResponse.json({ error: 'Classroom id required' }, { status: 400 });
  }

  const supabase = await createClient();
  let user = (await supabase.auth.getUser()).data?.user ?? null;
  if (!user) {
    const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (token) {
      const { data: { user: u } } = await supabase.auth.getUser(token);
      user = u ?? null;
    }
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const { data: classroom } = await admin
    .from('classrooms')
    .select('id, teacher_id')
    .eq('id', classroomId)
    .maybeSingle();

  if (!classroom) {
    return NextResponse.json({ error: 'Classroom not found' }, { status: 404 });
  }

  if (classroom.teacher_id === user.id) {
    return NextResponse.json({ error: 'Use direct access' }, { status: 400 });
  }

  const { data: member } = await admin
    .from('classroom_members')
    .select('user_id')
    .eq('classroom_id', classroomId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (member) {
    return NextResponse.json({ error: 'Members use direct access' }, { status: 400 });
  }

  const { data: exploration } = await admin
    .from('class_exploration_sessions')
    .select('started_at')
    .eq('user_id', user.id)
    .eq('classroom_id', classroomId)
    .maybeSingle();

  if (!exploration?.started_at) {
    return NextResponse.json({ error: 'No active exploration' }, { status: 403 });
  }

  const startedAt = new Date(exploration.started_at).getTime();
  const expiresAt = startedAt + EXPLORATION_MINUTES * 60 * 1000;
  if (Date.now() >= expiresAt) {
    return NextResponse.json({ error: 'Exploration ended' }, { status: 403 });
  }

  const [postsRes, sessionsRes] = await Promise.all([
    admin
      .from('posts')
      .select('*, profiles!posts_teacher_id_fkey(name)')
      .eq('classroom_id', classroomId)
      .order('created_at', { ascending: false }),
    admin
      .from('live_sessions')
      .select('id, title, scheduled_at, duration_minutes, meet_link, status')
      .eq('classroom_id', classroomId)
      .order('scheduled_at', { ascending: true }),
  ]);

  if (postsRes.error) {
    return NextResponse.json({ error: postsRes.error.message }, { status: 500 });
  }
  if (sessionsRes.error) {
    return NextResponse.json({ error: sessionsRes.error.message }, { status: 500 });
  }

  return NextResponse.json({
    posts: postsRes.data ?? [],
    liveSessions: sessionsRes.data ?? [],
  });
}
