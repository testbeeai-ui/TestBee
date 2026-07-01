import { apiJson } from "./client";

export type ProfileAttendanceSummary = {
  classroomsJoined: number;
  assignmentTasksDone: number;
  dailyDoseDualStreak: number;
  mocksAttempted: number;
  instacueDwellEventsThisWeek: number;
  studyMsTotal: number;
};

export type RecentClaim = {
  key: string;
  category: string;
  title: string;
  detail: string;
  amount: number;
  at: string;
};

export type RdmRecentActivity = {
  windowDays: number;
  totalInWindow: number;
  gyan: number;
  play: number;
  mocks: number;
  revision: number;
  recentClaims: RecentClaim[];
};

export type TrialGateStatus = {
  required: boolean;
  blockers: string[];
  plan_tier?: string | null;
  free_trial_activated?: boolean | null;
  free_trial_activated_at?: string | null;
};

export type OnboardingRewardStatus = {
  freeTrialActivated: boolean;
  claimedEver: boolean;
  checklistRewardRdm: number;
};

export const profileApi = {
  getAttendanceSummary: () =>
    apiJson<ProfileAttendanceSummary>("/api/user/profile-attendance-summary"),

  getRdmRecentActivity: (days = 28) =>
    apiJson<RdmRecentActivity>(`/api/user/rdm-recent-by-activity?days=${days}`),

  getTrialGate: () => apiJson<TrialGateStatus>("/api/user/trial-payment-gate"),

  getOnboardingReward: () => apiJson<OnboardingRewardStatus>("/api/user/onboarding-reward"),
};
