import { isMockPaperLevel, type MockPaperLevel } from "./paper-filter";

const SET_MAX = 20;

export type PauseAttemptRequest = {
  level: MockPaperLevel;
  set: number;
  answers: Record<string, string>;
};

export function asMockAnswers(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value !== "") out[key] = value;
  }
  return out;
}

export function parsePauseRequest(body: unknown): PauseAttemptRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const record = body as Record<string, unknown>;
  const level = typeof record.level === "number" ? record.level : Number(record.level);
  const setNumber = typeof record.set === "number" ? record.set : Number(record.set);
  if (!isMockPaperLevel(level)) return null;
  if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > SET_MAX) return null;
  return {
    level,
    set: setNumber,
    answers: asMockAnswers(record.answers),
  };
}
