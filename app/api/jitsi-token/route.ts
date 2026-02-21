/**
 * 8x8 JaaS JWT for moderator permission (so the meeting starts without "Log-in" prompt).
 * Requires in .env:
 *   JITSI_JAAS_KID       - Key ID from 8x8 JaaS dashboard (API Key → Key ID)
 *   JITSI_JAAS_PRIVATE_KEY - PEM private key (contents of your .pk file; use \n for newlines)
 * NEXT_PUBLIC_JITSI_APP_ID is already set for the app.
 * When sessionId is passed, checks explorer_live_joins and rejects if explorer 8-min window expired.
 */
import { NextResponse } from 'next/server';
import * as jose from 'jose';
import { createClient } from '@/integrations/supabase/server';
import { createAdminClient } from '@/integrations/supabase/server';

const APP_ID = process.env.NEXT_PUBLIC_JITSI_APP_ID || process.env.JITSI_JAAS_APP_ID || '';
const KID = process.env.JITSI_JAAS_KID || '';
const PRIVATE_KEY_PEM = process.env.JITSI_JAAS_PRIVATE_KEY || '';
const EXPLORER_LIVE_MINUTES = 8;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;

  if (sessionId) {
    const supabase = await createClient();
    let user = (await supabase.auth.getUser()).data?.user ?? null;
    if (!user) {
      const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
      if (token) {
        const { data: { user: u } } = await supabase.auth.getUser(token);
        user = u ?? null;
      }
    }
    if (user) {
      const admin = createAdminClient();
      if (admin) {
        const { data: explorerJoin } = await admin
          .from('explorer_live_joins')
          .select('joined_at')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .maybeSingle();
        if (explorerJoin?.joined_at) {
          const joinedAt = new Date(explorerJoin.joined_at).getTime();
          if (Date.now() >= joinedAt + EXPLORER_LIVE_MINUTES * 60 * 1000) {
            return NextResponse.json(
              { error: 'Your 8-minute live preview has ended.' },
              { status: 403 }
            );
          }
        }
      }
    }
  }

  if (!APP_ID || !KID || !PRIVATE_KEY_PEM) {
    const missing = [
      !APP_ID && 'NEXT_PUBLIC_JITSI_APP_ID',
      !KID && 'JITSI_JAAS_KID',
      !PRIVATE_KEY_PEM && 'JITSI_JAAS_PRIVATE_KEY',
    ].filter(Boolean) as string[];
    const hint = !KID
      ? ' Get JITSI_JAAS_KID: 8x8 Developer Console → your app → API Keys → copy the Key ID (e.g. vpaas-magic-cookie-xxx/4f4910).'
      : '';
    return NextResponse.json(
      { error: `Jitsi JaaS not configured. Add to .env: ${missing.join(', ')}.${hint}` },
      { status: 503 }
    );
  }

  try {
    const displayName = typeof body.displayName === 'string' ? body.displayName : 'Participant';
    const userId = typeof body.userId === 'string' ? body.userId : `user-${Date.now()}`;

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 2 * 60 * 60; // 2 hours
    const nbf = now - 60; // 1 min skew

    const payload = {
      aud: 'jitsi',
      iss: 'chat',
      sub: APP_ID,
      room: '*', // wildcard: allow joining any room (avoids "not allowed to join" when room name format differs)
      exp,
      nbf,
      context: {
        user: {
          id: userId,
          name: displayName,
          avatar: '',
          email: '',
          moderator: 'true', // so meeting starts without "Log-in" prompt
        },
        features: {
          livestreaming: 'false',
          'outbound-call': 'false',
          transcription: 'false',
          recording: 'false',
          'file-upload': 'false',
          'inbound-call': 'false',
        },
      },
    };

    const raw = PRIVATE_KEY_PEM.replace(/\\n/g, '\n').trim();
    const pem = raw.includes('BEGIN PRIVATE KEY')
      ? raw
      : `-----BEGIN PRIVATE KEY-----\n${raw.replace(/\s/g, '')}\n-----END PRIVATE KEY-----`;
    const key = await jose.importPKCS8(pem, 'RS256');
    const jwt = await new jose.SignJWT(payload as Record<string, unknown>)
      .setProtectedHeader({ alg: 'RS256', kid: KID, typ: 'JWT' })
      .sign(key);

    return NextResponse.json({ jwt });
  } catch (e) {
    console.error('Jitsi JWT error:', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to create token' },
      { status: 500 }
    );
  }
}
