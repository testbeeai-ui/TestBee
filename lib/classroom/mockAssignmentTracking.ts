/**
 * Persists classroom assignment context for /mock when query params are dropped
 * during client-side navigation or reloads without the full assignment URL.
 */

export const MOCK_ASSIGNMENT_TRACK_KEY = "tb_mock_assignment_track_v1";

const TTL_MS = 72 * 60 * 60 * 1000;

export type MockAssignmentTrack = {
  v: 1;
  classroomId: string;
  postId: string;
  /** Catalog paper row id once the timed session starts (mock_papers / past_papers). */
  paperId: string | null;
  savedAt: number;
};

function parseStored(raw: string | null): MockAssignmentTrack | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<MockAssignmentTrack>;
    if (o.v !== 1) return null;
    if (typeof o.classroomId !== "string" || typeof o.postId !== "string") return null;
    if (typeof o.savedAt !== "number") return null;
    const paperId =
      o.paperId === null || o.paperId === undefined
        ? null
        : typeof o.paperId === "string"
          ? o.paperId
          : null;
    return {
      v: 1,
      classroomId: o.classroomId,
      postId: o.postId,
      paperId,
      savedAt: o.savedAt,
    };
  } catch {
    return null;
  }
}

export function readMockAssignmentTracking(): MockAssignmentTrack | null {
  if (typeof window === "undefined") return null;
  const parsed = parseStored(sessionStorage.getItem(MOCK_ASSIGNMENT_TRACK_KEY));
  if (!parsed) return null;
  if (Date.now() - parsed.savedAt > TTL_MS) {
    sessionStorage.removeItem(MOCK_ASSIGNMENT_TRACK_KEY);
    return null;
  }
  return parsed;
}

export function saveMockAssignmentTracking(input: {
  classroomId: string;
  postId: string;
  paperId?: string | null;
}): void {
  if (typeof window === "undefined") return;
  const prev = readMockAssignmentTracking();
  const assignmentChanged =
    !prev || prev.classroomId !== input.classroomId || prev.postId !== input.postId;
  const paperId =
    input.paperId !== undefined
      ? input.paperId
      : assignmentChanged
        ? null
        : (prev?.paperId ?? null);
  const payload: MockAssignmentTrack = {
    v: 1,
    classroomId: input.classroomId,
    postId: input.postId,
    paperId,
    savedAt: Date.now(),
  };
  sessionStorage.setItem(MOCK_ASSIGNMENT_TRACK_KEY, JSON.stringify(payload));
}

export function clearMockAssignmentTracking(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(MOCK_ASSIGNMENT_TRACK_KEY);
}
