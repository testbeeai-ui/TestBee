import { NextResponse } from 'next/server';
import { createClient } from '@/integrations/supabase/server';
import { createAdminClient } from '@/integrations/supabase/server';

const JOIN_FROM_MINUTES_BEFORE = 30;
const EXPLORATION_MINUTES = 10;
const EXPLORER_LIVE_MINUTES = 8;

function getRoomNameFromMeetLink(meetLink: string): string {
  try {
    const path = new URL(meetLink).pathname.replace(/^\/+|\/+$/g, '') || 'EduBlast';
    return path;
  } catch {
    return meetLink.replace(/^https?:\/\/[^/]+\/?/, '').replace(/\/+$/, '') || 'EduBlast';
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const sessionId = body?.sessionId ?? body?.session_id;
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
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

    // Load session with admin so RLS doesn't hide it from students (we verify membership below)
    const { data: session, error: sessionError } = await admin
      .from('live_sessions')
      .select('id, meet_link, classroom_id, teacher_id, scheduled_at, duration_minutes')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const { data: member } = await admin
      .from('classroom_members')
      .select('user_id')
      .eq('classroom_id', session.classroom_id)
      .eq('user_id', user.id)
      .maybeSingle();

    const startMs = new Date(session.scheduled_at).getTime();
    const joinFromMs = startMs - JOIN_FROM_MINUTES_BEFORE * 60 * 1000;
    const joinUntilMs = startMs + (session.duration_minutes + 15) * 60 * 1000;
    const now = Date.now();
    if (now < joinFromMs) {
      return NextResponse.json(
        { error: 'You can only join from 30 minutes before the class starts' },
        { status: 400 }
      );
    }
    if (now > joinUntilMs) {
      return NextResponse.json({ error: 'This class has ended' }, { status: 400 });
    }

    if (!session.meet_link) {
      return NextResponse.json({ error: 'No meeting link for this session' }, { status: 404 });
    }

    const roomName = getRoomNameFromMeetLink(session.meet_link);

    if (member) {
      const { data: existingJoin } = await admin
        .from('live_session_joins')
        .select('id')
        .eq('session_id', sessionId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!existingJoin) {
        await admin.from('live_session_joins').insert({
          session_id: sessionId,
          user_id: user.id,
          credits_deducted: 0,
        });
      }
      return NextResponse.json({ roomName });
    }

    const { data: exploration } = await admin
      .from('class_exploration_sessions')
      .select('started_at')
      .eq('user_id', user.id)
      .eq('classroom_id', session.classroom_id)
      .maybeSingle();

    if (!exploration?.started_at) {
      return NextResponse.json({ error: 'Not a member of this class' }, { status: 403 });
    }
    const explorationEndsAt = new Date(exploration.started_at).getTime() + EXPLORATION_MINUTES * 60 * 1000;
    if (now >= explorationEndsAt) {
      return NextResponse.json({ error: 'Your class exploration time has ended. Request to join for full access.' }, { status: 403 });
    }

    const { data: existingExplorerJoin } = await admin
      .from('explorer_live_joins')
      .select('joined_at')
      .eq('session_id', sessionId)
      .eq('user_id', user.id)
      .maybeSingle();

    let explorerJoinedAt = existingExplorerJoin ? new Date(existingExplorerJoin.joined_at).getTime() : now;
    if (!existingExplorerJoin) {
      await admin.from('explorer_live_joins').insert({
        session_id: sessionId,
        user_id: user.id,
      });
    }

    return NextResponse.json({
      roomName,
      maxLiveMinutes: EXPLORER_LIVE_MINUTES,
      explorerJoinedAt,
    });
  } catch (e) {
    console.error('live join error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
