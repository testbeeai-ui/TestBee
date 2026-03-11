"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { InteractiveBit } from "./InteractiveBit";
import type { SavedBit } from "@/types";

interface BitsCarouselProps {
  bits: SavedBit[];
  onUnsave: (bitId: string) => void;
}

export function BitsCarousel({ bits, onUnsave }: BitsCarouselProps) {
  const [index, setIndex] = useState(0);
  if (bits.length === 0) return null;
  const bit = bits[index]!;

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
          Question {index + 1} of {bits.length}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => setIndex((i) => Math.min(bits.length - 1, i + 1))}
          disabled={index === bits.length - 1}
        >
          Next <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      <InteractiveBit key={bit.id} bit={bit} onUnsave={onUnsave} />
    </div>
  );
}
