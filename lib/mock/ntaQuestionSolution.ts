import { isPaperOcrSolution, parsePyqWorkedSolution } from "@/lib/chapter-pyq/pyqWorkedSolution";

/** Worked solution payload for the NTA popup. Prefers stored JSON/markdown over HTML. */
export function ntaQuestionSolutionText(q: {
  solutionHtml?: string | null;
  solution?: string | null;
}): string {
  const plain = String(q.solution ?? "").trim();
  if (isPaperOcrSolution(plain)) {
    if (parsePyqWorkedSolution(plain)) return plain;
    const html = String(q.solutionHtml ?? "").trim();
    return html || plain;
  }
  if (plain.startsWith("{") || parsePyqWorkedSolution(plain)) {
    return plain;
  }
  const html = String(q.solutionHtml ?? "").trim();
  if (html) return html;
  return plain;
}

export function ntaQuestionCoachText(
  q: { coachTips?: string | null; coachFormulas?: string | null },
  kind: "tips" | "formulas"
): string {
  switch (kind) {
    case "tips":
      return String(q.coachTips ?? "").trim();
    case "formulas":
      return String(q.coachFormulas ?? "").trim();
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
