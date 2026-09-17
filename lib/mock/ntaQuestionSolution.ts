import { parsePyqWorkedSolution } from "@/lib/chapter-pyq/pyqWorkedSolution";

/** Worked solution payload for the NTA popup. Prefers stored JSON/markdown over HTML. */
export function ntaQuestionSolutionText(q: {
  solutionHtml?: string | null;
  solution?: string | null;
}): string {
  const plain = String(q.solution ?? "").trim();
  if (plain.startsWith("{") || parsePyqWorkedSolution(plain)) {
    return plain;
  }
  const html = String(q.solutionHtml ?? "").trim();
  if (html) return html;
  return plain;
}
