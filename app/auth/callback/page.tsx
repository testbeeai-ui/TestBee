"use client";

// Supabase: In Dashboard → Authentication → URL Configuration, add to Redirect URLs:
//   http://localhost:3000/auth/callback   and   http://localhost:3000/auth   (so hash can land on either)

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function AuthCallback() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirected = useRef(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const urlError = mounted ? searchParams.get("error") : null;
  const errorDescription = mounted ? searchParams.get("error_description") : null;
  const hasUrlError = !!(urlError || errorDescription);

  const doRedirect = (path: string, stored: string | null) => {
    if (redirected.current) return;
    redirected.current = true;
    try {
      if (stored) sessionStorage.removeItem("auth_redirect_after_login");
    } catch (_) {}
    router.replace(path);
  };

  useEffect(() => {
    if (hasUrlError) {
      setAuthError(errorDescription || urlError || "Sign-in failed");
      return;
    }
    const stored =
      typeof window !== "undefined" ? sessionStorage.getItem("auth_redirect_after_login") : null;
    const target = stored && stored.startsWith("/") ? stored : "/onboarding";

    if (user && profile?.onboarding_complete) {
      (async () => {
        await supabase.auth.signOut({ scope: 'others' });
        doRedirect("/home", stored);
      })();
      return;
    }
    if (user && profile !== null && !profile?.onboarding_complete) {
      (async () => {
        await supabase.auth.signOut({ scope: 'others' });
        doRedirect(target, stored);
      })();
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {});

    const pollUntil = Date.now() + 8000;
    const poll = async () => {
      if (redirected.current) return;
      const { data: { session } } = await supabase.auth.getSession();
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
  }, [user, profile?.onboarding_complete, loading, router, hasUrlError, urlError, errorDescription]);

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
