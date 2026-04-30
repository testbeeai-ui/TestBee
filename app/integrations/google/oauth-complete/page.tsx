"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { GOOGLE_CALENDAR_OAUTH_MESSAGE_SOURCE } from "@/lib/integrations/googleCalendarOAuthClient";

function OAuthCompleteInner() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const rawResult = searchParams.get("result");
    const result = rawResult === "connected" ? "connected" : "error";
    const reason = searchParams.get("reason") ?? "";

    try {
      if (window.opener && typeof window.opener.postMessage === "function") {
        window.opener.postMessage(
          { source: GOOGLE_CALENDAR_OAUTH_MESSAGE_SOURCE, result, reason },
          window.location.origin
        );
      }
    } catch {
      // ignore
    }

    const closeTimer = window.setTimeout(() => {
      window.close();
      window.setTimeout(() => {
        if (!window.closed) {
          window.location.replace(
            `/teacher-portal?section=myClassroom&google=${result}${reason ? `&reason=${encodeURIComponent(reason)}` : ""}`
          );
        }
      }, 400);
    }, 120);

    return () => window.clearTimeout(closeTimer);
  }, [searchParams]);

  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 bg-[#07070f] p-8 text-center">
      <p className="text-sm font-medium text-slate-200">Google Calendar</p>
      <p className="max-w-sm text-xs text-slate-400">
        Closing this window… Your EduBlast tab should update automatically. If this tab stays open, go back to EduBlast.
      </p>
    </div>
  );
}

export default function GoogleOAuthCompletePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[30vh] items-center justify-center bg-[#07070f] p-8 text-sm text-slate-400">
          Loading…
        </div>
      }
    >
      <OAuthCompleteInner />
    </Suspense>
  );
}
