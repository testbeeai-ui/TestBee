"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import TheoryContent from "@/components/TheoryContent";
import { Button } from "@/components/ui/button";
import { Layers } from "lucide-react";

/** Section: content from one **Subtopic N.N:** heading through (not including) the next. */
export interface TheorySection {
  title: string;
  content: string;
}

export interface ParsedTheory {
  preamble: string;
  sections: TheorySection[];
}

const SUBTOPIC_REGEX = /^\*\*Subtopic (\d+(?:\.\d+)?):\s*(.+)\*\*/m;

/** Split theory into preamble + sections by **Subtopic N.N:** headings. */
export function parseTheorySections(theory: string): ParsedTheory {
  const sections: TheorySection[] = [];
  const blocks = theory.split(/\n\n+/).filter((b) => b.trim());
  let currentTitle = "";
  let currentBlocks: string[] = [];
  let preambleBlocks: string[] = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    const singleLine = !trimmed.includes("\n");
    const match = singleLine ? trimmed.match(SUBTOPIC_REGEX) : null;
    if (match) {
      if (currentTitle && currentBlocks.length > 0) {
        sections.push({ title: currentTitle, content: currentBlocks.join("\n\n") });
      }
      currentTitle = `Subtopic ${match[1]}: ${match[2].trim()}`;
      currentBlocks = [trimmed];
    } else if (currentTitle) {
      currentBlocks.push(trimmed);
    } else {
      preambleBlocks.push(trimmed);
    }
  }
  if (currentTitle && currentBlocks.length > 0) {
    sections.push({ title: currentTitle, content: currentBlocks.join("\n\n") });
  }
  return {
    preamble: preambleBlocks.join("\n\n"),
    sections,
  };
}

/** Render theory with subtopic sections. In linear mode, no per-section Deep Dive buttons; use DeepDiveLinearSelector instead. */
export default function TheoryContentWithDeepDive({
  theory,
  bits = [],
  deepDiveHref,
  showPerSectionButtons = false,
  className,
}: {
  theory: string;
  bits?: string[];
  /** Function to build Deep Dive page URL for each section */
  deepDiveHref?: (sectionIndex: number) => string;
  /** If false (linear mode), hide Deep Dive buttons below each section */
  showPerSectionButtons?: boolean;
  className?: string;
}) {
  const parsed = useMemo(() => parseTheorySections(theory), [theory]);
  const { preamble, sections } = parsed;
  const hasSections = sections.length > 0;

  if (!hasSections) {
    return <TheoryContent theory={theory} className={className} />;
  }

  return (
    <div className={`space-y-8 ${className ?? ""}`}>
      {preamble.trim() && (
        <TheoryContent theory={preamble} />
      )}
      {sections.map((section, idx) => (
        <div key={idx} className="space-y-3">
          <TheoryContent theory={section.content} />
          {showPerSectionButtons && deepDiveHref && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="rounded-xl gap-2 font-semibold border-primary/40 text-primary hover:bg-primary/10"
            >
              <Link href={deepDiveHref(idx)}>
                <Layers className="w-4 h-4" />
                Deep Dive
              </Link>
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
