import type { QuizQuestion } from "./question-bank";
import { isApiPaper } from "./session-store";

export type LoadedMockPaper = {
  questions: QuizQuestion[];
  attempt?: { status?: string; answers?: unknown };
};

export function paperQuestionsHaveKeys(questions: QuizQuestion[]): boolean {
  return questions.length > 0 && questions.every((question) => typeof question.correctIndex === "number");
}

export function parsePaperResponse(body: unknown): LoadedMockPaper | null {
  if (body == null || typeof body !== "object") return null;
  const record = body as { questions?: unknown; attempt?: LoadedMockPaper["attempt"] };
  if (!Array.isArray(record.questions) || !isApiPaper(record.questions)) return null;
  return {
    questions: record.questions,
    attempt: record.attempt,
  };
}

export function paperCacheKey(level: number, set: number): string {
  return `${level}:${set}`;
}

export function mergePaperKeys(
  questions: QuizQuestion[],
  keyed: QuizQuestion[],
): QuizQuestion[] {
  const keys = new Map(
    keyed
      .filter((question) => typeof question.correctIndex === "number")
      .map((question) => [question.id, question.correctIndex as number]),
  );
  return questions.map((question) => {
    const correctIndex = question.correctIndex ?? keys.get(question.id);
    return typeof correctIndex === "number" ? { ...question, correctIndex } : question;
  });
}

export type PaperLoadResult =
  | { status: "ready"; paper: LoadedMockPaper }
  | { status: "auth" }
  | { status: "incomplete_lineup" }
  | { status: "missing_discipline" }
  | { status: "load" };

export async function requestMockPaper(
  fetcher: (input: string, init?: RequestInit) => Promise<Response>,
  level: number,
  set: number,
): Promise<PaperLoadResult> {
  try {
    const res = await fetcher(`/api/edudeca-mock/paper?level=${level}&set=${set}`, {
      cache: "no-store",
    });
    if (res.status === 401) return { status: "auth" };
    if (res.status === 409) return { status: "incomplete_lineup" };
    if (res.status === 422) return { status: "missing_discipline" };
    if (!res.ok) return { status: "load" };
    const paper = parsePaperResponse(await res.json());
    if (!paper) return { status: "load" };
    return { status: "ready", paper };
  } catch {
    return { status: "load" };
  }
}
