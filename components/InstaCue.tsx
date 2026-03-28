"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lightbulb, Plus, ChevronLeft, ChevronRight, Check, Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import TheoryContent from "@/components/TheoryContent";
import { useUserStore } from "@/store/useUserStore";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { InstaCueCard, InstaCueCardType, InstaCueLevel } from "@/data/instaCueCards";
import type { SavedRevisionCard } from "@/types";
import { syncAllSavedContent } from "@/lib/savedContentService";

const TYPE_CONFIG: Record<
  InstaCueCardType,
  { label: string; badge: string; border: string; accent: string }
> = {
  concept: {
    label: "Concept",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    border: "border-t-amber-200 dark:border-t-amber-800",
    accent: "text-amber-700 dark:text-amber-300",
  },
  formula: {
    label: "Formula",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-200",
    border: "border-t-slate-200 dark:border-t-slate-700",
    accent: "text-slate-600 dark:text-slate-300",
  },
  common_mistake: {
    label: "Common Mistake",
    badge: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200",
    border: "border-t-red-200 dark:border-t-red-800",
    accent: "text-red-600 dark:text-red-300",
  },
  trap: {
    label: "Trap",
    badge: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200",
    border: "border-t-violet-200 dark:border-t-violet-800",
    accent: "text-violet-600 dark:text-violet-300",
  },
};

function normalizeCardMath(raw: string): string {
  let out = raw ?? "";
  // Handle doubly-escaped delimiters from JSON payloads.
  out = out
    .replace(/\\\\\(/g, "\\(")
    .replace(/\\\\\)/g, "\\)")
    .replace(/\\\\\[/g, "\\[")
    .replace(/\\\\\]/g, "\\]");
  return out;
}

function getVisibleDotIndexes(total: number, current: number): number[] {
  // Keep pagination compact for long decks (e.g. 30+ cards).
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  if (current <= 2) return [0, 1, 2, 3, 4, total - 1];
  if (current >= total - 3) return [0, total - 5, total - 4, total - 3, total - 2, total - 1];
  return [0, current - 1, current, current + 1, total - 1];
}

function SaveCardButton({ card }: { card: InstaCueCard }) {
  const { user, saveRevisionCard, unsaveRevisionCard } = useUserStore();
  const { toast } = useToast();
  const [justSaved, setJustSaved] = useState(false);
  const saved = user?.savedRevisionCards?.some((c) => c.id === card.id) ?? false;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast({ title: "Sign in to save cards", variant: "destructive" });
      return;
    }
    if (saved) {
      unsaveRevisionCard(card.id);
      syncAllSavedContent().catch(() => {});
      toast({ title: "Removed from Revision Bank" });
    } else {
      saveRevisionCard(card as unknown as SavedRevisionCard);
      syncAllSavedContent().catch(() => {});
      setJustSaved(true);
      toast({ title: "Saved to Revision Bank!" });
      setTimeout(() => setJustSaved(false), 800);
    }
  };

  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-9 w-9 rounded-full relative overflow-visible"
      onClick={handleClick}
      title={saved ? "Remove from Revision Bank" : "Save to Revision Bank"}
      aria-label={saved ? "Remove from Revision Bank" : "Save to Revision Bank"}
    >
      <motion.span
        key={saved || justSaved ? "saved" : "unsaved"}
        initial={{ scale: 0.8 }}
        animate={{
          scale: 1,
          ...(justSaved && { scale: [1, 1.3, 1] }),
        }}
        transition={{ duration: justSaved ? 0.4 : 0.2, ease: "easeOut" }}
        className="inline-flex items-center justify-center"
      >
        <AnimatePresence mode="wait">
          {(saved || justSaved) ? (
            <motion.span
              key="saved"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="text-primary"
            >
              <BookmarkCheck className="w-5 h-5" />
            </motion.span>
          ) : (
            <motion.span
              key="unsaved"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
            >
              <Bookmark className="w-5 h-5 text-muted-foreground" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.span>
    </Button>
  );
}

