import { NextResponse } from 'next/server';
import { createClient } from '@/integrations/supabase/server';

export async function POST(request: Request) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId || typeof sessionId !== 'string') {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: session, error: sessionError } = await supabase
      .from('live_sessions')
      .select('meet_link, id, classroom_id')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 });
    }

    const { data: member } = await supabase
      .from('classroom_members')
      .select('user_id')
      .eq('classroom_id', session.classroom_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ error: 'Not a member of this class' }, { status: 403 });
    }

    if (!session.meet_link) {
      return NextResponse.json({ error: 'No meeting link for this session' }, { status: 404 });
    }

    let roomName: string;
    try {
      const meetUrl = new URL(session.meet_link);
      roomName = meetUrl.pathname.replace(/^\/+|\/+$/g, '') || 'EduBlast';
    } catch {
      roomName = session.meet_link.replace(/^https?:\/\/[^/]+\/?/, '').replace(/\/+$/, '') || 'EduBlast';
    }

    return NextResponse.json({ roomName });
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
