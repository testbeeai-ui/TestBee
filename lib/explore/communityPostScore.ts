import type { RawPostRow } from "@/components/explore/rawFeedTypes";

export type QuizScoreInfo = {
  percent: number;
  correct: number;
  total: number;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function scoreFromPayload(payload: Record<string, unknown>): QuizScoreInfo | null {
  const correct =
    typeof payload.correctCount === "number"
      ? payload.correctCount
      : typeof payload.correct === "number"
        ? payload.correct
        : null;
  const total =
    typeof payload.totalQuestions === "number"
      ? payload.totalQuestions
      : typeof payload.total === "number"
        ? payload.total
        : null;

  if (correct !== null && total !== null && total > 0) {
    const percent =
      typeof payload.scorePercent === "number"
        ? Math.round(payload.scorePercent)
        : Math.round((correct / total) * 100);
    return { percent, correct, total };
  }

  if (typeof payload.scorePercent === "number") {
    return { percent: Math.round(payload.scorePercent), correct: 0, total: 0 };
  }

  return null;
}

/** Parse score patterns embedded in post title/body (refer challenges, legacy quiz posts). */
export function parseScoreFromText(text: string): QuizScoreInfo | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const pctFrac = trimmed.match(/(\d{1,3})%\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)/);
  if (pctFrac) {
    const percent = Number(pctFrac[1]);
    const correct = Number(pctFrac[2]);
    const total = Number(pctFrac[3]);
    if (total > 0 && correct <= total) {
      return { percent, correct, total };
    }
  }

  const fracPctParen = trimmed.match(/(\d+)\s*\/\s*(\d+)\s*\(\s*(\d{1,3})%\s*\)/);
  if (fracPctParen) {
    const correct = Number(fracPctParen[1]);
    const total = Number(fracPctParen[2]);
    const percent = Number(fracPctParen[3]);
    if (total > 0 && correct <= total) {
      return { percent, correct, total };
    }
  }

  const fracPctSep = trimmed.match(/(\d+)\s*\/\s*(\d+)\s*(?:[·|,]\s*|\s+)(\d{1,3})%/);
  if (fracPctSep) {
    const correct = Number(fracPctSep[1]);
    const total = Number(fracPctSep[2]);
    const percent = Number(fracPctSep[3]);
    if (total > 0 && correct <= total) {
      return { percent, correct, total };
    }
  }

  const xyCorrect = trimmed.match(/(\d+)\s*\/\s*(\d+)\s+correct\b/i);
  if (xyCorrect) {
    const correct = Number(xyCorrect[1]);
    const total = Number(xyCorrect[2]);
    if (total > 0 && correct <= total) {
      return { percent: Math.round((correct / total) * 100), correct, total };
    }
  }

  const scoreLine = trimmed.match(/\bScore\s+(\d+)\s*\/\s*(\d+)\b/i);
  if (scoreLine) {
    const correct = Number(scoreLine[1]);
    const total = Number(scoreLine[2]);
    if (total > 0 && correct <= total) {
      return { percent: Math.round((correct / total) * 100), correct, total };
    }
  }

  return null;
}

/** Extract quiz/score metrics from `source_payload` or title/body text. */
export function getQuizScoreFromPost(post: RawPostRow): QuizScoreInfo | null {
  const payload = asRecord(post.source_payload);
  if (payload) {
    const fromPayload = scoreFromPayload(payload);
    if (fromPayload) return fromPayload;
  }

  const blob = [post.title, post.content].filter(Boolean).join(" ");
  return parseScoreFromText(blob);
}

export function matchesCommunityPostType(
  post: RawPostRow,
  type: "all" | "wins" | "setbacks" | "doubts" | "challenges"
): boolean {
  if (type === "all") return true;

  const tags = (post.tags ?? []).join(" ").toLowerCase();
  const title = (post.title ?? "").toLowerCase();
  const score = getQuizScoreFromPost(post);

  if (type === "doubts") {
    return post.kind === "doubt" || tags.includes("doubt");
  }
  if (type === "challenges") {
    return (
      tags.includes("challenge") ||
      tags.includes("funbrain") ||
      tags.includes("refer-earn") ||
      post.source_type === "refer_challenge"
    );
  }
  if (type === "wins") {
    return (
      title.includes("win") ||
      tags.includes("win") ||
      tags.includes("high-score") ||
      (score !== null && score.percent >= 60)
    );
  }
  if (type === "setbacks") {
    return (
      title.includes("setback") ||
      tags.includes("setback") ||
      (score !== null && score.percent < 50)
    );
  }
  return true;
}
