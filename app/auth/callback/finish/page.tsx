"use client";

import { useCallback, useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { safeGetSession } from "@/lib/auth/safeSession";
import {
  readPendingDeepLink,
  clearPendingDeepLink,
  destinationFromOAuthStored,
} from "@/lib/auth/safeNextPath";
import { oauthSignInFailedMessage, oauthTryAgainPath } from "@/lib/auth/oauthSignInHelp";
import { TEACHER_PORTAL_CLASSROOMS_URL } from "@/lib/teacherPortal/routes";
import { triggerLoginNotificationEmail } from "@/lib/email/triggerLoginNotificationClient";

async function readClientSession() {
  try {
    const { session } = await safeGetSession();
    return session;
  } catch {
    return null;
  }
}

function AuthCallbackFinishContent() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirected = useRef(false);
  const loginEmailSent = useRef(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const urlError = mounted ? searchParams.get("error") : null;
  const errorDescription = mounted ? searchParams.get("error_description") : null;
  const hasUrlError = !!(urlError || errorDescription);

  useEffect(() => {
    if (!mounted) return;
    if (hasUrlError) {
      const host = typeof window !== "undefined" ? window.location.hostname : undefined;
      setAuthError(
        urlError === "oauth_exchange_failed"
          ? oauthSignInFailedMessage(host)
          : errorDescription || urlError || oauthSignInFailedMessage(host)
      );
      setReady(true);
      return;
    }

    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (hash && hash.includes("access_token")) {
      void (async () => {
        await readClientSession();
        window.history.replaceState(null, "", "/auth/callback/finish");
        setReady(true);
      })();
      return;
    }

    setReady(true);
  }, [mounted, hasUrlError, urlError, errorDescription]);

  const doRedirect = useCallback(
    (path: string, stored: string | null) => {
      if (redirected.current) return;
      redirected.current = true;
      try {
        if (stored) sessionStorage.removeItem("auth_redirect_after_login");
      } catch {
        /* ignore */
      }
      router.replace(path);
    },
    [router]
  );

  useEffect(() => {
    if (!ready || !user?.id || loginEmailSent.current) return;
    if (profile === null) return;
    loginEmailSent.current = true;
    triggerLoginNotificationEmail();
  }, [ready, user?.id, profile]);

  useEffect(() => {
    if (!ready || authError) return;

    const stored =
      typeof window !== "undefined" ? sessionStorage.getItem("auth_redirect_after_login") : null;

    const isTeacher = profile?.role === "teacher";
    const postOnboardPath = isTeacher ? TEACHER_PORTAL_CLASSROOMS_URL : "/home";
    const onboardPath = isTeacher ? "/onboarding?role=teacher" : "/onboarding?role=student";

    if (user && profile?.onboarding_complete) {
      void (async () => {
        await supabase.auth.signOut({ scope: "others" });
        const pending = readPendingDeepLink();
        const fromOAuth = destinationFromOAuthStored(stored);
        const dest = pending ?? fromOAuth ?? postOnboardPath;
        clearPendingDeepLink();
        doRedirect(dest, stored);
      })();
      return;
    }
    if (user && profile !== null && !profile?.onboarding_complete) {
      void (async () => {
        await supabase.auth.signOut({ scope: "others" });
        doRedirect(onboardPath, stored);
      })();
      return;
    }

    const authSub = supabase.auth.onAuthStateChange(() => {});
    const subscription = authSub?.data?.subscription;

    const pollUntil = Date.now() + 15000;
    const poll = async () => {
      if (redirected.current) return;
      const session = await readClientSession();
      if (!session?.user) {
        if (Date.now() < pollUntil) setTimeout(poll, 400);
        else doRedirect(oauthTryAgainPath(), stored);
      }
    };

    if (!user && !loading) {
      const t = setTimeout(poll, 600);
      return () => {
        clearTimeout(t);
        subscription?.unsubscribe?.();
      };
    }
    return () => subscription?.unsubscribe?.();
  }, [
    user,
    profile,
    profile?.onboarding_complete,
    loading,
    router,
    ready,
    authError,
    doRedirect,
  ]);

  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
        <span className="text-4xl">⚠️</span>
        <h2 className="text-lg font-display text-foreground text-center">Sign-in failed</h2>
        <p className="whitespace-pre-line text-sm text-muted-foreground text-center max-w-md">
          {authError}
        </p>
        <Button className="rounded-xl" onClick={() => router.replace(oauthTryAgainPath())}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
      <span className="text-4xl animate-pulse">🎯</span>
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  );
}

export default function AuthCallbackFinishPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <span className="text-4xl animate-pulse">🎯</span>
        </div>
      }
    >
      <AuthCallbackFinishContent />
    </Suspense>
  );
}
