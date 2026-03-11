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
    <div className="space-y-3 pt-2">
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
        </Button>
        <span className="text-sm font-bold text-muted-foreground">
          Question {index + 1} of {formulas.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => setIndex((i) => Math.min(formulas.length - 1, i + 1))}
          disabled={index === formulas.length - 1}
        >
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      <InteractiveFormula key={formula.id} formula={formula} onUnsave={onUnsave} />
    </div>
  );
}
