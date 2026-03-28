"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Trash2, XCircle } from "lucide-react";
import type { SavedFormula } from "@/types";
import MathText from "@/components/MathText";

interface InteractiveFormulaProps {
  formula: SavedFormula;
  onUnsave: (formulaId: string) => void;
}

function FormulaQuestion({
  question,
  options,
  correctAnswer,
  solution,
}: {
  question: string;
  options: string[];
  correctAnswer: number;
  solution?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const isCorrect = selected === correctAnswer;

  const handleSelect = (i: number) => {
    if (answered) return;
    setSelected(i);
  };

  return (
    <div className="mt-3 pl-2 border-l-2 border-primary/30">
      <p className="font-medium text-foreground text-sm mb-2">
        <MathText>{question}</MathText>
      </p>
      <div className="space-y-1.5">
        {options.map((opt, i) => {
          let optionClass = "bg-muted hover:bg-muted/80 text-foreground";
          if (answered) {
            if (i === correctAnswer)
              optionClass = "bg-emerald-500/15 border-2 border-emerald-500 text-foreground";
            else if (i === selected && !isCorrect)
              optionClass = "bg-destructive/15 border-2 border-destructive text-foreground";
            else optionClass = "bg-muted/50 text-muted-foreground";
          } else if (i === selected)
            optionClass = "bg-primary/20 border-2 border-primary text-foreground";
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => handleSelect(i)}
              className={`w-full text-left rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${optionClass} p-2`}
            >
              <span className="w-5 h-5 rounded-full bg-background/60 flex items-center justify-center text-xs shrink-0 font-bold">
                {String.fromCharCode(65 + i)}
              </span>
              <MathText>{opt}</MathText>
              {answered && i === correctAnswer && (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 ml-auto" />
              )}
              {answered && i === selected && !isCorrect && (
                <XCircle className="w-3.5 h-3.5 shrink-0 text-destructive ml-auto" />
              )}
            </button>
          );
        })}
      </div>
      {answered && solution && (
        <div className="rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground mt-2 p-2">
          <span className="font-semibold text-foreground">Explanation: </span>
          <MathText>{solution}</MathText>
        </div>
      )}
    </div>
  );
}

export function InteractiveFormula({ formula, onUnsave }: InteractiveFormulaProps) {
  return (
    <div className="space-y-3 pt-2">
      <div className="bg-card rounded-2xl border border-border shadow-sm p-4">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-foreground text-sm">{formula.name}</p>
            {formula.formulaLatex && (
              <p className="font-mono text-xs text-muted-foreground mt-0.5">
                <MathText>{`$$${formula.formulaLatex}$$`}</MathText>
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onUnsave(formula.id)}
            className="shrink-0 rounded-xl h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Remove from saved"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mb-2">
          {formula.bitsQuestions.length} question{formula.bitsQuestions.length !== 1 ? "s" : ""}
        </p>
        <div className="space-y-4">
          {formula.bitsQuestions.map((q, idx) => (
            <FormulaQuestion
              key={idx}
              question={q.question}
              options={q.options}
              correctAnswer={q.correctAnswer}
              solution={q.solution}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
