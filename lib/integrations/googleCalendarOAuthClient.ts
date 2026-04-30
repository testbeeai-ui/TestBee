"use client";

import { supabase } from "@/integrations/supabase/client";

/** postMessage source — keep in sync with `/integrations/google/oauth-complete`. */
export const GOOGLE_CALENDAR_OAUTH_MESSAGE_SOURCE = "edu-google-calendar-oauth" as const;

export type GoogleCalendarConsentResult =
  /** Full-page navigation to Google started (this tab left EduBlast). */
  | { mode: "redirect" }
  /** Popup flow finished without navigating this tab away. */
  | { mode: "popup"; connected: boolean; reason?: string };

function oauthPopupFeatures(): string {
  const w = 520;
  const h = 720;
  const dualScreenLeft = window.screenLeft ?? window.screenX ?? 0;
  const dualScreenTop = window.screenTop ?? window.screenY ?? 0;
  const width = window.innerWidth ?? document.documentElement.clientWidth ?? screen.width;
  const height = window.innerHeight ?? document.documentElement.clientHeight ?? screen.height;
  const left = Math.max(0, dualScreenLeft + (width - w) / 2);
  const top = Math.max(0, dualScreenTop + (height - h) / 2);
  return `popup=yes,width=${w},height=${h},left=${Math.round(left)},top=${Math.round(top)},scrollbars=yes,resizable=yes`;
}

/**
 * Starts Google OAuth with Calendar scopes (`POST /api/integrations/google/start`).
 * Prefers a **popup** so the EduBlast tab stays on the current page; falls back to full redirect if blocked.
 * Google’s consent screen cannot run inside an iframe on your domain — popup or redirect are the supported options.
 */
export async function redirectToGoogleCalendarConsent(options?: {
  preferPopup?: boolean;
}): Promise<GoogleCalendarConsentResult> {
  const preferPopup = options?.preferPopup !== false;

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token ?? "";
  const res = await fetch("/api/integrations/google/start", {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ popup: preferPopup }),
  });
  const payload = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!res.ok || !payload.url) {
    throw new Error(payload.error || `Request failed (${res.status})`);
  }

  if (!preferPopup) {
    window.location.href = payload.url;
    return { mode: "redirect" };
  }

  const win = window.open(payload.url, "edu_google_calendar_oauth", oauthPopupFeatures());
  if (!win) {
    window.location.href = payload.url;
    return { mode: "redirect" };
  }
  win.focus?.();

  return await new Promise<GoogleCalendarConsentResult>((resolve) => {
    let settled = false;
    const finish = (result: GoogleCalendarConsentResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("message", onMessage);
      window.clearInterval(intervalId);
      resolve(result);
    };

    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return;
      const data = ev.data as {
        source?: string;
        result?: string;
        reason?: string;
      } | null;
      if (!data || data.source !== GOOGLE_CALENDAR_OAUTH_MESSAGE_SOURCE) return;
      const connected = data.result === "connected";
      finish({
        mode: "popup",
        connected,
        reason: typeof data.reason === "string" ? data.reason : undefined,
      });
    };

    window.addEventListener("message", onMessage);

    const intervalId = window.setInterval(() => {
      if (settled) return;
      try {
        if (win.closed) {
          finish({ mode: "popup", connected: false, reason: "closed" });
        }
      } catch {
        finish({ mode: "popup", connected: false, reason: "closed" });
      }
    }, 400);
  });
}
