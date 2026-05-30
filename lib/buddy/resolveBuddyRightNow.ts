import { buddyCommunityPostHref } from "@/lib/buddy/buddyCommunityPostHref";
import { buildTopicPath } from "@/lib/curriculum/topicRoutes";
import { latestBuddyTopicQuizAttempt } from "@/lib/buddy/listBuddyQuizMcq";
import { resolveBuddySubtopicActivity } from "@/lib/buddy/resolveBuddySubtopicActivity";
import type { BuddySubtopicActivitySource } from "@/lib/buddy/resolveBuddySubtopicActivity";
import type { Json } from "@/integrations/supabase/types";
import type { DifficultyLevel, Subject } from "@/types";

const QUIZ_RIGHT_NOW_MS = 15 * 60 * 1000;
const SOCIAL_RIGHT_NOW_MS = 15 * 60 * 1000;

export type BuddyLatestGyanDoubt = {
  id: string;
  title: string;
  subject: string | null;
  createdAt: string;
};

export type BuddyLatestCommunityPost = {
  id: string;
  title: string;
  subject: string | null;
  createdAt: string;
};

export type BuddyRightNowPayload =
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
      kind: "community_posted";
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
      kind: "online";
      lastActiveAt: string;
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
    };

function ageMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

function subtopicIdleFromLatest(
  latest: BuddySubtopicActivitySource,
  href: string | null
): BuddyRightNowPayload {
  return {
    kind: "idle",
    subject: latest.subject,
    topic: latest.topic,
    subtopic: latest.subtopicName,
    panel: latest.panel,
    level: latest.level,
    lastActiveAt: latest.occurredAt,
    href,
  };
}

function gyanActivePayload(doubt: BuddyLatestGyanDoubt): BuddyRightNowPayload {
  return {
    kind: "gyan_active",
    title: doubt.title,
    subject: doubt.subject,
    lastActiveAt: doubt.createdAt,
    href: `/doubts/${doubt.id}`,
  };
}

function communityPostedPayload(post: BuddyLatestCommunityPost): BuddyRightNowPayload {
  return {
    kind: "community_posted",
    title: post.title,
    subject: post.subject,
    lastActiveAt: post.createdAt,
    href: buddyCommunityPostHref(post.id),
  };
}

function pickRecentSocialActivity(
  gyanDoubt: BuddyLatestGyanDoubt | null,
  communityPost: BuddyLatestCommunityPost | null
): BuddyRightNowPayload | null {
  const gyanAge = gyanDoubt ? ageMs(gyanDoubt.createdAt) : null;
  const commAge = communityPost ? ageMs(communityPost.createdAt) : null;
  const gyanRecent = gyanDoubt && gyanAge != null && gyanAge <= SOCIAL_RIGHT_NOW_MS;
  const commRecent = communityPost && commAge != null && commAge <= SOCIAL_RIGHT_NOW_MS;

  if (!gyanRecent && !commRecent) return null;
  if (gyanRecent && commRecent) {
    const gyanMs = Date.parse(gyanDoubt!.createdAt);
    const commMs = Date.parse(communityPost!.createdAt);
    return commMs >= gyanMs
      ? communityPostedPayload(communityPost!)
      : gyanActivePayload(gyanDoubt!);
  }
  if (commRecent) return communityPostedPayload(communityPost!);
  return gyanActivePayload(gyanDoubt!);
}

