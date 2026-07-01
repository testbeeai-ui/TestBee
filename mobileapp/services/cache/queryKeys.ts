/** Central React Query keys — one cache entry per resource, shared across screens. */
export const queryKeys = {
  dashboard: {
    summary: (todayKey: string, fromKey: string) =>
      ["dashboard", "summary", todayKey, fromKey] as const,
  },
  curriculum: {
    full: ["curriculum", "full"] as const,
  },
  newsBlog: {
    all: ["news-blog", "all"] as const,
  },
  notifications: {
    list: (userId: string) => ["notifications", userId] as const,
  },
  profile: {
    hub: ["profile", "hub"] as const,
  },
  earn: {
    hub: ["earn", "hub"] as const,
  },
  gyan: {
    feed: ["gyan", "feed"] as const,
    doubt: (id: string) => ["gyan", "doubt", id] as const,
    access: ["gyan", "access"] as const,
  },
  chatbot: {
    quota: ["chatbot", "quota"] as const,
  },
  lessons: {
    topic: (pathKey: string) => ["lessons", "topic", pathKey] as const,
  },
} as const;

/** Default stale times per domain (ms). */
export const queryStaleTimes = {
  newsBlog: 10 * 60_000,
  curriculum: 24 * 60 * 60_000,
  profile: 60_000,
  earn: 60_000,
  notifications: 30_000,
  dashboard: 30_000,
} as const;
