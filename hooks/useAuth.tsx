import { createContext, useContext, useCallback, useEffect, useRef, useState, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { AuthError, User, Session } from '@supabase/supabase-js';
import { useUserStore } from '@/store/useUserStore';
import type {
  ClassLevel,
  SubjectCombo,
  SavedBit,
  SavedFormula,
  SavedRevisionCard,
  SavedRevisionUnit,
} from '@/types';
import { targetExamToExamType } from '@/lib/targetExam';
import { mergeAllSavedContent } from '@/lib/mergeSavedContent';
import type { Json } from '@/integrations/supabase/types';

interface Profile {
  id: string;
  /** Profile row creation time from Supabase (ISO). */
  created_at?: string | null;
  name: string;
  role: 'student' | 'teacher' | 'admin';
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
  onboarding_complete: boolean;
  rdm?: number;
  saved_bits?: SavedBit[];
  saved_formulas?: SavedFormula[];
  saved_revision_cards?: SavedRevisionCard[];
  saved_revision_units?: SavedRevisionUnit[];
  /** Submitted topic-quiz (Bits) attempts keyed like bits-attempts API; retakes overwrite same key. */
  bits_test_attempts?: Json | null;
  /** Per-lesson engagement snapshots (in-progress quiz draft lives under bits + graded). */
  subtopic_engagement?: Json | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: (redirectPath?: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string, userMeta?: { name?: string; avatar_url?: string; provider?: string }) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (data) {
      const p = data as unknown as Profile;
      setProfile(p);
      if (typeof p.rdm === 'number') useUserStore.getState().setRdmFromProfile(p.rdm);
      return;
    }
    // Profile read failed (RLS, network, or row missing). Do NOT upsert — that would overwrite
    // an existing completed profile with onboarding_complete: false when token refresh fires.
    // handle_new_user trigger creates profiles for new signups. If we can't read, set null
    // and retry will happen on next auth state change or refresh.
    if (error?.code === 'PGRST116' || !data) {
      const name = userMeta?.name || 'User';
      const { data: inserted } = await supabase
        .from('profiles')
        .upsert(
          {
            id: userId,
            name: name || 'User',
            avatar_url: userMeta?.avatar_url ?? null,
            role: 'student',
            onboarding_complete: false,
            google_connected: userMeta?.provider === 'google',
          },
          { onConflict: 'id', ignoreDuplicates: true }
        )
        .select()
        .maybeSingle();
      if (inserted) {
        const p = inserted as unknown as Profile;
        setProfile(p);
        if (typeof p.rdm === 'number') useUserStore.getState().setRdmFromProfile(p.rdm);
      } else {
        // Row exists but ignoreDuplicates prevented update; refetch to get current state
        const { data: refetched } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        if (refetched) {
          const p = refetched as unknown as Profile;
          setProfile(p);
          if (typeof p.rdm === 'number') useUserStore.getState().setRdmFromProfile(p.rdm);
        } else setProfile(null);
      }
      return;
    }
    setProfile(null);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          const meta = session.user.user_metadata || {};
          const provider = session.user.app_metadata?.provider;
          setTimeout(() => fetchProfile(session.user.id, {
            name: meta.full_name || meta.name,
            avatar_url: meta.avatar_url,
            provider,
          }), 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
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
      const classLevel: ClassLevel = (cl === 11 || cl === 12) ? cl : 12;
      const subjectCombo: SubjectCombo = profile.subject_combo === 'PCMB' ? 'PCMB' : 'PCM';
      useUserStore.getState().signup(profile.name || 'User', classLevel, 'science', subjectCombo);
    };
    const syncExamFromProfile = () => {
      if (profile.role !== 'student') return;
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
      const merged = mergeAllSavedContent(
        u.savedBits ?? [],
        u.savedFormulas ?? [],
        u.savedRevisionCards ?? [],
        u.savedRevisionUnits ?? [],
        bits,
        formulas,
        revisionCards,
        revisionUnits
      );
      useUserStore.getState().setSavedFromServer(
        merged.savedBits,
        merged.savedFormulas,
        merged.savedRevisionCards,
        merged.savedRevisionUnits
      );
    };
    const run = () => {
      maybeSignup();
      syncExamFromProfile();
      syncSavedFromProfile();
    };
    const persist = (useUserStore as unknown as { persist?: { onFinishHydration: (cb: () => void) => () => void; hasHydrated: () => boolean } }).persist;
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
  ]);

  const signInWithGoogle = async (redirectPath: string = '/onboarding') => {
    const normalized = redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`;
    try {
      sessionStorage.setItem('auth_redirect_after_login', normalized);
    } catch (_) {}
    await supabase.auth.getSession();
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) console.error('signInWithOAuth', error);
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) await supabase.auth.signOut({ scope: 'others' });
    return { error };
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: name },
      },
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  const fetchProfileRef = useRef(fetchProfile);
  fetchProfileRef.current = fetchProfile;

  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await fetchProfileRef.current(user.id);
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
