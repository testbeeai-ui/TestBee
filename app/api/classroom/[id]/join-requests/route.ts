import { NextResponse } from 'next/server';
import { createAdminClient, createClient, createClientWithToken } from '@/integrations/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: classroomId } = await params;
  if (!classroomId) {
    return NextResponse.json({ error: 'Classroom id required' }, { status: 400 });
  }

  // Prefer Authorization header (client sends this); fall back to cookie session
  const tokenFromHeader = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  let user: { id: string } | null = null;
  let cookieClient: Awaited<ReturnType<typeof createClient>> | null = null;
  if (tokenFromHeader) {
    const supabaseWithToken = createClientWithToken(tokenFromHeader);
    const { data: { user: u } } = await supabaseWithToken.auth.getUser();
    user = u ?? null;
  }
  if (!user) {
    cookieClient = await createClient();
    user = (await cookieClient.auth.getUser()).data?.user ?? null;
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use a client that has the user's JWT for RLS (cookie client may have no session on API calls)
  const admin = createAdminClient();
  const authedClient =
    admin ?? (tokenFromHeader ? createClientWithToken(tokenFromHeader) : cookieClient!);

  const { data: classroom } = await authedClient
    .from('classrooms')
    .select('teacher_id')
    .eq('id', classroomId)
    .maybeSingle();

  if (!classroom || classroom.teacher_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const clientToUse = authedClient;

  const { data, error } = await clientToUse
    .from('classroom_join_requests')
    .select('id, user_id, status, created_at, profiles!user_id(name)')
    .eq('classroom_id', classroomId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
