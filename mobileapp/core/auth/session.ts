import type { Session, User } from "@supabase/supabase-js";

export type AuthBlockReason = "not_approved" | "no_email" | "teacher_app" | "oauth_cancelled";

export type AuthBlock = {
  reason: AuthBlockReason;
  email?: string | null;
  message: string;
};

export type MobileProfile = {
  id: string;
  role: string | null;
  onboarding_complete: boolean | null;
  name: string | null;
  first_name: string | null;
  plan_tier: string | null;
  rdm: number | null;
};

export type AuthSessionState = {
  session: Session | null;
  user: User | null;
  profile: MobileProfile | null;
  isLoading: boolean;
  isSigningIn: boolean;
  signInStatus: string | null;
  isAuthenticated: boolean;
  needsWebOnboarding: boolean;
  authBlock: AuthBlock | null;
};

export const INITIAL_AUTH_STATE: AuthSessionState = {
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  isSigningIn: false,
  signInStatus: null,
  isAuthenticated: false,
  needsWebOnboarding: false,
  authBlock: null,
};
