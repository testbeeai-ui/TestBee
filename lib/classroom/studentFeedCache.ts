import type { Post } from "@/components/ClassFeed";

const STORAGE_KEY = "classroomStudentFeed.v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type StudentFeedCacheEntry = {
  v: 1;
  classroomId: string;
  userId: string;
  postsFingerprint: string;
  posts: Post[];
  donePostIds: string[];
  submittedPostIds: string[];
  gyanDoneDoubtByPostId: Record<string, { doubtId: string; title: string }>;
  updatedAt: number;
};

type Store = Record<string, StudentFeedCacheEntry>;

function cacheKey(classroomId: string, userId: string): string {
  return `${classroomId}:${userId}`;
}

/** Stable id-set fingerprint — new/edited posts invalidate cached partition. */
export function studentFeedPostsFingerprint(posts: Pick<Post, "id">[]): string {
  if (posts.length === 0) return "";
  return posts
    .map((p) => p.id)
    .sort()
    .join("|");
}

export function readStudentFeedCache(
  classroomId: string,
  userId: string
): StudentFeedCacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Store;
    const row = parsed[cacheKey(classroomId, userId)];
    if (!row || row.v !== 1) return null;
    if (Date.now() - row.updatedAt > MAX_AGE_MS) return null;
    if (row.classroomId !== classroomId || row.userId !== userId) return null;
    return row;
  } catch {
    return null;
  }
}

export function writeStudentFeedCache(
  classroomId: string,
  userId: string,
  entry: Omit<StudentFeedCacheEntry, "v" | "classroomId" | "userId">
): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: Store = raw ? (JSON.parse(raw) as Store) : {};
    parsed[cacheKey(classroomId, userId)] = {
      v: 1,
      classroomId,
      userId,
      ...entry,
    };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function patchStudentFeedCachePartition(
  classroomId: string,
  userId: string,
  patch: Pick<
    StudentFeedCacheEntry,
    "postsFingerprint" | "donePostIds" | "submittedPostIds" | "gyanDoneDoubtByPostId"
  >
): void {
  const existing = readStudentFeedCache(classroomId, userId);
  if (!existing) return;
  writeStudentFeedCache(classroomId, userId, {
    postsFingerprint: patch.postsFingerprint,
    posts: existing.posts,
    donePostIds: patch.donePostIds,
    submittedPostIds: patch.submittedPostIds,
    gyanDoneDoubtByPostId: patch.gyanDoneDoubtByPostId,
    updatedAt: Date.now(),
  });
}
