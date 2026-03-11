"use client";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import type { InteractiveBlock } from '@/data/topicTheory';
import { CheckCircle2, XCircle } from 'lucide-react';

function renderMarkdown(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
    part.startsWith('**') && part.endsWith('**') ? (
      <strong key={j} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    ) : (
      part
    )
  );
}

function ActiveReadingBlock({ block }: { block: Extract<InteractiveBlock, { type: 'active-reading' }> }) {
  const [selected, setSelected] = useState<number | null>(null);
  const { preQuestion, content } = block;
  const answered = selected !== null;
  const isCorrect = selected === preQuestion.correctAnswer;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-semibold text-foreground">{preQuestion.question}</p>
      <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {content.split(/\n\n+/).map((para, i) => (
          <p key={i} className="mb-2 last:mb-0">
            {renderMarkdown(para)}
          </p>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium text-foreground">Answer:</p>
        {preQuestion.options.map((opt, i) => {
          let style = 'bg-muted hover:bg-muted/80 text-foreground';
          if (answered) {
            if (i === preQuestion.correctAnswer) style = 'bg-edu-green/15 border-2 border-edu-green text-foreground';
            else if (i === selected && !isCorrect) style = 'bg-destructive/15 border-2 border-destructive text-foreground';
            else style = 'bg-muted/50 text-muted-foreground';
          } else if (i === selected) style = 'bg-primary/20 border-2 border-primary text-foreground';
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => setSelected(i)}
              className={`w-full text-left p-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${style}`}
            >
              <span className="w-6 h-6 rounded-full bg-background/60 flex items-center justify-center text-xs shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
              {answered && i === preQuestion.correctAnswer && <CheckCircle2 className="w-4 h-4 shrink-0 text-edu-green ml-auto" />}
              {answered && i === selected && !isCorrect && <XCircle className="w-4 h-4 shrink-0 text-destructive ml-auto" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-xl">{preQuestion.explanation}</div>
      )}
    </div>
  );
}

function FormulaVariationsBlock({ block }: { block: Extract<InteractiveBlock, { type: 'formula-variations' }> }) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  const v = block.variations[index];
  const isComplete = index >= block.variations.length;
  if (isComplete) {
    return (
      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <h4 className="font-semibold text-foreground">{block.title}</h4>
        <p className="text-sm font-medium text-edu-green flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Completed! Score: {score} / {block.variations.length}
        </p>
      </div>
    );
  }
  if (!v) return null;

  const answered = selected !== null;
  const isCorrect = selected === v.correctAnswer;
  const isLast = index === block.variations.length - 1;

  const handleSelect = (i: number) => {
    if (answered) return;
    setSelected(i);
    if (i === v.correctAnswer) setScore((s) => s + 1);
  };

  const handleNext = () => {
    setIndex((i) => i + 1);
    setSelected(null);
  };

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h4 className="font-semibold text-foreground">{block.title}</h4>
      <p className="text-sm text-muted-foreground">{block.content}</p>
      <p className="text-base font-mono font-semibold text-primary">{block.formula}</p>
      <div className="rounded-lg bg-muted/50 p-3 font-mono text-sm">
        {Object.entries(v.variables).map(([k, val]) => (
          <div key={k} className="flex gap-2">
            <span className="text-muted-foreground">{k} =</span>
            <span>{val}</span>
          </div>
        ))}
      </div>
      <p className="text-sm font-medium text-foreground">{v.question}</p>
      <div className="space-y-2">
        {v.options.map((opt, i) => {
          let style = 'bg-muted hover:bg-muted/80 text-foreground';
          if (answered) {
            if (i === v.correctAnswer) style = 'bg-edu-green/15 border-2 border-edu-green text-foreground';
            else if (i === selected && !isCorrect) style = 'bg-destructive/15 border-2 border-destructive text-foreground';
            else style = 'bg-muted/50 text-muted-foreground';
          } else if (i === selected) style = 'bg-primary/20 border-2 border-primary text-foreground';
          return (
            <button
              key={i}
              type="button"
              disabled={answered}
              onClick={() => handleSelect(i)}
              className={`w-full text-left p-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${style}`}
            >
              <span className="w-6 h-6 rounded-full bg-background/60 flex items-center justify-center text-xs shrink-0">
                {String.fromCharCode(65 + i)}
              </span>
              {opt}
              {answered && i === v.correctAnswer && <CheckCircle2 className="w-4 h-4 shrink-0 text-edu-green ml-auto" />}
              {answered && i === selected && !isCorrect && <XCircle className="w-4 h-4 shrink-0 text-destructive ml-auto" />}
            </button>
          );
        })}
      </div>
      {answered && (
        <>
          <div className="text-xs text-muted-foreground bg-muted/50 p-3 rounded-xl">{v.explanation}</div>
          {!isLast ? (
            <Button size="sm" variant="outline" onClick={handleNext} className="rounded-xl">
              Next variation
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleNext} className="rounded-xl">
              Next variation
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function FillInBlanksBlock({ block }: { block: Extract<InteractiveBlock, { type: 'fill-in-blanks' }> }) {
  const [selections, setSelections] = useState<string[]>(block.blanks.map(() => ''));
  const [checked, setChecked] = useState(false);

  const handleSelect = (idx: number, val: string) => {
    const next = [...selections];
    next[idx] = val;
    setSelections(next);
  };

  const correctCount = block.blanks.filter((b, i) => selections[i] === b.correctAnswer).length;
  const allFilled = selections.every((s) => s !== '');
  const allCorrect = correctCount === block.blanks.length;

  const parts = block.textWithBlanks.split(/\{(\d+)\}/g);
  const rendered = parts.map((part, i) => {
    if (i % 2 === 1) {
      const idx = parseInt(part, 10);
      const blank = block.blanks[idx];
      if (!blank) return part;
      return (
        <select
          key={i}
          aria-label={`Fill in blank ${idx + 1}`}
          value={selections[idx]}
          onChange={(e) => handleSelect(idx, e.target.value)}
          disabled={checked}
          className={`mx-1 px-2 py-1 rounded border text-sm min-w-[80px] ${
            checked
              ? selections[idx] === blank.correctAnswer
                ? 'border-edu-green bg-edu-green/10'
                : 'border-destructive bg-destructive/10'
              : 'border-border bg-background'
          }`}
        >
          <option value="">Choose...</option>
          {blank.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }
    return part;
  });

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4">
      <p className="text-sm text-muted-foreground">{block.content}</p>
      <div className="text-sm text-foreground leading-relaxed">
        {rendered}
      </div>
      {!checked ? (
        <Button
          size="sm"
          variant="outline"
          onClick={() => setChecked(true)}
          disabled={!allFilled}
          className="rounded-xl"
        >
          Check Answers
        </Button>
      ) : (
        <p className="text-sm font-medium">
          {allCorrect ? (
            <span className="text-edu-green flex items-center gap-1">
              <CheckCircle2 className="w-4 h-4" /> All correct!
            </span>
          ) : (
            <span>
              {correctCount} / {block.blanks.length} correct. Review the content above.
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function TextBlock({ block }: { block: Extract<InteractiveBlock, { type: 'text' }> }) {
  return (
    <div className="space-y-2 rounded-xl border border-border bg-card p-4">
      <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
        {block.content.split(/\n\n+/).map((para, i) => (
          <p key={i} className="mb-2 last:mb-0">
            {renderMarkdown(para)}
          </p>
        ))}
      </div>
    </div>
  );
}

export default function InteractiveTheoryRenderer({ blocks }: { blocks: InteractiveBlock[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((block) => (
        <div key={block.id}>
          {block.type === 'active-reading' && <ActiveReadingBlock block={block} />}
          {block.type === 'formula-variations' && <FormulaVariationsBlock block={block} />}
          {block.type === 'fill-in-blanks' && <FillInBlanksBlock block={block} />}
          {block.type === 'text' && <TextBlock block={block} />}
        </div>
      ))}
    </div>
  );
}
