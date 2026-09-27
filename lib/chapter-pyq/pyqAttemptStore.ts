export type PyqAttemptVerdict = "right" | "wrong";

export type PyqAttemptRecord = {
  questionId: string;
  subject: string;
  chapterSlug: string;
  verdict: PyqAttemptVerdict;
};

export type PyqAttemptMap = Record<string, PyqAttemptRecord>;

export type PyqAttemptTally = {
  attempted: number;
  right: number;
  wrong: number;
};

export const PYQ_ATTEMPTS_CHANGED = "edublast-chapter-pyq-attempts";

const STORAGE_PREFIX = "edublast.chapterPyqAttempts.v1";

type AttemptStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function storageKey(userId: string | null): string {
  return `${STORAGE_PREFIX}:${userId ?? "local"}`;
}

function isVerdict(value: unknown): value is PyqAttemptVerdict {
  return value === "right" || value === "wrong";
}

function isRecord(value: unknown): value is PyqAttemptRecord {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<PyqAttemptRecord>;
  return (
    typeof row.questionId === "string" &&
    row.questionId.length > 0 &&
    typeof row.subject === "string" &&
    typeof row.chapterSlug === "string" &&
    isVerdict(row.verdict)
  );
}

export function parsePyqAttemptMap(raw: string | null): PyqAttemptMap {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const map: PyqAttemptMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!isRecord(value) || value.questionId !== key) continue;
      map[key] = value;
    }
    return map;
  } catch {
    return {};
  }
}

export function tallyChapterAttempts(
  map: PyqAttemptMap,
  subject: string,
  chapterSlug: string
): PyqAttemptTally {
  let right = 0;
  let wrong = 0;
  for (const row of Object.values(map)) {
    if (row.subject !== subject || row.chapterSlug !== chapterSlug) continue;
    if (row.verdict === "right") right += 1;
    else wrong += 1;
  }
  return { attempted: right + wrong, right, wrong };
}

function readStorage(): AttemptStorage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function loadPyqAttempts(userId: string | null, storage: AttemptStorage | null = readStorage()): PyqAttemptMap {
  if (!storage) return {};
  const own = parsePyqAttemptMap(storage.getItem(storageKey(userId)));
  if (!userId) return own;
  const guest = parsePyqAttemptMap(storage.getItem(storageKey(null)));
  if (Object.keys(guest).length === 0) return own;
  const merged: PyqAttemptMap = { ...guest, ...own };
  writeMap(userId, merged, storage);
  storage.removeItem(storageKey(null));
  return merged;
}

function writeMap(userId: string | null, map: PyqAttemptMap, storage: AttemptStorage): void {
  storage.setItem(storageKey(userId), JSON.stringify(map));
}

function notifyAttemptsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PYQ_ATTEMPTS_CHANGED));
}

/** Latest answer wins. A blank answer removes the question from the tally. */
export function recordPyqAttempt(
  userId: string | null,
  record: PyqAttemptRecord,
  storage: AttemptStorage | null = readStorage()
): PyqAttemptMap {
  if (!storage) return {};
  const map = loadPyqAttempts(userId, storage);
  map[record.questionId] = record;
  writeMap(userId, map, storage);
  notifyAttemptsChanged();
  return map;
}

export function clearPyqAttempt(
  userId: string | null,
  questionId: string,
  storage: AttemptStorage | null = readStorage()
): PyqAttemptMap {
  if (!storage) return {};
  const map = loadPyqAttempts(userId, storage);
  if (!map[questionId]) return map;
  delete map[questionId];
  writeMap(userId, map, storage);
  notifyAttemptsChanged();
  return map;
}
