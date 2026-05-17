"""Fix NtaExamShell.tsx: shared parts import + mobile/desktop split."""
from pathlib import Path

root = Path(__file__).resolve().parents[1]
p = root / "components/prep-mock/nta/NtaExamShell.tsx"
text = p.read_text(encoding="utf-8")
lines = text.splitlines()

# Keep from HeaderLegendCell onward (helper functions)
helpers_idx = next(i for i, ln in enumerate(lines) if ln.startswith("function HeaderLegendCell"))
helpers = lines[helpers_idx:]

# Desktop body: from first <header after return through aside close
start = next(i for i, ln in enumerate(lines) if ln.strip() == "<header")
end = next(i for i, ln in enumerate(lines) if i > start and ln.strip() == "</aside>")
desktop_body = lines[start : end + 1]

header = '''"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Question } from "@/types";
import {
  ShapeNotVisited,
  ShapeNotAnswered,
  ShapeAnswered,
  ShapeMarkedOnly,
  ShapeAnsweredMarked,
  getNtaPaletteKind,
  NtaPaletteShapeSvg,
} from "@/components/prep-mock/nta/ntaPaletteShapes";
import {
  computeNtaLegendCounts,
  formatNtaHhMmSs,
  NtaOptionBody,
  NtaQuestionStem,
} from "@/components/prep-mock/nta/ntaExamParts";
import { NtaExamShellMobile } from "@/components/prep-mock/nta/NtaExamShellMobile";
import { cn } from "@/lib/utils";

export type { NtaLegendCounts } from "@/components/prep-mock/nta/ntaExamParts";

export interface NtaExamShellProps {
  candidateName: string;
  avatarUrl: string | null;
  examNameLine: string;
  subjectPaperLine: string;
  secondsLeft: number;
  questions: Question[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  answers: Record<string, number>;
  flagged: Set<string>;
  visitedIds: Set<string>;
  onAnswerSelect: (questionId: string, optionIndex: number) => void;
  onSaveAndNext: () => void;
  onClearResponse: () => void;
  onSaveMarkReviewNext: () => void;
  onMarkReviewNext: () => void;
  onMarkForReviewOnly?: () => void;
  onBackNav: () => void;
  onNextNav: () => void;
  onSubmitClick: () => void;
}

export function NtaExamShell({
  candidateName,
  avatarUrl,
  examNameLine,
  subjectPaperLine,
  secondsLeft,
  questions,
  currentIndex,
  onSelectIndex,
  answers,
  flagged,
  visitedIds,
  onAnswerSelect,
  onSaveAndNext,
  onClearResponse,
  onSaveMarkReviewNext,
  onMarkReviewNext,
  onMarkForReviewOnly,
  onBackNav,
  onNextNav,
  onSubmitClick,
}: NtaExamShellProps) {
  const [paletteOpen, setPaletteOpen] = useState(true);
  const q = questions[currentIndex];
  const counts = useMemo(
    () => computeNtaLegendCounts(questions, visitedIds, answers, flagged),
    [questions, visitedIds, answers, flagged]
  );

  if (!q) return null;

  const selected = answers[q.id];

  const shellProps = {
    candidateName,
    avatarUrl,
    examNameLine,
    subjectPaperLine,
    secondsLeft,
    questions,
    currentIndex,
    onSelectIndex,
    answers,
    flagged,
    visitedIds,
    onAnswerSelect,
    onSaveAndNext,
    onClearResponse,
    onSaveMarkReviewNext,
    onMarkReviewNext,
    onMarkForReviewOnly,
    onBackNav,
    onNextNav,
    onSubmitClick,
  };

  return (
    <>
      <NtaExamShellMobile {...shellProps} />
      <motion.div
        className="hidden min-h-0 flex-1 flex-col overflow-hidden text-xs sm:text-[13px] lg:flex lg:text-sm xl:text-[15px] 2xl:text-base antialiased"
        style={{ color: "var(--nta-text)", background: "var(--nta-bg)" }}
      >
'''.replace("<motion.div", "<" + "motion.div").replace("motion.div", "motion.div")

