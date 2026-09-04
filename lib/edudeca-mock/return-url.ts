export const DEFAULT_EDUDECA_APP_URL = "http://localhost:3001";

export type EduDecaMockReturnPayload = {
  level: 1 | 2 | 3;
  set: number;
  status: "completed" | "inprogress";
  scorePct?: number;
  correct?: number;
  total?: number;
};

export function edudecaAppOrigin(raw = process.env.NEXT_PUBLIC_EDUDECA_APP_URL): string {
  return (raw?.trim() || DEFAULT_EDUDECA_APP_URL).replace(/\/$/, "");
}

export function edudecaMockPaperPath(level: number, set: number): string {
  return `/edudeca-mock?level=${level}&set=${set}`;
}

export function edudecaMockLoginRedirect(level: number, set: number): string {
  return `/?next=${encodeURIComponent(edudecaMockPaperPath(level, set))}`;
}

export function edudecaMockReturnUrl(
  payload: EduDecaMockReturnPayload,
  origin = edudecaAppOrigin(),
): string {
  const url = new URL("/mock-test", origin.replace(/\/$/, ""));
  url.searchParams.set("level", String(payload.level));
  url.searchParams.set("set", String(payload.set));
  switch (payload.status) {
    case "completed":
      if (payload.scorePct != null) url.searchParams.set("score", String(payload.scorePct));
      if (payload.correct != null) url.searchParams.set("correct", String(payload.correct));
      if (payload.total != null) url.searchParams.set("total", String(payload.total));
      url.searchParams.set("status", "completed");
      break;
    case "inprogress":
      url.searchParams.set("status", "inprogress");
      break;
    default: {
      const _exhaustive: never = payload.status;
      return _exhaustive;
    }
  }
  return url.toString();
}

export function edudecaMockFinishReturnUrl(
  input: {
    level: 1 | 2 | 3;
    set: number;
    serverScore: { correct: number; total: number; scorePct: number } | null;
  },
  origin = edudecaAppOrigin(),
): string {
  if (!input.serverScore) {
    return edudecaMockReturnUrl(
      { level: input.level, set: input.set, status: "inprogress" },
      origin,
    );
  }
  return edudecaMockReturnUrl(
    {
      level: input.level,
      set: input.set,
      status: "completed",
      scorePct: input.serverScore.scorePct,
      correct: input.serverScore.correct,
      total: input.serverScore.total,
    },
    origin,
  );
}
