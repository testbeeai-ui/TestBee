"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTheme } from "next-themes";
import type { Question } from "@/types";
import { NtaMockTokens, type NtaSkin } from "@/components/prep-mock/nta/NtaMockTokens";
import { NtaExamShell } from "@/components/prep-mock/nta/NtaExamShell";
import { NtaSubmitModal } from "@/components/prep-mock/nta/NtaSubmitModal";
import { useAuth } from "@/hooks/useAuth";
import ChapterPyqResultView from "@/components/chapter-pyq/ChapterPyqResultView";
import { pyqQuestionSources, type ChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";
import { commitNumericDraft } from "@/lib/chapter-pyq/pyqNumericDraft";
import { PYQ_TIER_LABEL } from "@/lib/chapter-pyq/pyqTiers";
import { secondsForSet } from "@/lib/chapter-pyq/pyqSets";
import {
  PYQ_EXAM_SESSION_OVERLAY_CLASS,
  PYQ_RESULT_SESSION_OVERLAY_CLASS,
} from "@/lib/chapter-pyq/pyqSessionLayout";

type ChapterPyqExamSessionProps = {
  chapterName: string;
  subjectLabel: string;
  /** Already tier-filtered and already split into exactly this one set. */
  questions: ChapterPyqQuestion[];
  setLabel: string;
  onExit: () => void;
  onRetry: () => void;
  onNextSet?: () => void;
};

export default function ChapterPyqExamSession({
  chapterName,
  subjectLabel,
  questions: entries,
  setLabel,
  onExit,
  onRetry,
  onNextSet,
}: ChapterPyqExamSessionProps) {
  const { profile } = useAuth();
  const { resolvedTheme } = useTheme();
  const ntaSkin: NtaSkin = resolvedTheme === "dark" ? "dark" : "light";
  const questions = useMemo<Question[]>(() => entries.map((e) => e.question), [entries]);
  const totalSeconds = useMemo(() => secondsForSet(questions.length), [questions.length]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [visitedIds, setVisitedIds] = useState<Set<string>>(new Set());
  const [startTime] = useState(() => Date.now());
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [finished, setFinished] = useState(false);
  const [submittedAnswers, setSubmittedAnswers] = useState<Record<string, number> | null>(null);

  const questionBadges = useMemo(
    () => Object.fromEntries(entries.map((e) => [e.question.id, PYQ_TIER_LABEL[e.tier]])),
    [entries]
  );
  const questionSources = useMemo(() => pyqQuestionSources(entries), [entries]);

  const handleFinish = useCallback(() => {
    setSubmittedAnswers({ ...answers });
    setSubmitDialogOpen(false);
    setFinished(true);
  }, [answers]);

  useEffect(() => {
    if (finished) return;
    const interval = setInterval(() => {
      const left = Math.max(0, totalSeconds - Math.floor((Date.now() - startTime) / 1000));
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(interval);
        handleFinish();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [finished, startTime, totalSeconds, handleFinish]);

  useEffect(() => {
    const id = questions[currentIndex]?.id;
    if (!id) return;
    setVisitedIds((prev) => new Set(prev).add(id));
  }, [currentIndex, questions]);

  const handleAnswerSelect = useCallback((questionId: string, idx: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: idx }));
  }, []);

  /** Draft text is authoritative while typing; `answers` only ever holds finite values. */
  const handleNumericDraftChange = useCallback((questionId: string, raw: string) => {
    setNumericDrafts((prev) => ({ ...prev, [questionId]: raw }));
    const committed = commitNumericDraft(raw);
    setAnswers((prev) => {
      const next = { ...prev };
      if (committed === undefined) delete next[questionId];
      else next[questionId] = committed;
      return next;
    });
  }, []);

  const clearCurrent = useCallback(() => {
    const id = questions[currentIndex]?.id;
    if (!id) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setNumericDrafts((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [questions, currentIndex]);

  const goNext = useCallback(
    () => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1)),
    [questions.length]
  );

  const flagCurrent = useCallback(() => {
    const id = questions[currentIndex]?.id;
    if (id) setFlagged((prev) => new Set(prev).add(id));
  }, [questions, currentIndex]);

  const reviewAnswers = submittedAnswers ?? answers;

  if (finished) {
    return (
      <div className={PYQ_RESULT_SESSION_OVERLAY_CLASS}>
        <div className="mx-auto min-h-full max-w-4xl px-4 py-6 sm:px-6">
          <ChapterPyqResultView
            chapterName={chapterName}
            setLabel={setLabel}
            entries={entries}
            answers={reviewAnswers}
            ntaSkin={ntaSkin}
            onExit={onExit}
            onRetry={onRetry}
            onNextSet={onNextSet}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={PYQ_EXAM_SESSION_OVERLAY_CLASS}>
      <NtaMockTokens skin={ntaSkin} className="flex min-h-0 flex-1 flex-col">
        <NtaExamShell
          candidateName={profile?.name ?? "Candidate"}
          avatarUrl={profile?.avatar_url ?? null}
          examNameLine={`JEE Main Chapter-wise PYQs · ${chapterName}`}
          subjectPaperLine={`${subjectLabel} · ${setLabel}`}
          secondsLeft={secondsLeft}
          questions={questions}
          currentIndex={currentIndex}
          onSelectIndex={setCurrentIndex}
          answers={answers}
          flagged={flagged}
          visitedIds={visitedIds}
          numericDrafts={numericDrafts}
          onNumericDraftChange={handleNumericDraftChange}
          questionBadges={questionBadges}
          questionSources={questionSources}
          onAnswerSelect={handleAnswerSelect}
          onSaveAndNext={goNext}
          onClearResponse={clearCurrent}
          onSaveMarkReviewNext={() => {
            flagCurrent();
            goNext();
          }}
          onMarkReviewNext={() => {
            flagCurrent();
            goNext();
          }}
          onMarkForReviewOnly={() => {
            flagCurrent();
          }}
          onBackNav={() => setCurrentIndex((i) => Math.max(0, i - 1))}
          onNextNav={goNext}
          onSubmitClick={() => setSubmitDialogOpen(true)}
          paletteColumns={5}
        />
        <NtaSubmitModal
          open={submitDialogOpen}
          onCancel={() => setSubmitDialogOpen(false)}
          onConfirm={handleFinish}
        />
      </NtaMockTokens>
    </div>
  );
}
