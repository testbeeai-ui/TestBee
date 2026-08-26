"use client";

import { useContext, useCallback, useEffect, useMemo, useRef, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import type { AuthError, User, Session } from "@supabase/supabase-js";
import { useUserStore } from "@/store/useUserStore";
import type { ClassLevel, SubjectCombo } from "@/types";
import { targetExamToExamType } from "@/lib/profile/targetExam";
import { mergeAllSavedContent } from "@/lib/saved/mergeSavedContent";
import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { safeGetSession } from "@/lib/auth/safeSession";
import { shouldApplyWhitelistRoleToProfile } from "@/lib/auth/whitelistRoleSync";
import { profileShouldForceOnboardingComplete } from "@/lib/profile/profileOnboardingRepair";
import { readPendingDeepLink } from "@/lib/auth/safeNextPath";
import { AuthContext, type Profile } from "@/hooks/auth-context";
import { triggerLoginNotificationEmail } from "@/lib/email/triggerLoginNotificationClient";
import {
  evaluateWhitelistGate,
  waitlistBlockedAuthUrl,
} from "@/lib/waitlist/whitelistGate";

export type { Profile } from "@/hooks/auth-context";

function applyProfileOnboardingLocalState(userId: string, profile: Profile): void {
  void import("@/lib/subscription/freeTrialClient").then(
    ({ ensureOnboardingLocalStateForUser, syncOnboardingSiteTourClaimedFromProfile }) => {
      ensureOnboardingLocalStateForUser(userId);
      syncOnboardingSiteTourClaimedFromProfile(profile);
    }
  );
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (
    userId: string,
    userMeta?: { name?: string; avatar_url?: string; provider?: string; email?: string }
  ) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    const isComplete = data?.onboarding_complete === true;
    const email = userMeta?.email;
    let approvedRole: "student" | "teacher" | null = null;
    let isSignInFlow = false;
    try {
      isSignInFlow = sessionStorage.getItem("auth_mode") === "signin";
    } catch (_) {}
    const applyWhitelistRole = shouldApplyWhitelistRoleToProfile(isSignInFlow);

    if (!isComplete && email) {
      // Check if user is admin via profile role or user_roles table
      let isAdmin = false;
      if (data?.role === "admin") {
        isAdmin = true;
      } else {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        if (roleData) isAdmin = true;
      }

      if (!isAdmin) {
        const gate = await evaluateWhitelistGate(supabase, {
          userId,
          email,
          onboardingComplete: false,
        });

        if (!gate.allowed) {
          console.warn(`[auth] Sign-in blocked: ${email} is not whitelisted (${gate.reason}).`);
          setProfile(null);
          setSession(null);
          setUser(null);
          useUserStore.getState().logout();
          try {
            sessionStorage.removeItem("auth_mode");
            sessionStorage.removeItem("auth_intended_role");
            sessionStorage.removeItem("auth_redirect_after_login");
          } catch (_) {}

          await supabase.auth.signOut({ scope: "local" });
          if (typeof window !== "undefined") {
            let entryBase = "/auth";
            try {
              const stored = sessionStorage.getItem("auth_entry_base");
              if (stored?.startsWith("/")) entryBase = stored;
            } catch (_) {}
            window.location.assign(
              waitlistBlockedAuthUrl(window.location.origin, email, entryBase)
            );
          }
          return;
        }

        if (gate.approvedRole) {
          approvedRole = gate.approvedRole;
          if (applyWhitelistRole) {
            try {
              sessionStorage.setItem("auth_intended_role", gate.approvedRole);
            } catch (_) {}
          }
        }
      }
    }

    if (data) {
      let row = data as unknown as Profile;
      if (!row.student_code?.trim()) {
        // RPC exists in DB; generated Database types may lag until regenerate.
        const { data: minted, error: mintErr } = await (supabase as any).rpc(
          "ensure_my_student_code",
        );
        if (mintErr) {
          console.warn("[auth] ensure_my_student_code:", mintErr.message);
        } else if (typeof minted === "string" && minted.trim()) {
          row = { ...row, student_code: minted };
        }
      }
      if (profileShouldForceOnboardingComplete(row, { isSignIn: isSignInFlow })) {
        const { data: repaired, error: repairErr } = await supabase
          .from("profiles")
          .update({ onboarding_complete: true })
          .eq("id", userId)
          .select()
          .maybeSingle();
        if (repairErr) console.error("[auth] repair onboarding_complete:", repairErr.message);
        if (repaired) row = repaired as unknown as Profile;
      }
      // Sign-in with Google: trust the profile row from Supabase — do not realign role
      // from stale sessionStorage (e.g. a prior "join as student" visit).
      // Check if role needs correction based on explicit signup role choice only
      let intendedRole: "student" | "teacher" | null = null;
      if (applyWhitelistRole && approvedRole) {
        intendedRole = approvedRole;
      } else if (applyWhitelistRole) {
        try {
          const stored = sessionStorage.getItem("auth_intended_role");
          if (stored === "teacher" || stored === "student") intendedRole = stored;
        } catch (_) {}
      }
      if (intendedRole && row.role !== intendedRole && !row.onboarding_complete) {
        // Whitelist-backed role sync (SECURITY DEFINER). Direct client role writes are blocked.
        const { data: syncedRole, error: syncErr } = await (supabase as any).rpc(
          "sync_my_profile_role_from_whitelist",
        );
        if (syncErr) {
          console.warn("[auth] sync_my_profile_role_from_whitelist:", syncErr.message);
        }
        // Only trust whitelist RPC — never elevate from sessionStorage intendedRole alone.
        if (syncedRole === "teacher" || syncedRole === "student") {
          const effectiveRole = syncedRole as "student" | "teacher";
          if (effectiveRole !== row.role) {
            const { data: refreshed } = await supabase
              .from("profiles")
              .select("*")
              .eq("id", userId)
              .maybeSingle();
            if (refreshed && (refreshed as { role?: string }).role === effectiveRole) {
              row = refreshed as unknown as Profile;
            } else {
              // Keep UI on the whitelist role even if the row has not refreshed yet.
              row = { ...row, role: effectiveRole };
            }
          }
        }
      }
      applyProfileOnboardingLocalState(userId, row);
      setProfile(row);
      if (typeof row.rdm === "number") useUserStore.getState().setRdmFromProfile(row.rdm);
      return;
    }
    // Profile read failed (RLS, network, or row missing). Do NOT upsert — that would overwrite
    // an existing completed profile with onboarding_complete: false when token refresh fires.
    // handle_new_user trigger creates profiles for new signups. If we can't read, set null
    // and retry will happen on next auth state change or refresh.
    if (error?.code === "PGRST116" || !data) {
      const name = userMeta?.name || "User";
      let intendedRole: "student" | "teacher" = "student";
      if (applyWhitelistRole && approvedRole) {
        intendedRole = approvedRole;
      } else if (applyWhitelistRole) {
        try {
          const stored = sessionStorage.getItem("auth_intended_role");
          if (stored === "teacher" || stored === "student") intendedRole = stored;
        } catch (_) {}
      }
      // Insert as student only — privilege trigger blocks client teacher inserts.
      // Whitelist sync below elevates to teacher when approved_emails says so.
      const { data: inserted } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            name: name || "User",
            avatar_url: userMeta?.avatar_url ?? null,
            role: "student",
            onboarding_complete: false,
            google_connected: false,
            signup_google: userMeta?.provider === "google",
          },
          { onConflict: "id", ignoreDuplicates: true }
        )
        .select()
        .maybeSingle();
      if (inserted) {
        let p = inserted as unknown as Profile;
        if (applyWhitelistRole && intendedRole === "teacher") {
          const { data: syncedRole } = await (supabase as any).rpc(
            "sync_my_profile_role_from_whitelist",
          );
          // Only elevate when whitelist sync confirms teacher.
          if (syncedRole === "teacher") {
            p = { ...p, role: "teacher" };
          }
        }
        applyProfileOnboardingLocalState(userId, p);
        setProfile(p);
        if (typeof p.rdm === "number") useUserStore.getState().setRdmFromProfile(p.rdm);
      } else {
        // Row exists but ignoreDuplicates prevented update; refetch to get current state
        const { data: refetched } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", userId)
          .maybeSingle();
        if (refetched) {
          let row = refetched as unknown as Profile;
          let signIn = false;
          try {
            signIn = sessionStorage.getItem("auth_mode") === "signin";
          } catch (_) {}
          if (profileShouldForceOnboardingComplete(row, { isSignIn: signIn })) {
            const { data: repaired, error: repairErr } = await supabase
              .from("profiles")
              .update({ onboarding_complete: true })
              .eq("id", userId)
              .select()
              .maybeSingle();
            if (repairErr)
              console.error("[auth] repair onboarding_complete (refetch):", repairErr.message);
            if (repaired) row = repaired as unknown as Profile;
          }
          if (
            applyWhitelistRole &&
            intendedRole &&
            row.role !== intendedRole &&
            !row.onboarding_complete
          ) {
            const { data: syncedRole } = await (supabase as any).rpc(
              "sync_my_profile_role_from_whitelist",
            );
            // Only trust whitelist RPC — never elevate from intendedRole alone.
            if (syncedRole === "teacher" || syncedRole === "student") {
              row = { ...row, role: syncedRole };
            }
          }
          applyProfileOnboardingLocalState(userId, row);
          setProfile(row);
          if (typeof row.rdm === "number") useUserStore.getState().setRdmFromProfile(row.rdm);
        } else setProfile(null);
      }
      return;
    }
    setProfile(null);
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Token refresh fires often; re-fetching the full profile each time causes
        // cascading client updates across dashboard + subscription UI.
        if (event !== "TOKEN_REFRESHED") {
          const meta = session.user.user_metadata || {};
          const provider = session.user.app_metadata?.provider;
          setTimeout(
            () =>
              fetchProfile(session.user.id, {
                name: meta.full_name || meta.name,
                avatar_url: meta.avatar_url,
                provider,
                email: session.user.email,
              }),
            0
          );
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    safeGetSession().then(({ session }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        const provider = session.user.app_metadata?.provider;
        fetchProfile(session.user.id, {
          name: meta.full_name || meta.name,
          avatar_url: meta.avatar_url,
          provider,
          email: session.user.email,
        });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile) return;
    const bindLocalUserToProfile = () => {
      const cl = profile.class_level;
      const classLevel: ClassLevel = cl === 11 || cl === 12 ? cl : 12;
      const subjectCombo: SubjectCombo = "PCM";
      useUserStore
        .getState()
        .bindToAuthUser(profile.id, profile.name || "User", classLevel, "science", subjectCombo);
    };
    const syncExamFromProfile = () => {
      if (profile.role !== "student") return;
      const next = targetExamToExamType(profile.target_exam);
      useUserStore.getState().setExamType(next);
    };
    const syncSavedFromProfile = async () => {
      const store = useUserStore.getState();
      if (!store.user || store.linkedAuthUserId !== profile.id) return;
      try {
        const { fetchSavedContent } = await import("@/lib/saved/savedContentService");
        const server = await fetchSavedContent();
        const merged = mergeAllSavedContent(
          store.user.savedBits ?? [],
          store.user.savedFormulas ?? [],
          store.user.savedRevisionCards ?? [],
          store.user.savedRevisionUnits ?? [],
          store.user.savedCommunityPosts ?? [],
          server.savedBits,
          server.savedFormulas,
          server.savedRevisionCards,
          server.savedRevisionUnits,
          server.savedCommunityPosts
        );
        useUserStore
          .getState()
          .setSavedFromServer(
            merged.savedBits,
            merged.savedFormulas,
            merged.savedRevisionCards,
            merged.savedRevisionUnits,
            merged.savedCommunityPosts
          );
      } catch (e) {
        console.warn("[useAuth] saved content sync skipped", e);
      }
    };
    const run = () => {
      bindLocalUserToProfile();
      syncExamFromProfile();
      syncSavedFromProfile();
    };
    const persist = (
      useUserStore as unknown as {
        persist?: { onFinishHydration: (cb: () => void) => () => void; hasHydrated: () => boolean };
      }
    ).persist;
    if (persist?.onFinishHydration) {
      if (persist.hasHydrated?.()) {
        run();
        return;
      }
      return persist.onFinishHydration(() => run());
    }
    run();
  }, [
    profile?.id,
    profile?.name,
    profile?.role,
    profile?.class_level,
    profile?.target_exam,
    profile?.subject_combo,
  ]);

  /**
   * The auth actions below are wrapped in `useCallback` so the context value can be
   * memoized. Without stable identities every consumer of `useAuth()` — which is most
   * of the app — re-renders on any auth or profile state change.
   *
   * They close over nothing reactive: `supabase` and `useUserStore.getState()` are
   * module-level, and React setters are stable.
   */
  const signInWithGoogle = useCallback(async (redirectPath: string = "/onboarding") => {
    const normalized = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
    try {
      const pendingLesson = readPendingDeepLink();
      sessionStorage.setItem("auth_redirect_after_login", pendingLesson ?? normalized);
    } catch (_) {}
    await safeGetSession();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) console.error("signInWithOAuth", error);
  }, []);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      await supabase.auth.signOut({ scope: "others" });
      triggerLoginNotificationEmail();
    }
    return { error };
  }, []);

  const signUpWithEmail = useCallback(async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: { full_name: name },
      },
    });
    const needsEmailConfirmation = Boolean(!error && data?.user && !data?.session);
    return { error, needsEmailConfirmation };
  }, []);

  const verifySignUpEmailOtp = useCallback(async (email: string, token: string) => {
    const cleaned = token.replace(/\s/g, "");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: cleaned,
      type: "signup",
    });
    if (!error) {
      triggerLoginNotificationEmail();
    }
    return { error };
  }, []);

  const resendSignUpEmailOtp = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });
    return { error };
  }, []);

  const signOut = useCallback(async (redirectAfter?: string) => {
    /**
     * Clear local React + store state FIRST so the UI snaps to "logged out"
     * even if the network signOut call lags. Without this, a slow Supabase
     * roundtrip leaves Log Out feeling broken (esp. in the teacher portal
     * where the page re-renders against still-present session state).
     */
    useUserStore.getState().logout();
    setProfile(null);
    setSession(null);
    setUser(null);

    try {
      sessionStorage.removeItem("auth_mode");
      sessionStorage.removeItem("auth_intended_role");
      sessionStorage.removeItem("auth_redirect_after_login");
    } catch (_) {}

    try {
      const auth = await getClientApiAuthHeaders();
      void fetch("/api/user/site-presence", {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          ...(auth.Authorization ? { Authorization: auth.Authorization } : {}),
        },
        body: JSON.stringify({ offline: true, signedOut: true }),
      });
    } catch {
      /* non-fatal */
    }

    // Default scope clears both local storage AND server cookies via the SSR cookie
    // adapter, so Edge middleware sees the user as anonymous on the next request.
    // MUST await: GoTrue signOut does network calls (token refresh + server revocation)
    // before clearing cookies. If we navigate before cookies are cleared, the middleware
    // sees a valid session and bounces the user back into the app.
    try {
      await supabase.auth.signOut();
    } catch {
      // Fall back to a guaranteed-local clear if the network call fails (e.g. offline).
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }

    const dest = redirectAfter ?? "/";
    const target = dest.startsWith("/") ? dest : `/${dest}`;
    // Full reload (not router.replace) so middleware re-evaluates fresh cookies
    // and no stale React subtree (teacher portal, classroom feeds) lingers.
    if (typeof window !== "undefined") {
      window.location.assign(target);
      return;
    }
    router.replace(target);
    router.refresh();
  }, [router]);

  const fetchProfileRef = useRef(fetchProfile);
  fetchProfileRef.current = fetchProfile;

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await fetchProfileRef.current(user.id);
  }, [user?.id]);

  const value = useMemo(
    () => ({
      user,
      session,
      profile,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      verifySignUpEmailOtp,
      resendSignUpEmailOtp,
      signOut,
      refreshProfile,
    }),
    [
      user,
      session,
      profile,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      verifySignUpEmailOtp,
      resendSignUpEmailOtp,
      signOut,
      refreshProfile,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
