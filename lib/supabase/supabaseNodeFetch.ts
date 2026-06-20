/**
 * Server-side fetch for Supabase: longer connect timeouts + retries.
 * Fixes noisy `UND_ERR_CONNECT_TIMEOUT` / `TypeError: fetch failed` when the default
 * ~10s connect budget is tight (VPN, flaky Wi‑Fi, or cold Supabase edge).
 *
 * Used only from `integrations/supabase/server.ts` (Node API routes / RSC).
 */
import { Agent, fetch as undiciFetch } from "undici";

const connectMs = Number(process.env.SUPABASE_FETCH_CONNECT_TIMEOUT_MS ?? 30_000);
const headersMs = Number(process.env.SUPABASE_FETCH_HEADERS_TIMEOUT_MS ?? 60_000);
const bodyMs = Number(process.env.SUPABASE_FETCH_BODY_TIMEOUT_MS ?? 120_000);
const retries = Math.min(5, Math.max(0, Number(process.env.SUPABASE_FETCH_RETRIES ?? 2)));

// Optional: pin the IP family (e.g. `4`) to avoid flaky IPv6/NAT64 routes that
// reset during the TLS handshake (common on some ISPs like Jio). Unset = default
// dual-stack with Happy Eyeballs.
const ipFamily = Number(process.env.SUPABASE_FETCH_IP_FAMILY ?? 0);
const connect: Record<string, unknown> = { autoSelectFamily: true };
if (ipFamily === 4 || ipFamily === 6) connect.family = ipFamily;

const agent = new Agent({
  connectTimeout: Number.isFinite(connectMs) ? connectMs : 30_000,
  headersTimeout: Number.isFinite(headersMs) ? headersMs : 60_000,
  bodyTimeout: Number.isFinite(bodyMs) ? bodyMs : 120_000,
  connect,
});

function isRetryableNetworkError(err: unknown): boolean {
  const e = err as { cause?: { code?: string }; code?: string; name?: string; message?: string };
  const code = e?.cause?.code ?? e?.code;
  if (
    code === "UND_ERR_CONNECT_TIMEOUT" ||
    code === "UND_ERR_HEADERS_TIMEOUT" ||
    code === "UND_ERR_BODY_TIMEOUT" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ENOTFOUND" ||
    code === "EAI_AGAIN"
  ) {
    return true;
  }
  const name = String(e?.name ?? "");
  if (name === "AbortError") return true;
  const msg = String(e?.message ?? err ?? "").toLowerCase();
  return msg.includes("fetch failed") || msg.includes("network") || msg.includes("timeout");
}

export async function supabaseNodeFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  let lastErr: unknown;
  const attempts = 1 + retries;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await undiciFetch(
        input as never,
        {
          ...init,
          dispatcher: agent,
        } as never
      );
      return res as unknown as Response;
    } catch (e) {
      lastErr = e;
      if (i + 1 < attempts && isRetryableNetworkError(e)) {
        await new Promise((r) => setTimeout(r, 300 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastErr;
}
