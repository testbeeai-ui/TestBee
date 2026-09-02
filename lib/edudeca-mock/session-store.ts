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
};

const MOCK_SET_COUNT = 20;

function parseIntParam(raw: string | null): number | null {
  if (raw == null || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

function isMockSetNumber(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= MOCK_SET_COUNT;
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
  const next = { ...session, inProgress };
  if (!inProgress) delete next.inProgress;
  return next;
}
