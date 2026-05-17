"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InteractiveFormula } from "./InteractiveFormula";
import type { SavedFormula } from "@/types";

interface FormulaMcqCarouselProps {
  formulas: SavedFormula[];
  onUnsave: (formulaId: string) => void;
}

export function FormulaMcqCarousel({ formulas, onUnsave }: FormulaMcqCarouselProps) {
  const [index, setIndex] = useState(0);
  if (formulas.length === 0) return null;
  const formula = formulas[index]!;

  return (
    <div className="space-y-2.5 pt-2 sm:space-y-3">
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg px-2 text-xs sm:rounded-xl sm:px-3 sm:text-sm"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="text-[11px] font-bold text-muted-foreground sm:text-sm">
          {index + 1}/{formulas.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="rounded-lg px-2 text-xs sm:rounded-xl sm:px-3 sm:text-sm"
          onClick={() => setIndex((i) => Math.min(formulas.length - 1, i + 1))}
          disabled={index === formulas.length - 1}
        >
          <span className="hidden sm:inline">Next</span> <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
        </Button>
      </div>
      <InteractiveFormula key={formula.id} formula={formula} onUnsave={onUnsave} />
    </div>
  );
}
