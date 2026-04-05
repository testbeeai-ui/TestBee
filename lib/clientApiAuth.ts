import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Refresh access token before it expires (long orchestrator runs). */
const EXPIRY_BUFFER_MS = 120_000;

let refreshInFlight: Promise<Session | null> | null = null;

async function refreshSessionDeduped(): Promise<Session | null> {
  if (!refreshInFlight) {
    refreshInFlight = supabase.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error) return null;
        return data.session ?? null;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function mergeAuthHeaders(init: RequestInit, auth: Record<string, string>): RequestInit {
  const headers = new Headers(init.headers);
  if (auth.Authorization) headers.set("Authorization", auth.Authorization);
  return { ...init, headers };
}

/**
 * Returns Authorization for browser API calls. Refreshes when missing or expiring soon.
 */
export async function getClientApiAuthHeaders(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (typeof window === "undefined") return out;

  let {
    data: { session },
  } = await supabase.auth.getSession();

  const exp = session?.expires_at;
  const expMs = typeof exp === "number" ? exp * 1000 : 0;
  const needsRefresh =
    !session?.access_token ||
    expMs === 0 ||
    expMs < Date.now() + EXPIRY_BUFFER_MS;

  if (needsRefresh) {
    const next = await refreshSessionDeduped();
    if (next?.access_token) session = next;
  }

  if (session?.access_token) {
    out.Authorization = `Bearer ${session.access_token}`;
  }
  return out;
}

/**
 * Browser fetch with Supabase Bearer. On 401, refreshes session once and retries.
 */
export async function fetchWithClientAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const auth = await getClientApiAuthHeaders();
  let res = await fetch(input, mergeAuthHeaders(init, auth));
  if (res.status !== 401) return res;

  const refreshed = await refreshSessionDeduped();
  const token = refreshed?.access_token;
  if (!token) return res;

  return fetch(input, mergeAuthHeaders(init, { Authorization: `Bearer ${token}` }));
}
