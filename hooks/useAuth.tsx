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
import type {
  ClassLevel,
  SubjectCombo,
  SavedBit,
  SavedFormula,
  SavedRevisionCard,
  SavedRevisionUnit,
  SavedCommunityPost,
} from "@/types";
import { targetExamToExamType } from "@/lib/targetExam";
import { mergeAllSavedContent } from "@/lib/mergeSavedContent";
import type { Json } from "@/integrations/supabase/types";
import { safeGetSession } from "@/lib/safeSession";
import { profileShouldForceOnboardingComplete } from "@/lib/profileOnboardingRepair";
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
  saved_bits?: SavedBit[];
  saved_formulas?: SavedFormula[];
  saved_revision_cards?: SavedRevisionCard[];
  saved_revision_units?: SavedRevisionUnit[];
  saved_community_posts?: SavedCommunityPost[];
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
          setProfile(updatedProfile);
          if (typeof updatedProfile.rdm === "number")
            useUserStore.getState().setRdmFromProfile(updatedProfile.rdm);
          return;
        }
      }
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
    const maybeSignup = () => {
      if (useUserStore.getState().user) return;
      const cl = profile.class_level;
      const classLevel: ClassLevel = cl === 11 || cl === 12 ? cl : 12;
      const subjectCombo: SubjectCombo = "PCM";
      useUserStore.getState().signup(profile.name || "User", classLevel, "science", subjectCombo);
    };
    const syncExamFromProfile = () => {
      if (profile.role !== "student") return;
      const next = targetExamToExamType(profile.target_exam);
      useUserStore.getState().setExamType(next);
    };
    const syncSavedFromProfile = () => {
      const u = useUserStore.getState().user;
      if (!u) return;
      const bits = Array.isArray(profile.saved_bits) ? profile.saved_bits : [];
      const formulas = Array.isArray(profile.saved_formulas) ? profile.saved_formulas : [];
      const revisionCards = Array.isArray(profile.saved_revision_cards)
        ? profile.saved_revision_cards
        : [];
      const revisionUnits = Array.isArray(profile.saved_revision_units)
        ? profile.saved_revision_units
        : [];
      const communityPosts = Array.isArray(profile.saved_community_posts)
        ? profile.saved_community_posts
        : [];
      const merged = mergeAllSavedContent(
        u.savedBits ?? [],
        u.savedFormulas ?? [],
        u.savedRevisionCards ?? [],
        u.savedRevisionUnits ?? [],
        u.savedCommunityPosts ?? [],
        bits,
        formulas,
        revisionCards,
        revisionUnits,
        communityPosts
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
      maybeSignup();
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
    profile?.saved_bits,
    profile?.saved_formulas,
    profile?.saved_revision_cards,
    profile?.saved_revision_units,
    profile?.saved_community_posts,
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
    try {
      // Local scope avoids a server round-trip (works offline; prevents hang on network errors).
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    }
    useUserStore.getState().logout();
    setProfile(null);
    setSession(null);
    setUser(null);
    const dest = redirectAfter ?? "/";
    router.replace(dest.startsWith("/") ? dest : `/${dest}`);
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