header = header.replace(
    '      <motion.div\n        className="hidden',
    '      <div\n        className="hidden',
)

# fix header - use div not motion
header = '''"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import type { Question } from "@/types";
import {
  ShapeNotVisited,
  ShapeNotAnswered,
  ShapeAnswered,
  ShapeMarkedOnly,
  ShapeAnsweredMarked,
  getNtaPaletteKind,
  NtaPaletteShapeSvg,
} from "@/components/prep-mock/nta/ntaPaletteShapes";
import {
  computeNtaLegendCounts,
  formatNtaHhMmSs,
  NtaOptionBody,
  NtaQuestionStem,
} from "@/components/prep-mock/nta/ntaExamParts";
import { NtaExamShellMobile } from "@/components/prep-mock/nta/NtaExamShellMobile";
import { cn } from "@/lib/utils";

export type { NtaLegendCounts } from "@/components/prep-mock/nta/ntaExamParts";

export interface NtaExamShellProps {
  candidateName: string;
  avatarUrl: string | null;
  examNameLine: string;
  subjectPaperLine: string;
  secondsLeft: number;
  questions: Question[];
  currentIndex: number;
  onSelectIndex: (index: number) => void;
  answers: Record<string, number>;
  flagged: Set<string>;
  visitedIds: Set<string>;
  onAnswerSelect: (questionId: string, optionIndex: number) => void;
  onSaveAndNext: () => void;
  onClearResponse: () => void;
  onSaveMarkReviewNext: () => void;
  onMarkReviewNext: () => void;
  onMarkForReviewOnly?: () => void;
  onBackNav: () => void;
  onNextNav: () => void;
  onSubmitClick: () => void;
}

export function NtaExamShell({
  candidateName,
  avatarUrl,
  examNameLine,
  subjectPaperLine,
  secondsLeft,
  questions,
  currentIndex,
  onSelectIndex,
  answers,
  flagged,
  visitedIds,
  onAnswerSelect,
  onSaveAndNext,
  onClearResponse,
  onSaveMarkReviewNext,
  onMarkReviewNext,
  onMarkForReviewOnly,
  onBackNav,
  onNextNav,
  onSubmitClick,
}: NtaExamShellProps) {
  const [paletteOpen, setPaletteOpen] = useState(true);
  const q = questions[currentIndex];
  const counts = useMemo(
    () => computeNtaLegendCounts(questions, visitedIds, answers, flagged),
    [questions, visitedIds, answers, flagged]
  );

  if (!q) return null;

  const selected = answers[q.id];

  const shellProps = {
    candidateName,
    avatarUrl,
    examNameLine,
    subjectPaperLine,
    secondsLeft,
    questions,
    currentIndex,
    onSelectIndex,
    answers,
    flagged,
    visitedIds,
    onAnswerSelect,
    onSaveAndNext,
    onClearResponse,
    onSaveMarkReviewNext,
    onMarkReviewNext,
    onMarkForReviewOnly,
    onBackNav,
    onNextNav,
    onSubmitClick,
  };

  return (
    <>
      <NtaExamShellMobile {...shellProps} />
      <div
        className="hidden min-h-0 flex-1 flex-col overflow-hidden text-xs sm:text-[13px] lg:flex lg:text-sm xl:text-[15px] 2xl:text-base antialiased"
        style={{ color: "var(--nta-text)", background: "var(--nta-bg)" }}
      >
'''

footer = """
      </div>
    </>
  );
}

"""

body = "\n".join(desktop_body)
body = body.replace("formatHhMmSs(", "formatNtaHhMmSs(")

out = header + body + footer + "\n".join(helpers) + "\n"
p.write_text(out, encoding="utf-8")
print("wrote", p)
