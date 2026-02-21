import { NextResponse } from 'next/server';
import { createClient } from '@/integrations/supabase/server';
import { createAdminClient } from '@/integrations/supabase/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const amount = typeof body?.amount === 'number' ? body.amount : parseInt(body?.amount, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount required' }, { status: 400 });
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

    const { data: row } = await admin.from('profiles').select('rdm').eq('id', user.id).single();
    const currentRdm = (row?.rdm ?? 0) as number;
    const newRdm = currentRdm + amount;

    const { error: updateErr } = await admin
      .from('profiles')
      .update({ rdm: newRdm })
      .eq('id', user.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ rdm: newRdm });
  } catch (e) {
    console.error('rdm top-up error', e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
