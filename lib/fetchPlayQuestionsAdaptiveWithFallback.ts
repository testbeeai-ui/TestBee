import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { PlayDomain, PlayQuestionRow } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/safeSession";
import { fetchPlayQuestionsDomainRandom } from "@/lib/fetchPlayQuestionsDomainRandom";

const TOKEN_BUFFER_MS = 120_000;

function browserProjectClient(accessToken: string): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return createClient<Database>(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

async function readAccessToken(): Promise<string | null> {
  const { session } = await safeGetSession();
  const exp = session?.expires_at;
  const expMs = typeof exp === "number" ? exp * 1000 : 0;
  const needsRefresh =
    !session?.access_token || expMs === 0 || expMs < Date.now() + TOKEN_BUFFER_MS;
  if (needsRefresh) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return session?.access_token ?? null;
    return data.session?.access_token ?? session?.access_token ?? null;
  }
  return session?.access_token ?? null;
}

async function rpcAdaptive(
  client: SupabaseClient<Database>,
  domain: PlayDomain,
  category: string,
  count: number,
) {
  return client.rpc("get_adaptive_play_questions", {
    p_domain: domain,
    p_category: category,
    p_count: count,
  });
}

function normalizeRows(data: unknown): PlayQuestionRow[] {
  return (data as PlayQuestionRow[] | null) ?? [];
}

/** PostgREST errors are class instances; DevTools often prints them as `{}` unless fields are enumerated. */
function serializeRpcError(err: unknown): Record<string, unknown> {
  if (err == null) return { value: String(err) };
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack?.slice(0, 800),
    };
  }
  if (typeof err === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.getOwnPropertyNames(err)) {
      try {
        out[k] = (err as Record<string, unknown>)[k];
      } catch {
        out[k] = "[unreadable]";
      }
    }
    if (Object.keys(out).length === 0) {
      out._note = "no own properties — inspect Network tab for PostgREST response body";
    }
    return out;
  }
  return { value: String(err) };
}

/**
 * Loads adaptive/stratified play questions. Tries hard so the UI never goes empty when the bank
 * has rows: explicit Bearer on a dedicated client (fixes missing JWT on RPC), refresh + retry,
 * then stratified domain random (same shape as admin streak) so Streak / Refer always boot.
 */
export async function fetchPlayQuestionsAdaptiveWithFallback(
  sb: SupabaseClient<Database>,
  params: { domain: PlayDomain; category: string; count: number },
): Promise<PlayQuestionRow[]> {
  const domain = params.domain.trim() as PlayDomain;
  const category = params.category.trim();
  const count = Math.max(1, Math.min(100, Math.floor(params.count)));

  let token = await readAccessToken();

  const tryOnce = async (access: string | null) => {
    if (access) {
      const c = browserProjectClient(access);
      return rpcAdaptive(c, domain, category, count);
    }
    return rpcAdaptive(sb, domain, category, count);
  };

  let { data, error } = await tryOnce(token);
  let rows = normalizeRows(data);
  if (!error && rows.length > 0) return rows;

  await supabase.auth.refreshSession();
  token = await readAccessToken();
  ({ data, error } = await tryOnce(token));
  rows = normalizeRows(data);
  if (!error && rows.length > 0) return rows;

  const random = await fetchPlayQuestionsDomainRandom(sb, { domain, count });
  if (random.length > 0) {
    if (process.env.NODE_ENV === "development") {
      const meta = {
        domain,
        category,
        rpcRowCount: rows.length,
        rpcError: error != null ? serializeRpcError(error) : null,
      };
      if (error != null) {
        console.warn(
          "[fetchPlayQuestionsAdaptiveWithFallback] RPC failed or returned 0 rows; using stratified domain fallback",
          meta,
        );
      } else {
        console.warn(
          "[fetchPlayQuestionsAdaptiveWithFallback] RPC returned 0 rows (no error object); using stratified domain fallback",
          meta,
        );
      }
    }
    return random;
  }

  if (process.env.NODE_ENV === "development") {
    console.error("[fetchPlayQuestionsAdaptiveWithFallback] adaptive RPC and domain fallback both empty", {
      domain,
      category,
      rpcError: error != null ? serializeRpcError(error) : null,
    });
  }

  return [];
}

const GAUNTLET_QUESTION_COUNT = 10;

async function rpcDailyGauntlet(
  client: SupabaseClient<Database>,
  p_date: string,
  domain: PlayDomain,
) {
  return client.rpc("get_daily_gauntlet_questions", { p_date, p_domain: domain });
}

/**
 * DailyDose boot: same JWT / RPC issues as streak adaptive. Bearer client + retry, then 10 stratified
 * domain questions so Funbrain / Academic DailyDose always opens when the bank has rows.
 */
export async function fetchDailyGauntletQuestionsWithFallback(
  sb: SupabaseClient<Database>,
  params: { domain: PlayDomain; dateIso: string },
): Promise<PlayQuestionRow[]> {
  const domain = params.domain;
  const p_date = params.dateIso.trim();

  let token = await readAccessToken();
  const tryOnce = async (access: string | null) => {
    if (access) {
      return rpcDailyGauntlet(browserProjectClient(access), p_date, domain);
    }
    return rpcDailyGauntlet(sb, p_date, domain);
  };

  let { data, error } = await tryOnce(token);
  let rows = normalizeRows(data);
  if (!error && rows.length > 0) return rows;

  await supabase.auth.refreshSession();
  token = await readAccessToken();
  ({ data, error } = await tryOnce(token));
  rows = normalizeRows(data);
  if (!error && rows.length > 0) return rows;

  const random = await fetchPlayQuestionsDomainRandom(sb, { domain, count: GAUNTLET_QUESTION_COUNT });
  if (random.length > 0) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[fetchDailyGauntletQuestionsWithFallback] using stratified domain fallback", {
        domain,
        rpcError: error != null ? serializeRpcError(error) : null,
      });
    }
    return random.slice(0, GAUNTLET_QUESTION_COUNT);
  }

  if (process.env.NODE_ENV === "development") {
    console.error("[fetchDailyGauntletQuestionsWithFallback] RPC and fallback both empty", {
      domain,
      rpcError: error != null ? serializeRpcError(error) : null,
    });
  }
  return [];
}
