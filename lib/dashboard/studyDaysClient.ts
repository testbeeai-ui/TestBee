import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";

export type StudyDaysApiResponse = {
  days?: { day: string; active_ms: number; presence_ms?: number }[];
  summary?: { streak?: number; activeDaysThisMonth?: number } | null;
  reconcile?: { penaltiesApplied: number; totalDeducted: number } | null;
  error?: string;
  retryable?: boolean;
};

const CACHE_TTL_MS = 2_500;

/** Run penalty reconcile RPC once per IST day on study-days GET. */
let reconciledPenaltyForToday: string | null = null;

let cached:
  | {
      key: string;
      at: number;
      data: StudyDaysApiResponse;
    }
  | null = null;
let inFlight: Promise<StudyDaysApiResponse> | null = null;

function cacheKey(from: string, to: string, today: string): string {
  return `${from}|${to}|${today}`;
}

export function invalidateStudyDaysCache(): void {
  cached = null;
  inFlight = null;
}

export function resetStudyDaysReconcileSession(): void {
  reconciledPenaltyForToday = null;
}

/**
 * Shared GET /api/user/study-days with in-flight dedupe and a short TTL so
 * dashboard + sidebar do not hammer Supabase on the same refresh burst.
 */
export async function fetchStudyDays(
  from: string,
  to: string,
  today: string,
  opts?: { fresh?: boolean }
): Promise<StudyDaysApiResponse> {
  const key = cacheKey(from, to, today);
  const now = Date.now();

  if (!opts?.fresh && cached && cached.key === key && now - cached.at < CACHE_TTL_MS) {
    return cached.data;
  }

  if (!opts?.fresh && inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    try {
      const headers = await getClientApiAuthHeaders();
      const q = new URLSearchParams({ from, to, today });
      const runReconcile = opts?.fresh === true || reconciledPenaltyForToday !== today;
      if (runReconcile) {
        reconciledPenaltyForToday = today;
      } else {
        q.set("reconcile", "0");
      }
      const res = await fetch(`/api/user/study-days?${q.toString()}`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as StudyDaysApiResponse;
        return { error: body.error ?? `http_${res.status}`, retryable: body.retryable };
      }
      const data = (await res.json()) as StudyDaysApiResponse;
      cached = { key, at: Date.now(), data };
      return data;
    } catch {
      return { error: "network", retryable: true };
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}
