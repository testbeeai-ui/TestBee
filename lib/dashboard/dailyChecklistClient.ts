import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import type { DailyChecklistApiResponse } from "@/lib/dashboard/dailyChecklistState";

const CACHE_TTL_MS = 2_500;

let cached: { key: string; at: number; data: DailyChecklistApiResponse } | null = null;
let inFlight: Promise<DailyChecklistApiResponse | null> | null = null;

export function invalidateDailyChecklistCache(): void {
  cached = null;
  inFlight = null;
}

/**
 * Shared GET /api/user/daily-checklist — dedupes home dashboard + Gyan++ rail bursts.
 */
export async function fetchDailyChecklist(
  query: URLSearchParams,
  opts?: { fresh?: boolean }
): Promise<DailyChecklistApiResponse | null> {
  const key = query.toString();
  const now = Date.now();

  if (!opts?.fresh && cached && cached.key === key && now - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  if (!opts?.fresh && inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const res = await fetchWithClientAuth(`/api/user/daily-checklist?${key}`, {
        cache: "no-store",
      });
      if (!res.ok) return null;
      const data = (await res.json()) as DailyChecklistApiResponse;
      cached = { key, at: Date.now(), data };
      return data;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
