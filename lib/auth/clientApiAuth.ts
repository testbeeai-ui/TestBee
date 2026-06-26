import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/auth/safeSession";

/** Abort hung browser → API calls (presence heartbeats, etc.). */
const CLIENT_API_TIMEOUT_MS = Number(process.env.CLIENT_API_FETCH_TIMEOUT_MS ?? 25_000);

/** Refresh access token before it expires (long orchestrator runs). */
const EXPIRY_BUFFER_MS = 120_000;

let refreshInFlight: Promise<Session | null> | null = null;

async function refreshSessionDeduped(): Promise<Session | null> {
  if (!refreshInFlight) {
    refreshInFlight = supabase.auth
      .refreshSession()
      .then(({ data, error }) => {
        if (error) {
          const msg = (error.message || "").toLowerCase();
          if (msg.includes("invalid refresh token") || msg.includes("refresh token not found")) {
            void supabase.auth.signOut({ scope: "local" }).catch(() => {});
          }
          return null;
        }
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

  const { session: initialSession } = await safeGetSession();
  let session = initialSession;

  const exp = session?.expires_at;
  const expMs = typeof exp === "number" ? exp * 1000 : 0;
  const needsRefresh =
    !session?.access_token || expMs === 0 || expMs < Date.now() + EXPIRY_BUFFER_MS;

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
 * Aborts after CLIENT_API_TIMEOUT_MS so heartbeats do not pile up for minutes.
 */
export async function fetchWithClientAuth(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_API_TIMEOUT_MS);

  const doFetch = async (auth: Record<string, string>) =>
    fetch(input, { ...mergeAuthHeaders(init, auth), signal: controller.signal });

  try {
    const auth = await getClientApiAuthHeaders();
    const res = await doFetch(auth);
    if (res.status !== 401) return res;

    const refreshed = await refreshSessionDeduped();
    const token = refreshed?.access_token;
    if (!token) return res;

    return doFetch({ Authorization: `Bearer ${token}` });
  } finally {
    clearTimeout(timer);
  }
}
