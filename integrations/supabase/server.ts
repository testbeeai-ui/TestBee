import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from './types';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Vercel/UI often saves keys wrapped in quotes or with trailing newlines — Supabase then returns "Invalid API key". */
export function normalizeServiceRoleKey(raw: string | undefined | null): string | null {
  if (raw == null || typeof raw !== 'string') return null;
  let k = raw.trim();
  if (
    (k.startsWith('"') && k.endsWith('"')) ||
    (k.startsWith("'") && k.endsWith("'"))
  ) {
    k = k.slice(1, -1).trim();
  }
  return k.length > 0 ? k : null;
}

function supabaseProjectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname;
    const m = /^([a-z0-9-]+)\.supabase\.co$/i.exec(host);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/** `ref` inside the service_role JWT must match the project in NEXT_PUBLIC_SUPABASE_URL or API returns Invalid API key. */
function jwtPayloadRef(serviceRoleJwt: string): string | null {
  const parts = serviceRoleJwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
    const json = Buffer.from(b64 + pad, 'base64').toString('utf8');
    const p = JSON.parse(json) as { ref?: string };
    return typeof p.ref === 'string' ? p.ref : null;
  } catch {
    return null;
  }
}

let loggedServiceRoleRefMismatch = false;

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options ?? { path: '/' })
          );
        } catch {
          // setAll from Server Component; middleware may refresh sessions
        }
      },
    },
  });
}

/** Server-only. Bypasses RLS. Use only after verifying the user in API routes. */
export function createAdminClient() {
  const key = normalizeServiceRoleKey(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!key) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url && !loggedServiceRoleRefMismatch) {
    const urlRef = supabaseProjectRefFromUrl(url);
    const keyRef = jwtPayloadRef(key);
    if (urlRef && keyRef && urlRef !== keyRef) {
      loggedServiceRoleRefMismatch = true;
      console.error(
        '[supabase] SUPABASE_SERVICE_ROLE_KEY is for a different project than NEXT_PUBLIC_SUPABASE_URL (JWT ref "%s" vs URL ref "%s"). Supabase returns "Invalid API key". Fix Vercel env so both come from the same Supabase project.',
        keyRef,
        urlRef,
      );
    }
  }
  return createSupabaseClient<Database>(SUPABASE_URL, key, { auth: { persistSession: false } });
}

/** Server-only. Use in API routes when auth is from Authorization header so RLS sees the user. */
export function createClientWithToken(accessToken: string) {
  return createSupabaseClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
