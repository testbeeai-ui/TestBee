"use client";

import Link from "next/link";
import { Layers } from "lucide-react";

interface DeepDiveLinearSelectorProps {
  sections: { title: string }[];
  buildDeepDiveHref: (sectionIndex: number) => string;
}

export default function DeepDiveLinearSelector({
  sections,
  buildDeepDiveHref,
}: DeepDiveLinearSelectorProps) {
  if (sections.length === 0) return null;

  return (
    <div className="rounded-xl border-2 border-primary/50 bg-primary/10 p-4 mb-6 shadow-sm ring-2 ring-primary/20">
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Layers className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-bold text-foreground text-sm mb-1">
            Select a subtopic for Deep Dive
          </h4>
          <p className="text-xs text-muted-foreground mb-3">
            If you like any subtopic, click its number to go deeper:
          </p>
          <div className="flex flex-wrap gap-2">
            {sections.map((_, idx) => (
              <Link
                key={idx}
                href={buildDeepDiveHref(idx)}
                className="w-10 h-10 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center hover:bg-primary/90 hover:scale-105 active:scale-95 transition-all shadow-md border-2 border-primary/30"
              >
                {idx + 1}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
