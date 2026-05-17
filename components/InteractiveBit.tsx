"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Trash2, XCircle } from "lucide-react";
import type { SavedBit } from "@/types";
import MathText from "@/components/MathText";

interface InteractiveBitProps {
  bit: SavedBit;
  onUnsave: (bitId: string) => void;
}

export function InteractiveBit({ bit, onUnsave }: InteractiveBitProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const answered = selected !== null;
  const isCorrect = selected === bit.correctAnswer;

  const handleSelect = (i: number) => {
    if (answered) return;
    setSelected(i);
  };

  const isFormula = Boolean(bit.formulaName || bit.formulaLatex);

  return (
    <div className="space-y-2.5 pt-2 sm:space-y-3">
      <div
        className={`bg-card rounded-xl border shadow-sm p-3 sm:rounded-2xl sm:p-4 ${isFormula ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}
      >
        {isFormula && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-primary/15 text-primary text-[11px] font-bold mb-2 sm:px-2.5 sm:py-1 sm:text-xs sm:mb-3">
            <span className="font-mono">
              <MathText>{bit.formulaLatex ?? bit.formulaName ?? ""}</MathText>
            </span>
            <span>Formula</span>
          </span>
        )}
        <div className="flex items-start justify-between gap-2 mb-2.5 sm:gap-3 sm:mb-3">
          <h3 className="font-bold text-foreground leading-snug flex-1 min-w-0 text-xs sm:text-sm">
            <MathText>{bit.question}</MathText>
          </h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onUnsave(bit.id)}
            className="shrink-0 rounded-xl h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Remove from saved"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          {bit.options.map((opt, i) => {
            let optionClass = "bg-muted hover:bg-muted/80 text-foreground";
            if (answered) {
              if (i === bit.correctAnswer)
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
                className={`w-full text-left rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 sm:rounded-xl sm:text-sm sm:gap-2 ${optionClass} p-2 sm:p-2.5`}
              >
                <span className="w-5 h-5 rounded-full bg-background/60 flex items-center justify-center text-[10px] shrink-0 font-bold sm:w-6 sm:h-6 sm:text-xs">
                  {String.fromCharCode(65 + i)}
                </span>
                <MathText>{opt}</MathText>
                {answered && i === bit.correctAnswer && (
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600 ml-auto sm:w-4 sm:h-4" />
                )}
                {answered && i === selected && !isCorrect && (
                  <XCircle className="w-3.5 h-3.5 shrink-0 text-destructive ml-auto sm:w-4 sm:h-4" />
                )}
              </button>
            );
          })}
        </div>
        {answered && bit.solution && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 text-xs text-muted-foreground mt-1.5 p-2 sm:rounded-xl sm:text-sm sm:mt-2 sm:p-2.5">
            <span className="font-semibold text-foreground">Explanation: </span>
            <MathText>{bit.solution}</MathText>
          </div>
        )}
      </div>
    </div>
  );
}
