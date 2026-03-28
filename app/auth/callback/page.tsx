"use client";

// Supabase: Authentication → URL Configuration → Redirect URLs:
//   http://localhost:3000/auth/callback   and   http://localhost:3000/auth

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

async function readClientSession() {
  try {
    const res = await supabase.auth.getSession();
    return res?.data?.session ?? null;
  } catch {
    return null;
  }
}

/** Shown when ?code= is still present but there is no session after init (SDK already ran PKCE once). */
const OAUTH_CODE_FAILED_MESSAGE =
  "Google sign-in did not complete. If the browser Network tab shows a failed …/auth/v1/token?grant_type=pkce request (often 401), your NEXT_PUBLIC_SUPABASE_ANON_KEY usually does not match NEXT_PUBLIC_SUPABASE_URL — copy the anon (public) key from Supabase Dashboard → Settings → API for that same project, restart npm run dev, and try again. Always finish login on the same origin you started on (http://localhost:3000 vs http://127.0.0.1:3000 — pick one). You can also clear site data for this origin (remove localStorage keys starting with sb-) and sign in again.";

export default function AuthCallback() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirected = useRef(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [oauthGateOpen, setOauthGateOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const urlError = mounted ? searchParams.get("error") : null;
  const errorDescription = mounted ? searchParams.get("error_description") : null;
  const hasUrlError = !!(urlError || errorDescription);

  // Let GoTrue init run: with detectSessionInUrl, PKCE runs once inside getSession/initialize.
  // Do not call exchangeCodeForSession again here — a failed first attempt (e.g. 401) still removes
  // the PKCE verifier, and a second call only shows a misleading "verifier missing" error.
  useEffect(() => {
    if (!mounted || hasUrlError) {
      setOauthGateOpen(true);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        await readClientSession();
        if (cancelled) return;

        const session = await readClientSession();
        const code =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("code")
            : null;

        if (session?.user) {
          if (code) router.replace("/auth/callback");
          return;
        }

        if (code) {
          if (cancelled) return;
          // Do not router.replace here — navigating can remount this page and drop authError state.
          setAuthError(OAUTH_CODE_FAILED_MESSAGE);
          return;
        }
      } finally {
        if (!cancelled) setOauthGateOpen(true);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [mounted, hasUrlError, router]);

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
    if (hasUrlError) {
      setAuthError(errorDescription || urlError || "Sign-in failed");
      return;
    }
    if (authError) return;
    if (!oauthGateOpen) return;

    const stored =
      typeof window !== "undefined" ? sessionStorage.getItem("auth_redirect_after_login") : null;
    const target = stored && stored.startsWith("/") ? stored : "/onboarding";

    if (user && profile?.onboarding_complete) {
      (async () => {
        await supabase.auth.signOut({ scope: "others" });
        doRedirect("/home", stored);
      })();
      return;
    }
    if (user && profile !== null && !profile?.onboarding_complete) {
      (async () => {
        await supabase.auth.signOut({ scope: "others" });
        doRedirect(target, stored);
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
        else doRedirect("/auth?role=student", stored);
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
    hasUrlError,
    urlError,
    errorDescription,
    oauthGateOpen,
    authError,
    doRedirect,
  ]);

  if (authError || hasUrlError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
        <span className="text-4xl">⚠️</span>
        <h2 className="text-lg font-display text-foreground text-center">Sign-in failed</h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {authError || errorDescription || urlError}
        </p>
        {errorDescription?.includes("Database") && (
          <p className="text-xs text-muted-foreground text-center max-w-md">
            This is usually fixed by running the latest database migration (fix_handle_new_user_profile).
          </p>
        )}
        <Button className="rounded-xl" onClick={() => router.replace("/auth?role=student")}>
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
