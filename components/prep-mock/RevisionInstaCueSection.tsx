'use client';

import Link from 'next/link';
import { RotateCcw, Plus, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { SavedRevisionCard } from '@/types';

const subjectColors: Record<string, string> = {
  physics: 'text-blue-600',
  chemistry: 'text-purple-600',
  math: 'text-orange-600',
  biology: 'text-green-600',
};

interface RevisionInstaCueSectionProps {
  cards: SavedRevisionCard[];
}

export default function RevisionInstaCueSection({ cards }: RevisionInstaCueSectionProps) {
  const preview = cards.slice(0, 3);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-foreground text-sm flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-primary" />
          Revision — InstaCue
        </h3>
        {cards.length > 0 && (
          <Link href="/revision" className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </Link>
        )}
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
        <div className="space-y-2">
          {preview.map((card) => {
            const subjectColor = subjectColors[card.subject] ?? 'text-primary';
            return (
              <div
                key={card.id}
                className="edu-card p-3 rounded-xl border border-border/50 border-l-4 border-l-[#1D9E75]"
              >
                <p className={`text-xs font-bold mb-1 ${subjectColor}`}>
                  {card.subject.charAt(0).toUpperCase() + card.subject.slice(1)} · {card.topic}
                </p>
                <p className="text-sm text-foreground line-clamp-2 font-medium leading-snug">
                  {card.backContent || card.frontContent}
                </p>
              </div>
            );
          })}
          {cards.length > 3 && (
            <Link href="/revision">
              <button className="w-full text-xs text-muted-foreground hover:text-foreground border border-border/50 rounded-xl py-2 font-medium hover:bg-muted/30 transition-colors">
                Load more InstaCues (+{cards.length - 3})
              </button>
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
