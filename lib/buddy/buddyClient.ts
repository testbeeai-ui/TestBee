import type {
  BuddyAdvancedSections,
  BuddyPrivacySettings,
} from "@/lib/buddy/buddyPrivacy";

export type BuddyProfile = {
  id: string;
  name: string | null;
  avatarUrl: string | null;
  classLevel: number | null;
  /** Total RDM balance on profiles.rdm */
  rdm: number;
  pairedAt?: string;
};

/** Safe RDM for UI when API/cache omitted `rdm` (older clients). */
export function normalizeBuddyRdm(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0;
}

export function withBuddyRdm<T extends Omit<BuddyProfile, "rdm"> & { rdm?: number | null }>(
  profile: T
): BuddyProfile {
  return { ...profile, rdm: normalizeBuddyRdm(profile.rdm) };
}

export type BuddyPendingInvite = {
  id: string;
  token: string;
  status: "pending" | "accepted" | "expired" | "revoked";
  createdAt: string;
  expiresAt: string;
};

export type BuddyStateResponse = {
  /** All active study buddies (new). */
  buddies: BuddyProfile[];
  /** First active buddy — legacy single-buddy UIs. */
  buddy: BuddyProfile | null;
  pendingInvites: BuddyPendingInvite[];
  maxBuddies: number;
};

export type BuddyInviteResponse = {
  ok: true;
  invite: {
    id: string;
    token: string;
    status: "pending";
    created_at: string;
    expires_at: string;
  };
  shareUrl: string;
  waText: string;
};

export type BuddyInvitePreview = {
  ok: true;
  invite: {
    token: string;
    status: "pending" | "accepted" | "expired" | "revoked";
    createdAt: string;
    acceptedAt: string | null;
    expiresAt: string;
  };
  inviter: { id: string; name: string | null; avatarUrl: string | null } | null;
};

export type BuddyAcceptResponse = {
  ok: true;
  pairId?: string | null;
  alreadyPaired?: boolean;
  referralCredited?: boolean;
};

export type BuddyDashboardResponse = {
  buddy: BuddyProfile;
  /** True when buddy had a site/subtopic/Gyan heartbeat in the last few minutes. */
  buddyOnline: boolean;
  rightNow:
    | {
        kind: "quiz_attempted";
        subject: string | null;
        topic: string | null;
        subtopic: string | null;
        level: string | null;
        panel: "bits";
        scorePercent: number | null;
        correct: number | null;
        total: number | null;
        setLabel: string | null;
        lastActiveAt: string;
        href: string | null;
      }
    | {
        kind: "gyan_active";
        title: string;
        subject: string | null;
        lastActiveAt: string;
        href: string;
      }
    | {
        kind: "gyan_browsing";
        lastActiveAt: string;
        href: string;
      }
    | {
        kind: "community_posted";
        title: string;
        subject: string | null;
        lastActiveAt: string;
        href: string;
      }
    | {
        kind: "studying" | "idle";
        subject?: string | null;
        topic?: string | null;
        subtopic?: string | null;
        panel?: string | null;
        level?: string | null;
        lastActiveAt: string | null;
        href?: string | null;
      }
    | { kind: "online"; lastActiveAt: string }
    | { kind: "idle"; lastActiveAt: string | null };
  gyanRecent: Array<{
    id: string;
    kind: "doubt" | "answer";
    title: string;
    createdAt: string;
    href: string;
  }>;
  subtopic: {
    current: {
      board: string | null;
      subject: string | null;
      classLevel: number | null;
      topic: string | null;
      subtopic: string | null;
      level: string | null;
      panel: string | null;
      updatedAt: string;
      href: string | null;
    } | null;
    lastOn: {
      board: string | null;
      subject: string | null;
      classLevel: number | null;
      topic: string | null;
      subtopic: string | null;
      level: string | null;
      panel: string | null;
      updatedAt: string;
      href: string | null;
      isRecent: boolean;
    } | null;
    completedRecent: Array<{
      board: string | null;
      subject: string | null;
      classLevel: number | null;
      topic: string;
      subtopic: string;
      level: string;
      completedAt: string;
      href: string | null;
    }>;
  };
  playArena: {
    rdmEarnedToday: number;
    rdmEarnedLast7Days: number;
    gauntletStreakDays: number;
    gauntletDaysLast30: number;
    challengesAttemptedToday: number;
    challengesClaimedLast7Days: number;
    recent: Array<{
      id: string;
      kind: "daily_dose" | "quant_blitz" | "numerals" | "challenge" | "streak_bonus" | "other";
      title: string;
      subtitle: string;
      rdmBadge: string | null;
      href: string;
      occurredAt: string;
    }>;
    playRdmMissedToday: number;
    blitzRoundsToday: number;
  };
  mcqRecent: Array<{
    id: string;
    source: "topic_quiz" | "mock";
    paperName: string;
    scorePercent: number | null;
    correct: number | null;
    total: number | null;
    takenAt: string;
    href: string;
  }>;
  generatedAt: string;
};

