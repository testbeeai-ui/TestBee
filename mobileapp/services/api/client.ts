import { getApiBaseUrl } from "@/core/config/env";
import { AppError } from "@/core/errors/AppError";
import { mapApiError } from "@/core/errors/mapApiError";
import { getAccessToken, refreshSession } from "@/services/supabase/auth.service";

const CLIENT_API_TIMEOUT_MS = 25_000;

let refreshInFlight: Promise<string | null> | null = null;

async function resolveBearerToken(): Promise<string | null> {
  const token = await getAccessToken();
  if (!token) return null;

  // Proactive refresh is handled by Supabase client; retry on 401 below.
  return token;
}

async function refreshTokenDeduped(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = refreshSession()
      .then((session) => session?.access_token ?? null)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

function withAuthHeaders(init: RequestInit, token: string | null): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  headers.set("X-Client-Platform", "android");
  headers.set("X-App-Version", "1.0.0");
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return { ...init, headers };
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CLIENT_API_TIMEOUT_MS);

  const url = path.startsWith("http") ? path : `${getApiBaseUrl()}${path}`;

  try {
    const token = await resolveBearerToken();
    let res = await fetch(url, {
      ...withAuthHeaders(init, token),
      signal: controller.signal,
    });

    if (res.status === 401) {
      const refreshed = await refreshTokenDeduped();
      if (refreshed) {
        res = await fetch(url, {
          ...withAuthHeaders(init, refreshed),
          signal: controller.signal,
        });
      }
    }

    return res;
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new AppError("Request timed out", "NETWORK");
    }
    throw new AppError(e instanceof Error ? e.message : "Network error", "NETWORK");
  } finally {
    clearTimeout(timer);
  }
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await apiFetch(path, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw mapApiError(res.status, body);
  return body as T;
}
