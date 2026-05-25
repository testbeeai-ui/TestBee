import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/integrations/supabase/client";
import type { AuthError, User, Session } from "@supabase/supabase-js";
import { useUserStore } from "@/store/useUserStore";
import type { ClassLevel, SubjectCombo } from "@/types";
import { targetExamToExamType } from "@/lib/profile/targetExam";
import { mergeAllSavedContent } from "@/lib/saved/mergeSavedContent";
import type { Json } from "@/integrations/supabase/types";
import { getClientApiAuthHeaders } from "@/lib/auth/clientApiAuth";
import { safeGetSession } from "@/lib/auth/safeSession";
import { profileShouldForceOnboardingComplete } from "@/lib/profile/profileOnboardingRepair";
import { readPendingDeepLink } from "@/lib/auth/safeNextPath";

export interface Profile {
  id: string;
  /** Profile row creation time from Supabase (ISO). */
  created_at?: string | null;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  state?: string | null;
  city?: string | null;
  /** 10-digit national number without +91. */
  phone?: string | null;
  gender?: string | null;
  category?: string | null;
  date_of_birth?: string | null;
  institution_name?: string | null;
  board?: string | null;
  current_class_label?: string | null;
  role: "student" | "teacher" | "admin";
  class_level: number | null;
  target_exam?: string | null;
  stream: string | null;
  subject_combo: string | null;
  avatar_url: string | null;
  bio: string | null;
  teaching_levels: number[] | null;
  subjects: string[] | null;
  exam_tags: string[] | null;
  visibility: string;
  google_connected: boolean;
  /** Supabase auth originally used Google — not the same as Calendar OAuth. */
  signup_google?: boolean;
  onboarding_complete: boolean;
  /** Consecutive days (same gauntlet_date) completing both academic + funbrain DailyDose. */
  daily_dose_streak?: number;
  rdm?: number;
  // saved_* columns removed — now read from user_saved_items table via API
  /** Submitted topic-quiz attempts keyed like bits-attempts API; retakes overwrite same key. */
  bits_test_attempts?: Json | null;
  /** Per-lesson engagement snapshots (in-progress quiz draft lives under bits + graded). */
  subtopic_engagement?: Json | null;
  /** Dashboard daily checklist acks / Gyan++ focus ms by local date key. */
  daily_checklist_state?: Json | null;
  /** Optional Class X subject marks + coaching (JSON on profiles row). */
  academic_record_extras?: Json | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithEmail: (
    email: string,
    password: string,
    name: string
  ) => Promise<{ error: AuthError | null; needsEmailConfirmation: boolean }>;
  /** After email/password sign-up (confirmations on), user enters the code from email. */
  verifySignUpEmailOtp: (email: string, token: string) => Promise<{ error: AuthError | null }>;
  resendSignUpEmailOtp: (email: string) => Promise<{ error: AuthError | null }>;
  /** Clears session; navigates to `redirectAfter` or `/` (marketing landing). */
  signOut: (redirectAfter?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

function bindLocalUserStoreToProfile(profile: Profile) {
  const cl = profile.class_level;
  const classLevel: ClassLevel = cl === 11 || cl === 12 ? cl : 12;
  const subjectCombo: SubjectCombo = "PCM";
  useUserStore
    .getState()
    .bindToAuthUser(profile.id, profile.name || "User", classLevel, "science", subjectCombo);
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (
    userId: string,
    userMeta?: { name?: string; avatar_url?: string; provider?: string }
  ) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (data) {
      let row = data as unknown as Profile;
      let isSignInFlow = false;
      try {
        isSignInFlow = sessionStorage.getItem("auth_mode") === "signin";
      } catch (_) {}
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
      if (!isSignInFlow) {
        try {
          const stored = sessionStorage.getItem("auth_intended_role");
          if (stored === "teacher" || stored === "student") intendedRole = stored;
        } catch (_) {}
      }
      if (intendedRole && row.role !== intendedRole && !row.onboarding_complete) {
        // Update profile to correct role before setting it
        const { data: updated } = await supabase
          .from("profiles")
          .update({ role: intendedRole })
          .eq("id", userId)
          .select()
          .maybeSingle();
        if (updated) {
          const updatedProfile = updated as unknown as Profile;
          bindLocalUserStoreToProfile(updatedProfile);
          if (typeof updatedProfile.rdm === "number")
            useUserStore.getState().setRdmFromProfile(updatedProfile.rdm);
          setProfile(updatedProfile);
          return;
        }
      }
      bindLocalUserStoreToProfile(row);
      if (typeof row.rdm === "number") useUserStore.getState().setRdmFromProfile(row.rdm);
      setProfile(row);
      return;
    }
    // Profile read failed (RLS, network, or row missing). Do NOT upsert — that would overwrite
    // an existing completed profile with onboarding_complete: false when token refresh fires.
    // handle_new_user trigger creates profiles for new signups. If we can't read, set null
    // and retry will happen on next auth state change or refresh.
    if (error?.code === "PGRST116" || !data) {
      const name = userMeta?.name || "User";
      let isSignInFlow = false;
      try {
        isSignInFlow = sessionStorage.getItem("auth_mode") === "signin";
      } catch (_) {}
      let intendedRole: "student" | "teacher" = "student";
      if (!isSignInFlow) {
        try {
          const stored = sessionStorage.getItem("auth_intended_role");
          if (stored === "teacher" || stored === "student") intendedRole = stored;
        } catch (_) {}
      }
      const { data: inserted } = await supabase
        .from("profiles")
        .upsert(
          {
            id: userId,
            name: name || "User",
            avatar_url: userMeta?.avatar_url ?? null,
            role: intendedRole,
            onboarding_complete: false,
            google_connected: false,
            signup_google: userMeta?.provider === "google",
          },
          { onConflict: "id", ignoreDuplicates: true }
        )
        .select()
        .maybeSingle();
      if (inserted) {
        const p = inserted as unknown as Profile;
        bindLocalUserStoreToProfile(p);
        if (typeof p.rdm === "number") useUserStore.getState().setRdmFromProfile(p.rdm);
        setProfile(p);
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
          bindLocalUserStoreToProfile(row);
          if (typeof row.rdm === "number") useUserStore.getState().setRdmFromProfile(row.rdm);
          setProfile(row);
        } else setProfile(null);
      }
      return;
    }
    setProfile(null);
  };

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        const provider = session.user.app_metadata?.provider;
        setTimeout(
          () =>
            fetchProfile(session.user.id, {
              name: meta.full_name || meta.name,
              avatar_url: meta.avatar_url,
              provider,
            }),
          0
        );
      } else {
        useUserStore.getState().logout();
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
        });
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!profile) return;
    const bindLocalUserToProfile = () => {
      bindLocalUserStoreToProfile(profile);
    };
    const syncExamFromProfile = () => {
      if (profile.role !== "student") return;
      const next = targetExamToExamType(profile.target_exam);
      useUserStore.getState().setExamType(next);
    };
    const syncSavedFromProfile = async () => {
      const store = useUserStore.getState();
      if (!store.user || store.linkedAuthUserId !== profile.id) return;
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

  const signInWithGoogle = async (redirectPath: string = "/onboarding") => {
    const normalized = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
    try {
      const pendingLesson = readPendingDeepLink();
      sessionStorage.setItem("auth_redirect_after_login", pendingLesson ?? normalized);
    } catch (_) {}
    await safeGetSession();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) console.error("signInWithOAuth", error);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) await supabase.auth.signOut({ scope: "others" });
    return { error };
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
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
  };

  const verifySignUpEmailOtp = async (email: string, token: string) => {
    const cleaned = token.replace(/\s/g, "");
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: cleaned,
      type: "signup",
    });
    return { error };
  };

  const resendSignUpEmailOtp = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
    });
    return { error };
  };

  const signOut = async (redirectAfter?: string) => {
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
  };

  const fetchProfileRef = useRef(fetchProfile);
  fetchProfileRef.current = fetchProfile;

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await fetchProfileRef.current(user.id);
  }, [user?.id]);

  return (
    <AuthContext.Provider
      value={{
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
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
