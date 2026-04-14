'use client';

import Link from 'next/link';
import { RotateCcw, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import MathText from '@/components/MathText';
import type { SavedRevisionCard } from '@/types';

const subjectColors: Record<string, string> = {
  physics: 'text-blue-500 dark:text-blue-400',
  chemistry: 'text-purple-500 dark:text-purple-400',
  math: 'text-orange-500 dark:text-orange-400',
  biology: 'text-green-500 dark:text-green-400',
};

const typeLabels: Record<string, string> = {
  concept: 'Concept',
  formula: 'Formula',
  common_mistake: 'Mistake',
  trap: 'Trap',
};

interface RevisionInstaCueSectionProps {
  cards: SavedRevisionCard[];
}

function previewLine(card: SavedRevisionCard): string {
  const front = (card.frontContent ?? '').trim();
  if (front) return front;
  return (card.backContent ?? '').trim();
}

/** Turn syllabus-style ALL CAPS topics into title case for the preview row. */
function formatTopicLabel(topic: string): string {
  const t = topic.replace(/\s+/g, ' ').trim();
  if (!t) return '';
  return t
    .split(' ')
    .map((w) => (w.length <= 1 ? w.toUpperCase() : w.charAt(0) + w.slice(1).toLowerCase()))
    .join(' ');
}

export default function RevisionInstaCueSection({ cards }: RevisionInstaCueSectionProps) {
  const preview = cards.slice(0, 6);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display font-bold text-foreground text-sm flex items-center gap-2 min-w-0">
          <RotateCcw className="w-4 h-4 text-primary shrink-0" />
          Revision — InstaCue
        </h3>
        <Link
          href="/revision"
          className="text-xs font-bold text-primary hover:underline flex items-center gap-1 shrink-0"
        >
          View all <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {preview.length === 0 ? (
        <div className="edu-card p-5 rounded-xl border border-dashed border-border text-center">
          <RotateCcw className="w-9 h-9 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground mb-1">No InstaCue cards yet</p>
          <p className="text-xs text-muted-foreground mb-3">
            Add flashcards while studying to build your revision deck.
          </p>
          <Link href="/revision">
            <Button size="sm" className="rounded-lg edu-btn-primary text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> Add InstaCue
            </Button>
          </Link>
        </div>
      ) : (
        <div className="edu-card rounded-xl border border-border/50 overflow-hidden flex flex-col max-h-[220px]">
          <div className="overflow-y-auto p-2 space-y-2">
            {preview.map((card) => {
              const subjectColor = subjectColors[card.subject] ?? 'text-primary';
              const subj = card.subject.charAt(0).toUpperCase() + card.subject.slice(1);
              const typeLabel = typeLabels[card.type] ?? card.type;
              return (
                <div
                  key={card.id}
                  className="rounded-lg border border-border/50 border-l-[3px] border-l-[#1D9E75] bg-muted/20 px-2.5 py-2 min-w-0 shadow-sm"
                >
                  <div className="flex items-center gap-1.5 mb-1 min-w-0">
                    <p
                      className={`text-[10px] font-bold leading-tight truncate ${subjectColor}`}
                      title={`${subj} · ${card.topic}`}
                    >
                      {subj} · {formatTopicLabel(card.topic)}
                    </p>
                    <span className="shrink-0 rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
                      {typeLabel}
                    </span>
                  </div>
                  <div className="min-w-0 max-h-[2.75rem] overflow-hidden">
                    <MathText
                      as="div"
                      weight="semibold"
                      className="text-[11px] text-foreground leading-snug line-clamp-2 [&_.katex]:text-[0.95em]"
                    >
                      {previewLine(card)}
                    </MathText>
                  </div>
                </div>
              );
            })}
          </div>
          {cards.length > 6 && (
            <Link href="/revision" className="shrink-0 border-t border-border/50">
              <button
                type="button"
                className="w-full text-[10px] text-muted-foreground hover:text-foreground py-1.5 font-semibold hover:bg-muted/30 transition-colors"
              >
                +{cards.length - 6} more on Revision
              </button>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
