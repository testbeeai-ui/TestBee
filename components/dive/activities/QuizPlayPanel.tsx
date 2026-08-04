"use client";

import PlayQuestionMarkdown from "@/components/PlayQuestionMarkdown";
import type { ArtifactBitsQuestion } from "@/lib/curriculum/subtopicContentService";
import DiveProgressBar from "../ui/DiveProgressBar";
import styles from "../styles";

export type QuizPlayPanelProps = {
  questions: ArtifactBitsQuestion[];
  index: number;
  picked: string | null;
  onPick: (v: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
  canFinish?: boolean;
  backLabel?: string;
};

export default function QuizPlayPanel({
  questions,
  index,
  picked,
  onPick,
  onPrev,
  onNext,
  onBack,
  onFinish,
  canFinish = true,
  backLabel = "← Back to sets",
}: QuizPlayPanelProps) {
  const q = questions[index];
  if (!q) {
    return (
      <div className={styles.emptyState}>
        <strong>Empty set</strong>
        <button type="button" className={styles.quizNavSecondary} onClick={onBack}>
          {backLabel}
        </button>
      </div>
    );
  }
  const correct = picked != null && picked === q.correctAnswer;
  const progressPct = ((index + 1) / Math.max(1, questions.length)) * 100;
  const optionLetters = ["A", "B", "C", "D", "E", "F"] as const;

  return (
    <div className={styles.quizPlay}>
      <div className={styles.quizPlayChrome}>
        <div className={styles.quizPlayTop}>
          <button type="button" className={styles.quizBackLink} onClick={onBack}>
            {backLabel}
          </button>
          <span className={styles.quizProgressLabel}>
            {index + 1} / {questions.length}
          </span>
        </div>
        <DiveProgressBar valuePct={progressPct} variant="quiz" aria-label="Question progress" />
      </div>

      <div className={styles.quizPlayScroll}>
        <div className={styles.quizQuestionCard}>
          <p className={styles.quizQuestionEyebrow}>Question {index + 1}</p>
          <div className={styles.quizQuestionText}>
            <PlayQuestionMarkdown source={q.question} variant="stem" />
          </div>
        </div>

        <div className={styles.quizOptions} role="listbox" aria-label="Answer options">
          {q.options.map((opt, i) => {
            const isPick = picked === opt;
            const showCorrect = picked != null && opt === q.correctAnswer;
            const showWrong = picked != null && isPick && !correct;
            let stateClass = "";
            if (showCorrect) stateClass = styles.quizOptionCorrect;
            else if (showWrong) stateClass = styles.quizOptionWrong;
            else if (isPick) stateClass = styles.quizOptionPicked;

            return (
              <button
                key={`${i}-${opt.slice(0, 40)}`}
                type="button"
                role="option"
                aria-selected={isPick}
                disabled={picked != null}
                className={`${styles.quizOption} ${stateClass}`}
                onClick={() => onPick(opt)}
              >
                <span className={styles.quizOptionLetter}>{optionLetters[i] ?? i + 1}</span>
                <span className={styles.quizOptionBody}>
                  <PlayQuestionMarkdown source={opt} variant="option" />
                </span>
              </button>
            );
          })}
        </div>

        {picked != null ? (
          <div
            className={`${styles.quizFeedback} ${correct ? styles.quizFeedbackOk : styles.quizFeedbackBad}`}
          >
            <strong>{correct ? "Correct" : "Not quite"}</strong>
            {q.solution ? (
              <div className={styles.quizSolution}>
                <PlayQuestionMarkdown source={q.solution} variant="explanation" />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.quizPlayActions}>
        <button
          type="button"
          className={styles.quizNavSecondary}
          disabled={index === 0}
          onClick={onPrev}
        >
          ← Previous
        </button>
        {index >= questions.length - 1 ? (
          <button
            type="button"
            className={styles.quizNavPrimary}
            onClick={onFinish}
            disabled={!canFinish || picked == null}
          >
            Finish set
          </button>
        ) : (
          <button
            type="button"
            className={styles.quizNavPrimary}
            onClick={onNext}
            disabled={picked == null}
          >
            Next →
          </button>
        )}
      </div>
    </div>
  );
}
