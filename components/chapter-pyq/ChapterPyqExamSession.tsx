"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type { Question } from "@/types";
import { NtaMockTokens, type NtaSkin } from "@/components/prep-mock/nta/NtaMockTokens";
import { NtaExamShell } from "@/components/prep-mock/nta/NtaExamShell";
import { NtaSubmitModal } from "@/components/prep-mock/nta/NtaSubmitModal";
import { useAuth } from "@/hooks/useAuth";
import ChapterPyqResultView from "@/components/chapter-pyq/ChapterPyqResultView";
import { pyqQuestionSources, type ChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";
import { commitNumericDraft } from "@/lib/chapter-pyq/pyqNumericDraft";
import { clearPyqAttempt, recordPyqAttempt } from "@/lib/chapter-pyq/pyqAttemptStore";
import { pyqReviewVerdict } from "@/lib/chapter-pyq/pyqScoring";
import { secondsForSet } from "@/lib/chapter-pyq/pyqSets";
import { pyqTestMarks, pyqTestMaxMarks } from "@/lib/chapter-pyq/pyqTestSetup";
import {
  PYQ_EXAM_SESSION_OVERLAY_CLASS,
  PYQ_RESULT_SESSION_OVERLAY_CLASS,
} from "@/lib/chapter-pyq/pyqSessionLayout";

type ChapterPyqExamSessionProps = {
  chapterName: string;
  chapterSlug: string;
  subject: string;
  subjectLabel: string;
  /** Already tier-filtered and already split into exactly this one set. */
  questions: ChapterPyqQuestion[];
  setLabel: string;
  onExit: () => void;
  onRetry: () => void;
  onNextSet?: () => void;
  mode?: "practice" | "test";
  minutesPerQuestion?: number;
};

export default function ChapterPyqExamSession({
  chapterName,
  chapterSlug,
  subject,
  subjectLabel,
  questions: entries,
  setLabel,
  onExit,
  onRetry,
  onNextSet,
  mode = "practice",
  minutesPerQuestion = 2,
}: ChapterPyqExamSessionProps) {
  const { profile, user } = useAuth();
  const { resolvedTheme } = useTheme();
  const ntaSkin: NtaSkin = resolvedTheme === "dark" ? "dark" : "light";
  const questions = useMemo<Question[]>(() => entries.map((e) => e.question), [entries]);
  const totalSeconds = useMemo(() => {
    if (mode === "test") {
      const minutes = Math.max(1, minutesPerQuestion ?? 2);
      return questions.length * minutes * 60;
    }
    return secondsForSet(questions.length);
  }, [mode, minutesPerQuestion, questions.length]);

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

  const questionSources = useMemo(() => pyqQuestionSources(entries), [entries]);
  const questionById = useMemo(() => {
    const map = new Map<string, Question>();
    for (const question of questions) map.set(question.id, question);
    return map;
  }, [questions]);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const userId = user?.id ?? null;

  const persistOutcome = useCallback(
    (questionId: string, answer: number | undefined) => {
      const question = questionById.get(questionId);
      if (!question) return;
      const verdict = pyqReviewVerdict(question, answer);
      switch (verdict) {
        case "skipped":
          clearPyqAttempt(userId, questionId);
          return;
        case "correct":
          recordPyqAttempt(userId, {
            questionId,
            subject,
            chapterSlug,
            verdict: "right",
          });
          return;
        case "wrong":
          recordPyqAttempt(userId, {
            questionId,
            subject,
            chapterSlug,
            verdict: "wrong",
          });
          return;
        default: {
          const _exhaustive: never = verdict;
          return _exhaustive;
        }
      }
    },
    [chapterSlug, questionById, subject, userId]
  );

  const commitCurrent = useCallback(() => {
    const question = questions[currentIndex];
    if (!question) return;
    const answer = answersRef.current[question.id];
    if (answer === undefined || !Number.isFinite(answer)) return;
    persistOutcome(question.id, answer);
  }, [currentIndex, persistOutcome, questions]);

  const handleFinish = useCallback(() => {
    for (const question of questions) {
      const answer = answers[question.id];
      if (answer === undefined || !Number.isFinite(answer)) continue;
      persistOutcome(question.id, answer);
    }
    setSubmittedAnswers({ ...answers });
    setSubmitDialogOpen(false);
    setFinished(true);
  }, [answers, persistOutcome, questions]);

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

  const handleAnswerSelect = useCallback(
    (questionId: string, idx: number) => {
      setAnswers((prev) => ({ ...prev, [questionId]: idx }));
      persistOutcome(questionId, idx);
    },
    [persistOutcome]
  );

  /** Draft text is authoritative while typing; `answers` only ever holds finite values. */
  const handleNumericDraftChange = useCallback(
    (questionId: string, raw: string) => {
      setNumericDrafts((prev) => ({ ...prev, [questionId]: raw }));
      const committed = commitNumericDraft(raw);
      setAnswers((prev) => {
        const next = { ...prev };
        if (committed === undefined) delete next[questionId];
        else next[questionId] = committed;
        return next;
      });
      persistOutcome(questionId, committed);
    },
    [persistOutcome]
  );

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
    clearPyqAttempt(userId, id);
  }, [questions, currentIndex, userId]);

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
    let marks: { earned: number; maximum: number } | undefined;
    if (mode === "test") {
      let correct = 0;
      let wrong = 0;
      for (const entry of entries) {
        const verdict = pyqReviewVerdict(entry.question, reviewAnswers[entry.question.id]);
        if (verdict === "correct") correct += 1;
        else if (verdict === "wrong") wrong += 1;
      }
      marks = {
        earned: pyqTestMarks(correct, wrong),
        maximum: pyqTestMaxMarks(entries.length),
      };
    }
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
            {...(marks ? { marks } : {})}
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
          questionSources={questionSources}
          onAnswerSelect={handleAnswerSelect}
          onSaveAndNext={() => {
            commitCurrent();
            goNext();
          }}
          onClearResponse={clearCurrent}
          onSaveMarkReviewNext={() => {
            commitCurrent();
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
          showSolution
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