export function resolveBuddyRightNow(input: {
  presence: BuddySubtopicActivitySource | null;
  dwell: BuddySubtopicActivitySource | null;
  bitsAttemptsJson: Json | null | undefined;
  activityRecentMs: number;
  latestGyanDoubt: BuddyLatestGyanDoubt | null;
  latestCommunityPost: BuddyLatestCommunityPost | null;
  gyanPresenceUpdatedAt: string | null;
  sitePresenceUpdatedAt?: string | null;
}): BuddyRightNowPayload {
  const latestQuiz = latestBuddyTopicQuizAttempt(input.bitsAttemptsJson);
  if (latestQuiz) {
    const quizAge = ageMs(latestQuiz.submittedAt);
    if (quizAge != null && quizAge <= QUIZ_RIGHT_NOW_MS) {
      const subj = latestQuiz.subject as Subject;
      const href = buildTopicPath(
        latestQuiz.board,
        subj,
        latestQuiz.classLevel,
        latestQuiz.topic,
        latestQuiz.subtopicName,
        latestQuiz.level
      );
      const total = latestQuiz.totalQuestions;
      const correct = latestQuiz.correctCount;
      const scorePercent = total > 0 ? Math.round((correct / total) * 1000) / 10 : null;
      return {
        kind: "quiz_attempted",
        subject: latestQuiz.subject,
        topic: latestQuiz.topic,
        subtopic: latestQuiz.subtopicName,
        level: latestQuiz.level,
        panel: "bits",
        scorePercent,
        correct,
        total,
        setLabel: latestQuiz.setLabel,
        lastActiveAt: latestQuiz.submittedAt,
        href,
      };
    }
  }

  const recentSocial = pickRecentSocialActivity(input.latestGyanDoubt, input.latestCommunityPost);
  if (recentSocial) return recentSocial;

  const { latest, isRecent, href } = resolveBuddySubtopicActivity(
    input.presence,
    input.dwell,
    input.activityRecentMs
  );

  const gyanBrowseAge = ageMs(input.gyanPresenceUpdatedAt);
  const gyanBrowsingRecent = gyanBrowseAge != null && gyanBrowseAge <= input.activityRecentMs;

  const siteBrowseAge = ageMs(input.sitePresenceUpdatedAt);
  const siteBrowsingRecent = siteBrowseAge != null && siteBrowseAge <= input.activityRecentMs;

  if (latest && isRecent) {
    return {
      kind: "studying",
      subject: latest.subject,
      topic: latest.topic,
      subtopic: latest.subtopicName,
      panel: latest.panel,
      level: latest.level,
      lastActiveAt: latest.occurredAt,
      href,
    };
  }

  if (gyanBrowsingRecent && input.gyanPresenceUpdatedAt) {
    return {
      kind: "gyan_browsing",
      lastActiveAt: input.gyanPresenceUpdatedAt,
      href: "/doubts",
    };
  }

  if (siteBrowsingRecent && input.sitePresenceUpdatedAt) {
    return {
      kind: "online",
      lastActiveAt: input.sitePresenceUpdatedAt,
    };
  }

  const gyanDoubt = input.latestGyanDoubt;
  const communityPost = input.latestCommunityPost;

  if (!latest && !gyanDoubt && !communityPost && !input.sitePresenceUpdatedAt) {
    return { kind: "idle", lastActiveAt: null };
  }

  const subtopicMs = latest ? Date.parse(latest.occurredAt) : 0;
  const gyanMs = gyanDoubt ? Date.parse(gyanDoubt.createdAt) : 0;
  const communityMs = communityPost ? Date.parse(communityPost.createdAt) : 0;
  const gyanPresenceMs = input.gyanPresenceUpdatedAt ? Date.parse(input.gyanPresenceUpdatedAt) : 0;
  const sitePresenceMs = input.sitePresenceUpdatedAt ? Date.parse(input.sitePresenceUpdatedAt) : 0;

  const bestMs = Math.max(
    Number.isFinite(subtopicMs) ? subtopicMs : 0,
    Number.isFinite(gyanMs) ? gyanMs : 0,
    Number.isFinite(communityMs) ? communityMs : 0,
    Number.isFinite(gyanPresenceMs) ? gyanPresenceMs : 0,
    Number.isFinite(sitePresenceMs) ? sitePresenceMs : 0
  );

  if (communityPost && communityMs === bestMs) {
    const commAge = ageMs(communityPost.createdAt);
    if (commAge != null && commAge <= SOCIAL_RIGHT_NOW_MS) {
      return communityPostedPayload(communityPost);
    }
    return { kind: "idle", lastActiveAt: communityPost.createdAt };
  }

  if (gyanDoubt && gyanMs === bestMs) {
    const doubtAge = ageMs(gyanDoubt.createdAt);
    if (doubtAge != null && doubtAge <= SOCIAL_RIGHT_NOW_MS) {
      return gyanActivePayload(gyanDoubt);
    }
    return { kind: "idle", lastActiveAt: gyanDoubt.createdAt };
  }

  if (input.gyanPresenceUpdatedAt && gyanPresenceMs === bestMs && Number.isFinite(gyanPresenceMs)) {
    const browseAge = ageMs(input.gyanPresenceUpdatedAt);
    if (browseAge != null && browseAge <= input.activityRecentMs) {
      return {
        kind: "gyan_browsing",
        lastActiveAt: input.gyanPresenceUpdatedAt,
        href: "/doubts",
      };
    }
    return { kind: "idle", lastActiveAt: input.gyanPresenceUpdatedAt };
  }

  if (input.sitePresenceUpdatedAt && sitePresenceMs === bestMs && Number.isFinite(sitePresenceMs)) {
    const browseAge = ageMs(input.sitePresenceUpdatedAt);
    if (browseAge != null && browseAge <= input.activityRecentMs) {
      return {
        kind: "online",
        lastActiveAt: input.sitePresenceUpdatedAt,
      };
    }
    return { kind: "idle", lastActiveAt: input.sitePresenceUpdatedAt };
  }

  if (latest) {
    return subtopicIdleFromLatest(latest, href);
  }

  return { kind: "idle", lastActiveAt: null };
}