export type BuddyAdvancedDashboardResponse = BuddyDashboardResponse & {
  visibility: BuddyPrivacySettings;
  privacyNotice: string;
  advanced: BuddyAdvancedSections;
};

async function jsonFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, {
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : ({} as unknown);
  if (!res.ok) {
    const message =
      (data as { error?: string })?.error ?? `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export function fetchBuddyState(): Promise<BuddyStateResponse> {
  return jsonFetch<BuddyStateResponse>("/api/buddy/state", { cache: "no-store" });
}

export type BuddyActivitySignal = {
  revision: string;
  presenceUpdatedAt: string | null;
  dwellOccurredAt: string | null;
};

export function fetchBuddyActivitySignal(buddyId?: string): Promise<BuddyActivitySignal> {
  const q = buddyId ? `?buddyId=${encodeURIComponent(buddyId)}` : "";
  return jsonFetch<BuddyActivitySignal>(`/api/buddy/activity-signal${q}`, {
    cache: "no-store",
  });
}

export function fetchBuddyDashboard(
  buddyId?: string
): Promise<BuddyAdvancedDashboardResponse> {
  const q = buddyId ? `?buddyId=${encodeURIComponent(buddyId)}` : "";
  return jsonFetch<BuddyAdvancedDashboardResponse>(`/api/buddy/dashboard${q}`, {
    cache: "no-store",
  });
}

export function fetchBuddyPrivacySettings(): Promise<{ settings: BuddyPrivacySettings }> {
  return jsonFetch<{ settings: BuddyPrivacySettings }>("/api/buddy/privacy");
}

export function updateBuddyPrivacySettings(
  settings: Partial<BuddyPrivacySettings>
): Promise<{ ok: boolean; settings: BuddyPrivacySettings }> {
  return jsonFetch<{ ok: boolean; settings: BuddyPrivacySettings }>("/api/buddy/privacy", {
    method: "PATCH",
    body: JSON.stringify({ settings }),
  });
}

export function createBuddyInvite(): Promise<BuddyInviteResponse> {
  return jsonFetch<BuddyInviteResponse>("/api/buddy/invite", { method: "POST" });
}

export function previewBuddyInvite(token: string): Promise<BuddyInvitePreview> {
  return jsonFetch<BuddyInvitePreview>(`/api/buddy/invite/${encodeURIComponent(token)}`);
}

export function acceptBuddyInvite(token: string): Promise<BuddyAcceptResponse> {
  return jsonFetch<BuddyAcceptResponse>(
    `/api/buddy/invite/${encodeURIComponent(token)}/accept`,
    { method: "POST" }
  );
}

export function revokeBuddyInvite(token: string): Promise<{ ok: boolean }> {
  return jsonFetch<{ ok: boolean }>(`/api/buddy/invite/${encodeURIComponent(token)}`, {
    method: "DELETE",
  });
}

export function endBuddyPair(buddyUserId?: string): Promise<{ ok: boolean }> {
  return jsonFetch<{ ok: boolean }>("/api/buddy/unbuddy", {
    method: "POST",
    body: JSON.stringify(buddyUserId ? { buddyUserId } : {}),
  });
}

/** Prefilled message for email / WhatsApp — link on its own line for tap-to-open. */
export function buildBuddyInviteShareText(
  shareUrl: string,
  inviterName?: string | null
): string {
  const who = inviterName?.trim() ? inviterName.trim() : "I";
  return [
    `${who} on EduBlast wants to learn with you as a Study Buddy.`,
    `Track each other's progress and earn together.`,
    "",
    "Join here:",
    shareUrl,
  ].join("\n");
}

export function buildWaShareUrl(phoneE164OrEmpty: string, text: string): string {
  const trimmed = phoneE164OrEmpty.trim().replace(/[^\d+]/g, "");
  const phone = trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
  const base = phone ? `https://wa.me/${phone}` : `https://wa.me/`;
  return `${base}?text=${encodeURIComponent(text)}`;
}

export function isBuddyInviteEmail(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/** Opens the user's email client with a prefilled buddy invite (no server send yet). */
export function buildBuddyInviteMailto(recipientEmail: string, shareText: string): string {
  const email = recipientEmail.trim();
  const subject = encodeURIComponent("Join me as a study buddy on EduBlast");
  const body = encodeURIComponent(shareText);
  return `mailto:${encodeURIComponent(email)}?subject=${subject}&body=${body}`;
}
