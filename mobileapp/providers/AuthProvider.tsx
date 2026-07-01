import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  INITIAL_AUTH_STATE,
  type AuthBlock,
  type AuthSessionState,
  type MobileProfile,
} from "@/core/auth/session";
import { fetchProfile, getSupabaseClient } from "@/services/supabase/client";
import { signInWithGoogle, signOut as signOutService } from "@/services/supabase/auth.service";
import { evaluateWhitelistGate } from "@/services/auth/whitelistGate";
import { unregisterPushToken } from "@/services/push/pushRegistration";

type AuthContextValue = AuthSessionState & {
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearAuthBlock: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function blockMessage(reason: AuthBlock["reason"], email?: string | null): string {
  switch (reason) {
    case "not_approved":
      return email
        ? `${email} is not approved yet. Use the same Google account you registered with on edublast.in, or finish waitlist approval on the website.`
        : "This Google account is not approved yet. Sign in on edublast.in with your approved email first.";
    case "no_email":
      return "Your Google account did not provide an email. Use a Google account with email access enabled.";
    case "teacher_app":
      return "Teacher accounts use the EduBlast teacher portal on the website. The mobile app is for students.";
    case "oauth_cancelled":
      return "Google sign-in was cancelled. Tap Continue with Google to try again.";
    default:
      return "Sign-in could not be completed.";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthSessionState>(INITIAL_AUTH_STATE);
  const signInInFlight = useRef(false);

  const rejectSession = useCallback(async (block: AuthBlock) => {
    await signOutService();
    setState({
      ...INITIAL_AUTH_STATE,
      isLoading: false,
      authBlock: block,
    });
  }, []);

  const applySession = useCallback(
    async (session: Session | null) => {
      const user = session?.user ?? null;
      if (!user) {
        setState((s) => ({
          ...INITIAL_AUTH_STATE,
          isLoading: false,
          authBlock: s.authBlock,
        }));
        return;
      }

      let profile: MobileProfile | null = null;
      try {
        profile = await fetchProfile(user.id);
      } catch {
        profile = null;
      }

      const onboardingComplete = profile?.onboarding_complete === true;
      const supabase = getSupabaseClient();

      if (!onboardingComplete) {
        const gate = await evaluateWhitelistGate(supabase, {
          userId: user.id,
          email: user.email,
          onboardingComplete: false,
        });

        if (!gate.allowed) {
          const reason = gate.reason === "no_email" ? "no_email" : "not_approved";
          await rejectSession({
            reason,
            email: user.email,
            message: blockMessage(reason, user.email),
          });
          return;
        }

        if (gate.approvedRole === "teacher" || profile?.role === "teacher") {
          await rejectSession({
            reason: "teacher_app",
            email: user.email,
            message: blockMessage("teacher_app", user.email),
          });
          return;
        }
      }

      if (profile?.role === "teacher") {
        await rejectSession({
          reason: "teacher_app",
          email: user.email,
          message: blockMessage("teacher_app", user.email),
        });
        return;
      }

      setState({
        session,
        user,
        profile,
        isLoading: false,
        isSigningIn: false,
        signInStatus: null,
        isAuthenticated: true,
        needsWebOnboarding: Boolean(profile && !profile.onboarding_complete),
        authBlock: null,
      });
    },
    [rejectSession]
  );

  useEffect(() => {
    let mounted = true;
    const supabase = getSupabaseClient();

    void (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        await applySession(data.session ?? null);
      } catch {
        if (mounted) setState({ ...INITIAL_AUTH_STATE, isLoading: false });
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (signInInFlight.current) return;
      void applySession(session);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, [applySession]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signInWithGoogle: async () => {
        signInInFlight.current = true;
        setState((s) => ({
          ...s,
          isSigningIn: true,
          signInStatus: "Opening sign-in…",
          authBlock: null,
        }));
        try {
          const { session } = await signInWithGoogle((phase) => {
            setState((s) => ({
              ...s,
              signInStatus: phase === "browser" ? "Choose your Google account…" : "Returning to app…",
            }));
          });
          if (!session) {
            setState((s) => ({
              ...s,
              isSigningIn: false,
              signInStatus: null,
              authBlock: {
                reason: "oauth_cancelled",
                message: blockMessage("oauth_cancelled"),
              },
            }));
            return;
          }
          setState((s) => ({ ...s, signInStatus: "Checking your account…" }));
          await applySession(session);
        } catch (e) {
          setState((s) => ({
            ...s,
            isSigningIn: false,
            signInStatus: null,
            authBlock: {
              reason: "oauth_cancelled",
              message: e instanceof Error ? e.message : blockMessage("oauth_cancelled"),
            },
          }));
        } finally {
          signInInFlight.current = false;
          setState((s) => ({ ...s, isSigningIn: false, signInStatus: null }));
        }
      },
      signOut: async () => {
        await unregisterPushToken();
        await signOutService();
        setState({ ...INITIAL_AUTH_STATE, isLoading: false });
      },
      refreshProfile: async () => {
        if (!state.user) return;
        const profile = await fetchProfile(state.user.id);
        setState((s) => ({
          ...s,
          profile,
          needsWebOnboarding: Boolean(profile && !profile.onboarding_complete),
        }));
      },
      clearAuthBlock: () => {
        setState((s) => ({ ...s, authBlock: null }));
      },
    }),
    [state, applySession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
