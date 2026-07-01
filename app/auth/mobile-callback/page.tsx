"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  buildMobileAppReturnUrl,
  buildMobileAppReturnUrlWithHash,
  isAllowedMobileOAuthReturn,
} from "@/lib/auth/mobileOAuthReturn";

function MobileCallbackContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Opening EduBlast app…");
  const [appDeepLink, setAppDeepLink] = useState<string | null>(null);

  const returnTo = searchParams.get("return_to");

  const targetUrl = useMemo(() => {
    if (!isAllowedMobileOAuthReturn(returnTo)) return null;

    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (hash.includes("access_token=")) {
      return buildMobileAppReturnUrlWithHash(returnTo!, hash);
    }

    const code = searchParams.get("code");
    if (code) {
      return buildMobileAppReturnUrl(returnTo!, code);
    }

    return null;
  }, [returnTo, searchParams]);

  useLayoutEffect(() => {
    if (!returnTo || !targetUrl) return;
    window.location.replace(targetUrl);
  }, [returnTo, targetUrl]);

  useEffect(() => {
    if (!returnTo) {
      setMessage("Missing return_to. Open the mobile app and try again.");
      return;
    }

    if (!isAllowedMobileOAuthReturn(returnTo)) {
      setMessage("Invalid app link. Update the mobile app.");
      return;
    }

    if (!targetUrl) {
      setMessage("Sign-in did not finish. Close this tab and try again in the app.");
      return;
    }

    setAppDeepLink(targetUrl);
    window.location.replace(targetUrl);
  }, [returnTo, targetUrl]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <span className="text-4xl">📱</span>
      <p className="max-w-sm text-sm text-muted-foreground">{message}</p>
      {appDeepLink ? (
        <a
          href={appDeepLink}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Tap to open EduBlast
        </a>
      ) : null}
    </div>
  );
}

/** Supabase (HTTPS) → this page → exp:// or edublast:// with tokens/code. */
export default function MobileAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <span className="text-4xl animate-pulse">📱</span>
        </div>
      }
    >
      <MobileCallbackContent />
    </Suspense>
  );
}
