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
    <div className="space-y-3 pt-2">
      <div className={`bg-card rounded-2xl border shadow-sm p-4 ${isFormula ? "border-primary/40 ring-1 ring-primary/20" : "border-border"}`}>
        {isFormula && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-primary/15 text-primary text-xs font-bold mb-3">
            <span className="font-mono">
              <MathText>{bit.formulaLatex ?? bit.formulaName ?? ""}</MathText>
            </span>
            <span>Formula</span>
          </span>
        )}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className="font-bold text-foreground leading-snug flex-1 min-w-0 text-sm">
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
        <div className="space-y-2">
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
                className={`w-full text-left rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${optionClass} p-2.5`}
              >
                <span className="w-6 h-6 rounded-full bg-background/60 flex items-center justify-center text-xs shrink-0 font-bold">
                  {String.fromCharCode(65 + i)}
                </span>
                <MathText>{opt}</MathText>
                {answered && i === bit.correctAnswer && (
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 ml-auto" />
                )}
                {answered && i === selected && !isCorrect && (
                  <XCircle className="w-4 h-4 shrink-0 text-destructive ml-auto" />
                )}
              </button>
            );
          })}
        </div>
        {answered && bit.solution && (
          <div className="rounded-xl bg-primary/5 border border-primary/20 text-sm text-muted-foreground mt-2 p-2.5">
            <span className="font-semibold text-foreground">Explanation: </span>
            <MathText>{bit.solution}</MathText>
          </div>
        )}
      </div>
    </div>
  );
}
