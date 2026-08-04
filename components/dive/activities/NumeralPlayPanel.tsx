"use client";

import MathText from "@/components/MathText";
import type { ArtifactFormula } from "@/lib/curriculum/subtopicContentService";
import { stripFormulaDelimiters } from "@/lib/gyan/stripFormulaDelimiters";
import QuizPlayPanel from "./QuizPlayPanel";
import styles from "../styles";

export type NumeralPlayPanelProps = {
  formula: ArtifactFormula;
  qIndex: number;
  picked: string | null;
  onPick: (v: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
  canFinish?: boolean;
};

export default function NumeralPlayPanel({
  formula,
  qIndex,
  picked,
  onPick,
  onPrev,
  onNext,
  onBack,
  onFinish,
  canFinish = true,
}: NumeralPlayPanelProps) {
  const questions = formula.bitsQuestions;
  if (questions.length === 0) {
    return (
      <div>
        <button type="button" className={styles.quizBackLink} onClick={onBack}>
          ← Back
        </button>
        <div className="mt-4">
          <h4 className="font-semibold">{formula.name}</h4>
          <MathText>{`$$${stripFormulaDelimiters(formula.formulaLatex)}$$`}</MathText>
          <p className="mt-2 text-sm text-[var(--dive-muted,#8b96a5)]">{formula.description}</p>
        </div>
        <div className={styles.quizPlayActions}>
          <div />
          <button type="button" className={styles.quizNavPrimary} onClick={onFinish}>
            Done
          </button>
        </div>
      </div>
    );
  }
  return (
    <QuizPlayPanel
      questions={questions}
      index={qIndex}
      picked={picked}
      onPick={onPick}
      onPrev={onPrev}
      onNext={onNext}
      onBack={onBack}
      onFinish={onFinish}
      canFinish={canFinish}
      backLabel="← Back to formulas"
    />
  );
}