function RevisionCard({
  card,
  isFlipped,
  onFlip,
}: {
  card: InstaCueCard;
  isFlipped: boolean;
  onFlip: () => void;
}) {
  const config = TYPE_CONFIG[card.type];

  return (
    <div
      className="perspective-[1000px] w-full cursor-pointer"
      onClick={onFlip}
      style={{ minHeight: 200 }}
    >
      <div
        className={`relative w-full transition-transform duration-500 ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}
        style={{
          transformStyle: "preserve-3d",
          height: 200,
        }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 rounded-xl bg-card border border-border shadow-sm overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(0deg)",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <div className={`h-1.5 rounded-t-xl ${config.badge.split(" ")[0]}`} />
          <div className="p-4 flex flex-col flex-1 min-h-0">
            <span
              className={`inline-flex w-fit px-2.5 py-0.5 rounded-full text-xs font-bold ${config.badge} mb-3`}
            >
              {config.label}
            </span>
            <div className="text-sm font-semibold text-foreground flex-1 leading-relaxed break-words overflow-auto pr-1">
              <TheoryContent
                theory={normalizeCardMath(card.frontContent)}
                className="!space-y-2 !text-sm !leading-relaxed"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 shrink-0">Tap to flip</p>
          </div>
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 rounded-xl bg-card border border-border shadow-sm overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <div className="h-1.5 rounded-t-xl bg-edu-green/20 dark:bg-edu-green/30" />
          <div className="p-4 flex flex-col flex-1 min-h-0">
            <div className="flex items-center gap-2 text-edu-green/90 dark:text-edu-green font-semibold text-sm mb-3">
              <Check className="w-4 h-4" />
              Answer
            </div>
            <div className="text-sm text-foreground flex-1 leading-relaxed break-words overflow-auto pr-1">
              <TheoryContent
                theory={normalizeCardMath(card.backContent)}
                className="!space-y-2 !text-sm !leading-relaxed"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2 shrink-0">Tap to flip back</p>
          </div>
        </div>
      </div>
    </div>
  );
}

interface InstaCueProps {
  cards: InstaCueCard[];
  topicName: string;
  subtopicName?: string;
  level?: InstaCueLevel;
  subject: InstaCueCard["subject"];
  classLevel: InstaCueCard["classLevel"];
  /** Optional: subtopic names for filter dropdown; if provided, first is default. */
  subtopicOptions?: string[];
  /** Optional: controlled subtopic filter (e.g. from parent). */
  selectedSubtopic?: string;
  onSubtopicChange?: (name: string) => void;
  onAddCard?: (card: Omit<InstaCueCard, "id">) => void;
}

export default function InstaCue({
  cards,
  topicName,
  subtopicName,
  level,
  subject,
  classLevel,
  subtopicOptions,
  selectedSubtopic,
  onSubtopicChange,
  onAddCard,
}: InstaCueProps) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [type, setType] = useState<InstaCueCardType>("concept");
  const [localSubtopic, setLocalSubtopic] = useState(subtopicOptions?.[0] ?? "");

  const effectiveSubtopic = selectedSubtopic ?? (localSubtopic || (subtopicOptions?.[0] ?? ""));
  const filteredCards =
    subtopicOptions?.length && effectiveSubtopic
      ? cards.filter((c) => c.subtopicName === effectiveSubtopic)
      : cards;

  const total = filteredCards.length;

  const handleSubtopicChange = (name: string) => {
    setLocalSubtopic(name);
    onSubtopicChange?.(name);
    setIndex(0);
    setFlipped(false);
  };

  useEffect(() => {
    const first = subtopicOptions?.[0] ?? "";
    if (subtopicOptions?.length && !subtopicOptions.includes(localSubtopic)) {
      setLocalSubtopic(first);
    }
  }, [subtopicOptions, localSubtopic]);

  const handleFlip = () => setFlipped((f) => !f);

  const goPrev = () => {
    setIndex((i) => (i <= 0 ? total - 1 : i - 1));
    setFlipped(false);
  };

  const goNext = () => {
    setIndex((i) => (i >= total - 1 ? 0 : i + 1));
    setFlipped(false);
  };

  const safeIndex = Math.min(index, Math.max(0, filteredCards.length - 1));
  const displayCard = filteredCards[safeIndex];
  const visibleDots = getVisibleDotIndexes(filteredCards.length, safeIndex);

  useEffect(() => {
    if (index >= filteredCards.length && filteredCards.length > 0) {
      setIndex(0);
      setFlipped(false);
    }
  }, [filteredCards.length, index]);

  const handleAddCard = () => {
    if (!front.trim() || !back.trim() || !onAddCard) return;
    const subtopicForCard = effectiveSubtopic || subtopicName || topicName;
    onAddCard({
      type,
      frontContent: front.trim(),
      backContent: back.trim(),
      subtopicName: subtopicForCard,
      topic: topicName,
      subject,
      classLevel,
      level,
    });
    setFront("");
    setBack("");
    setType("concept");
    setAddModalOpen(false);
  };

  if (filteredCards.length === 0) {
    return (
      <div className="edu-card rounded-2xl p-6 border border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-400/80 dark:text-amber-500/80" />
            <span className="font-bold text-foreground">InstaCue</span>
          </div>
          {onAddCard && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 rounded-full"
              onClick={() => setAddModalOpen(true)}
            >
              <Plus className="w-4 h-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mb-4">Quick revision cards</p>
        <p className="text-sm text-muted-foreground">
          No cards yet for this subtopic and level. Use + to add one.
        </p>
        <div className="mt-4 p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground flex items-start gap-2">
          <Lightbulb className="w-4 h-4 shrink-0 text-amber-400/80 dark:text-amber-500/80 mt-0.5" />
          <span>
            Tip: Cards you add are kept separate per subtopic and level, and are ready for direct Supabase syncing.
          </span>
        </div>
        {onAddCard && (
          <AddCardModal
            open={addModalOpen}
            onOpenChange={setAddModalOpen}
            topicName={topicName}
            subtopicName={subtopicName}
            front={front}
            setFront={setFront}
            back={back}
            setBack={setBack}
            type={type}
            setType={setType}
            onAdd={handleAddCard}
          />
        )}
      </div>
    );
  }

  return (
    <div className="edu-card rounded-2xl p-5 border border-border">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-amber-400/80 dark:text-amber-500/80" />
            <span className="font-bold text-foreground">InstaCue</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quick revision cards
          </p>
        </div>
        {onAddCard && (
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 rounded-full shrink-0"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="mb-3 flex flex-col gap-2">
        {subtopicOptions && subtopicOptions.length > 1 && (
          <select
            aria-label="Filter cards by subtopic"
            value={effectiveSubtopic}
            onChange={(e) => handleSubtopicChange(e.target.value)}
            className="w-full text-xs font-medium rounded-xl border border-border bg-muted/30 text-foreground px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 hover:bg-muted/50 transition-colors"
          >
            {subtopicOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
        <span className="edu-chip bg-muted text-muted-foreground text-xs w-fit">
          {filteredCards.length} card{filteredCards.length !== 1 ? "s" : ""}
          {effectiveSubtopic ? ` · ${effectiveSubtopic}` : ""}
        </span>
      </div>

      {displayCard && (
        <RevisionCard
          card={displayCard}
          isFlipped={flipped}
          onFlip={handleFlip}
        />
      )}

      <div className="flex items-center justify-between gap-2 mt-4 px-1">
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-full shrink-0"
          onClick={goPrev}
          disabled={filteredCards.length <= 1}
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-1.5">
          {visibleDots.map((i, idx) => {
            const prev = visibleDots[idx - 1];
            const hasGap = typeof prev === "number" && i - prev > 1;
            return (
              <div key={i} className="flex items-center gap-1.5">
                {hasGap && <span className="text-[10px] text-muted-foreground/70">...</span>}
                <button
                  type="button"
                  className={`rounded-full transition-colors ${
                    i === safeIndex ? "w-2.5 h-2.5 bg-primary/80" : "w-2 h-2 bg-muted hover:bg-muted-foreground/40"
                  }`}
                  onClick={() => {
                    setIndex(i);
                    setFlipped(false);
                  }}
                  aria-label={`Go to card ${i + 1}`}
                />
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="icon"
            variant="ghost"
            className="h-9 w-9 rounded-full"
            onClick={goNext}
            disabled={filteredCards.length <= 1}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
          {displayCard && (
            <SaveCardButton card={displayCard} />
          )}
        </div>
      </div>
      <p className="text-center text-xs text-muted-foreground mt-1">
        {displayCard ? safeIndex + 1 : 0} of {filteredCards.length} cards
      </p>

      <div className="mt-4 p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground flex items-start gap-2">
        <Lightbulb className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
        <span>
          Tip: Cards you add are kept separate per subtopic and level, and are ready for direct Supabase syncing.
        </span>
      </div>

      {onAddCard && (
        <AddCardModal
          open={addModalOpen}
          onOpenChange={setAddModalOpen}
          topicName={topicName}
          subtopicName={subtopicName}
          front={front}
          setFront={setFront}
          back={back}
          setBack={setBack}
          type={type}
          setType={setType}
          onAdd={handleAddCard}
        />
      )}
    </div>
  );
}

function AddCardModal({
  open,
  onOpenChange,
  topicName,
  subtopicName,
  front,
  setFront,
  back,
  setBack,
  type,
  setType,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  topicName: string;
  subtopicName?: string;
  front: string;
  setFront: (s: string) => void;
  back: string;
  setBack: (s: string) => void;
  type: InstaCueCardType;
  setType: (t: InstaCueCardType) => void;
  onAdd: () => void;
}) {
  const types: InstaCueCardType[] = [
    "concept",
    "formula",
    "common_mistake",
    "trap",
  ];
  const typeLabels: Record<InstaCueCardType, string> = {
    concept: "Concept",
    formula: "Formula",
    common_mistake: "Common Mistake",
    trap: "Trap",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>Add InstaCue Card</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Add a card for &apos;{subtopicName ?? topicName}&apos;
          </p>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Front (Question/Formula)
            </label>
            <input
              type="text"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="e.g., What is momentum?"
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">
              Back (Answer/Explanation)
            </label>
            <textarea
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="e.g., Momentum = mass x velocity (p = mv)"
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-input bg-background text-sm resize-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {types.map((t) => (
                <Button
                  key={t}
                  type="button"
                  variant={type === t ? "default" : "outline"}
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setType(t)}
                >
                  {typeLabels[t]}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onAdd}
            disabled={!front.trim() || !back.trim()}
            className="gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add Card
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
