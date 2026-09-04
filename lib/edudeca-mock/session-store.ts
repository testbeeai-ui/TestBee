import { isEduDecaMockLevel, type EduDecaMockLevelId, type QuizQuestion } from "./question-bank";

export const EDUDECA_MOCK_STORAGE_KEY = "edublast.edudeca-mock.v1";

export type EduDecaMockHandoffQuery = {
  level: EduDecaMockLevelId | null;
  set: number | null;
};

export type EduDecaMockInProgress = {
  level: EduDecaMockLevelId;
  set: number;
  idx: number;
  score: number;
  questions: QuizQuestion[];
  answers?: Record<string, string>;
  answered?: boolean;
  pickedIndex?: number | null;
};

export function isApiPaper(questions: QuizQuestion[] | undefined): boolean {
  return Boolean(questions?.length && questions.every((q) => q.id.startsWith("mock-l")));
}

export type EduDecaMockSession = {
  lastLevel: EduDecaMockLevelId;
  lastSet: number;
  inProgress?: EduDecaMockInProgress;
  papers?: Record<string, EduDecaMockInProgress>;
};

export const EDUDECA_MOCK_SET_COUNT = 20;

export function paperStorageKey(level: number, set: number): string {
  return `${level}-${set}`;
}

function parseIntParam(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function isMockSetNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= EDUDECA_MOCK_SET_COUNT;
}

export function collectPapers(session: EduDecaMockSession): Record<string, EduDecaMockInProgress> {
  const papers: Record<string, EduDecaMockInProgress> = { ...session.papers };
  if (session.inProgress && isApiPaper(session.inProgress.questions)) {
    papers[paperStorageKey(session.inProgress.level, session.inProgress.set)] = session.inProgress;
  }
  return papers;
}

export function matchingInProgress(session: EduDecaMockSession): EduDecaMockInProgress | null {
  const resume = collectPapers(session)[paperStorageKey(session.lastLevel, session.lastSet)];
  if (!resume || !isApiPaper(resume.questions)) return null;
  return resume;
}

export function formatSetNumber(set: number): string {
  return set < 10 ? `0${set}` : String(set);
}

export function createEmptySession(): EduDecaMockSession {
  return { lastLevel: 1, lastSet: 1 };
}

export function parseHandoffQuery(params: URLSearchParams): EduDecaMockHandoffQuery {
  const level = parseIntParam(params.get("level"));
  const set = parseIntParam(params.get("set"));
  const validLevel = level != null && isEduDecaMockLevel(level) ? level : null;
  const validSet = set != null && isMockSetNumber(set) ? set : null;
  if (!validLevel) return { level: null, set: null };
  return { level: validLevel, set: validSet };
}

export function applyHandoffQuery(
  session: EduDecaMockSession,
  query: EduDecaMockHandoffQuery,
): EduDecaMockSession {
  if (!query.level) return session;
  return {
    ...session,
    lastLevel: query.level,
    lastSet: query.set ?? session.lastSet,
  };
}

export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function parseStoredPapers(raw: unknown): Record<string, EduDecaMockInProgress> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, EduDecaMockInProgress> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const paper = value as EduDecaMockInProgress;
    if (!isApiPaper(paper.questions)) continue;
    out[key] = paper;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function loadSession(storage: StorageLike | null | undefined): EduDecaMockSession {
  if (!storage) return createEmptySession();
  try {
    const raw = storage.getItem(EDUDECA_MOCK_STORAGE_KEY);
    if (!raw) return createEmptySession();
    const parsed = JSON.parse(raw) as Partial<EduDecaMockSession>;
    const lastLevel = Number(parsed.lastLevel);
    const lastSet = Number(parsed.lastSet);
    if (!isEduDecaMockLevel(lastLevel)) return createEmptySession();
    return {
      lastLevel,
      lastSet: isMockSetNumber(lastSet) ? lastSet : 1,
      inProgress: parsed.inProgress,
      papers: parseStoredPapers(parsed.papers),
    };
  } catch {
    return createEmptySession();
  }
}

export function saveSession(storage: StorageLike | null | undefined, session: EduDecaMockSession): void {
  if (!storage) return;
  storage.setItem(EDUDECA_MOCK_STORAGE_KEY, JSON.stringify(session));
}

export function withInProgress(
  session: EduDecaMockSession,
  inProgress: EduDecaMockInProgress | undefined,
): EduDecaMockSession {
  const papers = collectPapers(session);
  if (inProgress && isApiPaper(inProgress.questions)) {
    papers[paperStorageKey(inProgress.level, inProgress.set)] = inProgress;
  }
  const next: EduDecaMockSession = { ...session, papers, inProgress };
  if (!inProgress) delete next.inProgress;
  return next;
}

export function paperToPauseOnSwitch(
  session: EduDecaMockSession,
  nextLevel: number,
  nextSet: number,
  liveQuiz?: EduDecaMockInProgress | null,
): EduDecaMockInProgress | null {
  const candidate =
    (liveQuiz && isApiPaper(liveQuiz.questions) ? liveQuiz : null) ??
    matchingInProgress(session) ??
    (session.inProgress && isApiPaper(session.inProgress.questions) ? session.inProgress : null);
  if (!candidate) return null;
  if (candidate.level === nextLevel && candidate.set === nextSet) return null;
  return candidate;
}

export function sessionAfterSelectingSet(
  session: EduDecaMockSession,
  level: EduDecaMockLevelId,
  set: number,
  liveQuiz?: EduDecaMockInProgress | null,
): EduDecaMockSession {
  const base =
    liveQuiz && isApiPaper(liveQuiz.questions) ? withInProgress(session, liveQuiz) : session;
  return { ...base, lastLevel: level, lastSet: set };
}

export function withoutPaper(
  session: EduDecaMockSession,
  level: number,
  set: number,
): EduDecaMockSession {
  const papers = collectPapers(session);
  delete papers[paperStorageKey(level, set)];
  const stillCurrent =
    session.inProgress &&
    session.inProgress.level === level &&
    session.inProgress.set === set
      ? undefined
      : session.inProgress;
  const next: EduDecaMockSession = { ...session, papers, inProgress: stillCurrent };
  if (!stillCurrent) delete next.inProgress;
  if (Object.keys(papers).length === 0) delete next.papers;
  return next;
}

export type AttemptChipStatus = "inprogress" | "completed";

export function mergeAttemptChipStatuses(
  localPapers: Record<string, EduDecaMockInProgress>,
  remote: Array<{ level: number; set: number; status: AttemptChipStatus }>,
): Record<string, AttemptChipStatus> {
  const out: Record<string, AttemptChipStatus> = {};
  for (const paper of Object.values(localPapers)) {
    out[paperStorageKey(paper.level, paper.set)] = "inprogress";
  }
  for (const row of remote) {
    const key = paperStorageKey(row.level, row.set);
    if (row.status === "completed" || out[key] == null) out[key] = row.status;
  }
  return out;
}
