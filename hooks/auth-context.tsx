"use client";

import { createContext } from "react";
import type { AuthError, Session, User } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";

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
  free_trial_activated?: boolean | null;
  free_trial_activated_at?: string | null;
  plan_tier?: string;
  /** ISO timestamp of when the student activated a paid plan (starter/pro). Used for loyalty multipliers. */
  subscription_started_at?: string | null;
  /** Coupon- or admin-granted paid plan end; authoritative when set (see normalizePlanTier). */
  subscription_expires_at?: string | null;
  time_travel_enabled?: boolean;
  time_travel_offset_ms?: number;
  trial_onboarding_answers?: Json | null;
  onboarding_reward_progress?: Json | null;
  onboarding_reward_claimed_at?: string | null;
  free_trial_daily_streak?: Json | null;
  trial_second_round_activated?: boolean;
  payment_card_details?: Json | null;
  card_added_at?: string | null;
  trial_end_bonus_activated?: boolean;
  trial_streak_at_day_14?: number | null;
  trial_original_ended_at?: string | null;
  /** Consecutive days (same gauntlet_date) completing both academic + funbrain DailyDose. */
  daily_dose_streak?: number;
  rdm?: number;
  /** Submitted topic-quiz attempts keyed like bits-attempts API; retakes overwrite same key. */
  bits_test_attempts?: Json | null;
  /** Per-lesson engagement snapshots (in-progress quiz draft lives under bits + graded). */
  subtopic_engagement?: Json | null;
  /** Dashboard daily checklist acks / Gyan++ focus ms by local date key. */
  daily_checklist_state?: Json | null;
  /** Optional Class X subject marks + coaching (JSON on profiles row). */
  academic_record_extras?: Json | null;
}

export interface AuthContextType {
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
  verifySignUpEmailOtp: (email: string, token: string) => Promise<{ error: AuthError | null }>;
  resendSignUpEmailOtp: (email: string) => Promise<{ error: AuthError | null }>;
  signOut: (redirectAfter?: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

/** Single React context instance — import this module from both AuthProvider and useAuth. */
export const AuthContext = createContext<AuthContextType | null>(null);
