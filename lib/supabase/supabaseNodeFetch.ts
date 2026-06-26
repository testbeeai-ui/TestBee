/**
 * Server-side fetch for Supabase: bounded connect/read timeouts + short retries.
 * Prevents multi-minute API hangs when Supabase edge resets TLS (ECONNRESET) or Wi‑Fi is flaky.
 *
 * Used only from `integrations/supabase/server.ts` (Node API routes / RSC).
 *
 * Env tuning (optional):
 * - `SUPABASE_FETCH_IP_FAMILY=4` — pin IPv4 on ISPs with flaky IPv6 (e.g. some Jio routes).
 * - `SUPABASE_FETCH_TOTAL_TIMEOUT_MS` — hard cap per logical request (default 30s).
 */
import { Agent, fetch as undiciFetch } from "undici";

const connectMs = Number(process.env.SUPABASE_FETCH_CONNECT_TIMEOUT_MS ?? 12_000);
const headersMs = Number(process.env.SUPABASE_FETCH_HEADERS_TIMEOUT_MS ?? 20_000);
const bodyMs = Number(process.env.SUPABASE_FETCH_BODY_TIMEOUT_MS ?? 45_000);
const retries = Math.min(3, Math.max(0, Number(process.env.SUPABASE_FETCH_RETRIES ?? 1)));
const totalMs = Number(process.env.SUPABASE_FETCH_TOTAL_TIMEOUT_MS ?? 30_000);

const ipFamily = Number(process.env.SUPABASE_FETCH_IP_FAMILY ?? 0);
const connect: Record<string, unknown> = { autoSelectFamily: true };
if (ipFamily === 4 || ipFamily === 6) connect.family = ipFamily;

const agent = new Agent({
  connectTimeout: Number.isFinite(connectMs) ? connectMs : 12_000,
  headersTimeout: Number.isFinite(headersMs) ? headersMs : 20_000,
  bodyTimeout: Number.isFinite(bodyMs) ? bodyMs : 45_000,
  connect,
});

export function isSupabaseNetworkError(err: unknown): boolean {
  const e = err as { cause?: { code?: string }; code?: string; name?: string; message?: string };
  const code = e?.cause?.code ?? e?.code;
  if (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN" ||
    code === "ECONNREFUSED"
  ) {
    return true;
  }
  const name = String(e?.name ?? "");
  if (name === "AbortError" || name === "TimeoutError") return true;
  const msg = String(e?.message ?? err ?? "").toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("aborted") ||
    msg.includes("secure tls connection")
  );
}

function backoffMs(attemptIndex: number): number {
  return Math.min(2_000, 200 * (attemptIndex + 1));
}

export async function supabaseNodeFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let lastErr: unknown;
  const attempts = 1 + retries;
  const budgetStart = Date.now();

  for (let i = 0; i < attempts; i++) {
    const elapsed = Date.now() - budgetStart;
    const remaining = totalMs - elapsed;
    if (remaining <= 0) break;

    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), remaining);

    try {
      const res = await undiciFetch(
        input as never,
        {
          ...init,
          signal: controller.signal,
          dispatcher: agent,
        } as never
      );
      clearTimeout(deadline);
      return res as unknown as Response;
    } catch (e) {
      clearTimeout(deadline);
      lastErr = e;
      if (i + 1 < attempts && isSupabaseNetworkError(e) && Date.now() - budgetStart < totalMs) {
        await new Promise((r) => setTimeout(r, backoffMs(i)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr ?? new Error("Supabase fetch timed out");
}
