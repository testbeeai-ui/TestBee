import { apiJson } from "./client";

export type BuddyStateResponse = {
  buddies: Array<{
    id: string;
    name: string | null;
    rdm: number;
    pairedAt: string;
  }>;
  pendingInvites: Array<{
    id: string;
    token: string;
    createdAt: string;
    expiresAt: string | null;
  }>;
  maxBuddies: number;
  buddiesUnlimited: boolean;
};

export type ReferralEntry = {
  id: string;
  creditedAt: string;
  refereeName: string;
};

export type LeaderboardEntry = {
  rank: number;
  name: string;
  referralCount: number;
};

export const earnApi = {
  getBuddyState: () => apiJson<BuddyStateResponse>("/api/buddy/state"),

  createBuddyInvite: () =>
    apiJson<{ ok: boolean; shareUrl?: string; waText?: string; error?: string }>(
      "/api/buddy/invite",
      { method: "POST", body: JSON.stringify({}) }
    ),

  getMyReferrals: () =>
    apiJson<{ entries: ReferralEntry[] }>("/api/referral/my-referrals"),

  getLeaderboard: () =>
    apiJson<{ weekStartIst: string; entries: LeaderboardEntry[] }>("/api/referral/leaderboard"),
};
