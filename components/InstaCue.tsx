"use client";

import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Plus,
  ChevronLeft,
  ChevronRight,
  Check,
  Bookmark,
  BookmarkCheck,
  Share2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import TheoryContent from "@/components/TheoryContent";
import InstaCueShareSheet from "@/components/instacue/InstaCueShareSheet";
import { useUserStore } from "@/store/useUserStore";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { InstaCueCard, InstaCueLevel } from "@/data/instaCueCards";
import {
  INSTACUE_TYPE_CONFIG,
  type InstaCueCardType,
} from "@/lib/instacue/instaCueTypeConfig";
import { renderInstaCueShareCardPng } from "@/lib/instacue/renderInstaCueShareCard";
import {
  prefersNativeFileShare,
  shareInstaCuePngNative,
} from "@/lib/instacue/shareInstaCueImage";
import { syncAllSavedContent } from "@/lib/saved/savedContentService";
import {
  resolveRevisionCardSaveLimit,
  revisionCardLimitToastCopy,
} from "@/lib/saved/revisionCardSaveLimit";
import { reportInstacueCardRead } from "@/lib/rdm/reports/reportInstacueCardRead";
import {
  findSavedRevisionCardId,
  isRevisionCardSaved,
  normalizeRevisionCardForSave,
} from "@/lib/saved/revisionCardIdentity";

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
  const { profile } = useAuth();
  const { toast } = useToast();
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedList = user?.savedRevisionCards ?? [];
  const saved = isRevisionCardSaved(savedList, card);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user || saving) {
      if (!user) toast({ title: "Sign in to save cards", variant: "destructive" });
      return;
    }
    if (saved) {
      const savedId = findSavedRevisionCardId(savedList, card);
      if (savedId) unsaveRevisionCard(savedId);
      await syncAllSavedContent({ immediate: true });
      toast({ title: "Removed from Revision Bank" });
      return;
    }

    const savedCount = user.savedRevisionCards?.length ?? 0;
    const limit = await resolveRevisionCardSaveLimit(profile, savedCount);
    if (limit.atLimit) {
      const copy = revisionCardLimitToastCopy(limit.cap);
      toast({ variant: "destructive", ...copy });
      return;
    }

    setSaving(true);
    const stamped = normalizeRevisionCardForSave(card);
    saveRevisionCard(stamped);
    const sync = await syncAllSavedContent({ immediate: true });
    setSaving(false);
    if (!sync.ok) {
      unsaveRevisionCard(stamped.id);
      toast({
        variant: "destructive",
        title: sync.limitReached ? revisionCardLimitToastCopy(limit.cap).title : "Could not save",
        description: sync.error,
      });
      return;
    }
    setJustSaved(true);
    toast({ title: "Saved to Revision Bank!" });
    setTimeout(() => setJustSaved(false), 800);
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
          {saved || justSaved ? (
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
  compact,
  presentation = "default",
}: {
  card: InstaCueCard;
  isFlipped: boolean;
  onFlip: () => void;
  compact?: boolean;
  presentation?: "default" | "dive";
}) {
  const config = INSTACUE_TYPE_CONFIG[card.type];
  const pointerRef = useRef<{ x: number; y: number; dragged: boolean } | null>(null);
  const isDive = presentation === "dive";

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerRef.current = { x: e.clientX, y: e.clientY, dragged: false };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const start = pointerRef.current;
    if (!start || start.dragged) return;
    const dx = Math.abs(e.clientX - start.x);
    const dy = Math.abs(e.clientY - start.y);
    if (dx > 8 || dy > 8) start.dragged = true;
  };

  const handleFlip = () => {
    if (pointerRef.current?.dragged) {
      pointerRef.current = null;
      return;
    }
    pointerRef.current = null;
    onFlip();
  };

  const cardH = isDive ? 220 : compact ? 148 : 200;
  const faceClass = isDive
    ? "absolute inset-0 flex flex-col overflow-hidden rounded-2xl border border-[#ef9f27]/35 bg-[linear-gradient(165deg,#243044_0%,#171d28_55%,#121820_100%)] shadow-[0_12px_32px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06)]"
    : "absolute inset-0 flex flex-col rounded-xl bg-card border border-border shadow-sm overflow-hidden";

  return (
    <div
      className={`perspective-[1000px] w-full cursor-pointer ${isDive ? "mx-auto max-w-[360px]" : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={handleFlip}
      style={{ minHeight: cardH }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleFlip();
        }
      }}
      aria-label={isFlipped ? "Flip card back to question" : "Flip card to answer"}
    >
      <motion.div
        className={`relative w-full transition-transform duration-500 ${isFlipped ? "[transform:rotateY(180deg)]" : ""}`}
        style={{
          transformStyle: "preserve-3d",
          height: cardH,
        }}
        whileTap={isDive ? { scale: 0.98 } : undefined}
      >
        {/* Front */}
        <div
          className={faceClass}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(0deg)",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <div
            className={`shrink-0 ${isDive ? "h-1.5 rounded-t-2xl bg-gradient-to-r from-[#ef9f27] via-[#f5c542] to-[#1d9e75]" : `h-1.5 rounded-t-xl ${config.badge.split(" ")[0]}`}`}
          />
          <div className={`flex min-h-0 flex-1 flex-col ${isDive ? "p-4" : "p-4"}`}>
            <div className="mb-2 shrink-0">
              <span
                className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold leading-none tracking-wide sm:text-[11px] ${
                  isDive
                    ? "bg-[rgba(239,159,39,0.2)] text-[#ef9f27] ring-1 ring-[rgba(239,159,39,0.35)]"
                    : config.badge
                }`}
              >
                {isDive ? "✦ " : ""}
                {config.label}
              </span>
            </div>
            <div
              className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 break-words touch-pan-y ${
                isDive
                  ? "flex items-center text-[15px] font-semibold leading-snug text-[#f3f6fa]"
                  : "text-[15px] font-semibold leading-snug text-foreground sm:text-base"
              }`}
            >
              <TheoryContent
                theory={normalizeCardMath(card.frontContent)}
                className={
                  isDive
                    ? "!space-y-2 !text-[15px] !font-semibold !leading-snug !text-[#f3f6fa]"
                    : "!space-y-2 !text-[15px] !font-semibold !leading-snug sm:!text-base"
                }
              />
            </div>
            <p
              className={`mt-2 shrink-0 ${
                isDive
                  ? "rounded-lg bg-white/[0.04] py-1.5 text-center text-[11px] font-semibold text-[#9aa6b5]"
                  : "text-xs text-muted-foreground"
              }`}
            >
              {isDive ? "👆 Tap to flip" : "Tap to flip"}
            </p>
          </div>
        </div>

        {/* Back */}
        <div
          className={faceClass}
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <div
            className={`shrink-0 ${isDive ? "h-1.5 rounded-t-2xl bg-gradient-to-r from-[#1d9e75] to-[#378add]" : "h-1.5 rounded-t-xl bg-edu-green/20 dark:bg-edu-green/30"}`}
          />
          <div className={`flex min-h-0 flex-1 flex-col ${isDive ? "p-4" : "p-4"}`}>
            <div
              className={`mb-2 flex shrink-0 items-center gap-1.5 font-bold ${
                isDive ? "text-xs text-[#1d9e75]" : "text-sm text-edu-green/90 dark:text-edu-green"
              }`}
            >
              <Check className="h-3.5 w-3.5" />
              Answer
            </div>
            <div
              className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 break-words touch-pan-y ${
                isDive
                  ? "text-[13px] leading-relaxed text-[#e8eef5]"
                  : "text-sm leading-relaxed text-foreground sm:text-[15px]"
              }`}
            >
              <TheoryContent
                theory={normalizeCardMath(card.backContent)}
                className={
                  isDive
                    ? "!space-y-2 !text-[13px] !leading-relaxed !text-[#e8eef5]"
                    : "!space-y-2 !text-sm !leading-relaxed sm:!text-[15px]"
                }
              />
            </div>
            <p
              className={`mt-2 shrink-0 ${
                isDive
                  ? "rounded-lg bg-white/[0.04] py-1.5 text-center text-[11px] font-semibold text-[#9aa6b5]"
                  : "text-xs text-muted-foreground"
              }`}
            >
              Tap to flip back
            </p>
          </div>
        </div>
      </motion.div>
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
  onCardIndexChange?: (index: number, total: number) => void;
  onCardValidated?: (index: number, total: number) => void;
  compact?: boolean;
  /** Dive hub stage — taller cards, full-bleed stage, hides nested chrome. */
  presentation?: "default" | "dive";
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
  onCardIndexChange,
  onCardValidated,
  compact,
  presentation = "default",
}: InstaCueProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [front, setFront] = useState("");
  const [back, setBack] = useState("");
  const [type, setType] = useState<InstaCueCardType>("concept");
  const [localSubtopic, setLocalSubtopic] = useState(subtopicOptions?.[0] ?? "");
  const [sharing, setSharing] = useState(false);
  const [shareSheetOpen, setShareSheetOpen] = useState(false);
  const [shareBlob, setShareBlob] = useState<Blob | null>(null);
  const [sharePreviewUrl, setSharePreviewUrl] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const isDive = presentation === "dive";

  const onCardIndexChangeRef = useRef(onCardIndexChange);
  onCardIndexChangeRef.current = onCardIndexChange;
  const instacueReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      queueMicrotask(() => setLocalSubtopic(first));
    }
  }, [subtopicOptions, localSubtopic]);

  const goPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFlipped(false);
    setIndex((i) => (i <= 0 ? total - 1 : i - 1));
  };

  const goNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setFlipped(false);
    setIndex((i) => (i >= total - 1 ? 0 : i + 1));
  };

  const safeIndex = Math.min(index, Math.max(0, filteredCards.length - 1));
  const displayCard = filteredCards[safeIndex];
  const visibleDots = getVisibleDotIndexes(filteredCards.length, safeIndex);

  useLayoutEffect(() => {
    setFlipped(false);
  }, [displayCard?.id]);

  const handleFlip = () => {
    setFlipped((wasFlipped) => {
      const willShowBack = !wasFlipped;
      if (willShowBack) {
        const idx = safeIndex;
        const len = filteredCards.length;
        queueMicrotask(() => {
          onCardValidated?.(idx, len);
        });
      }
      return !wasFlipped;
    });
  };

  useEffect(() => {
    if (index >= filteredCards.length && filteredCards.length > 0) {
      queueMicrotask(() => {
        setIndex(0);
        setFlipped(false);
      });
    }
  }, [filteredCards.length, index]);

  useEffect(() => {
    if (filteredCards.length <= 0) return;
    onCardIndexChangeRef.current?.(safeIndex, filteredCards.length);
  }, [safeIndex, filteredCards.length]);

  useEffect(() => {
    if (!profile?.id || !displayCard?.id) return;
    const cardId = displayCard.id;
    if (instacueReadTimerRef.current) clearTimeout(instacueReadTimerRef.current);
    instacueReadTimerRef.current = setTimeout(() => {
      instacueReadTimerRef.current = null;
      void reportInstacueCardRead(cardId);
    }, 600);
    return () => {
      if (instacueReadTimerRef.current) clearTimeout(instacueReadTimerRef.current);
    };
  }, [profile?.id, displayCard?.id]);

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

  const revokeSharePreview = () => {
    setSharePreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  };

  /**
   * MNC-style share:
   * - Mobile: one tap → OS share sheet (WhatsApp, Save, etc.)
   * - Desktop: branded share sheet with preview + destinations
   * Image is painted via Canvas 2D (no DOM snapshot / blank preview).
   */
  const handleShareClick = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!displayCard || sharing) return;

    setSharing(true);
    setShareError(null);
    try {
      const blob = await renderInstaCueShareCardPng({
        question: displayCard.frontContent,
        answer: displayCard.backContent,
      });

      const filename = `edublast-instacue-${displayCard.id}.png`;

      if (prefersNativeFileShare()) {
        try {
          await shareInstaCuePngNative(blob, { filename });
          toast({
            title: "Shared",
            description: "Pick WhatsApp or Save Image from the system sheet.",
          });
          return;
        } catch (err) {
          if (err instanceof DOMException && err.name === "AbortError") return;
          // Fall through to desktop sheet if native share fails.
        }
      }

      revokeSharePreview();
      setShareBlob(blob);
      setSharePreviewUrl(URL.createObjectURL(blob));
      setShareSheetOpen(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      const message = err instanceof Error ? err.message : "Please try again.";
      setShareError(message);
      toast({
        variant: "destructive",
        title: "Could not prepare share",
        description: message,
      });
    } finally {
      setSharing(false);
    }
  };

  const shareButton = displayCard ? (
    <Button
      size="icon"
      variant="ghost"
      disabled={sharing}
      className={
        isDive
          ? "h-8 w-8 rounded-full border border-[#2a3444] bg-[#1b212b] text-[#eaeff5] hover:border-[#19E3DA]/40 hover:bg-[#243041]"
          : "h-8 w-8 rounded-full"
      }
      title="Share card"
      aria-label="Share InstaCue card"
      onClick={(ev) => void handleShareClick(ev)}
    >
      {sharing ? (
        <Loader2 className={isDive ? "h-3.5 w-3.5 animate-spin" : "h-4 w-4 animate-spin"} />
      ) : (
        <Share2 className={isDive ? "h-3.5 w-3.5" : "h-4 w-4"} />
      )}
    </Button>
  ) : null;

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
          {onAddCard
            ? "No cards yet for this subtopic and level. Use + to add one."
            : "No revision cards for this subtopic and level yet."}
        </p>
        {onAddCard && (
          <div className="mt-4 p-3 rounded-xl bg-muted/50 text-xs text-muted-foreground flex items-start gap-2">
            <Lightbulb className="w-4 h-4 shrink-0 text-amber-400/80 dark:text-amber-500/80 mt-0.5" />
            <span>
              Tip: Cards you add are kept separate per subtopic and level, and are ready for direct
              Supabase syncing.
            </span>
          </div>
        )}
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
    <div
      className={
        isDive
          ? "relative overflow-hidden rounded-2xl border border-[#ef9f27]/25 bg-[radial-gradient(circle_at_12%_0%,rgba(239,159,39,0.22),transparent_42%),radial-gradient(circle_at_90%_100%,rgba(29,158,117,0.16),transparent_45%),#141a22] p-3"
          : `edu-card rounded-2xl border border-border ${compact ? "p-3" : "p-5"}`
      }
    >
      {!isDive ? (
        <div className={`flex items-center justify-between gap-2 ${compact ? "mb-2" : "mb-3"}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5 shrink-0 text-amber-400/80 dark:text-amber-500/80" />
              <span className="font-bold text-foreground">InstaCue</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">Quick revision cards</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {shareButton}
            {onAddCard && (
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 shrink-0 rounded-full"
                onClick={() => setAddModalOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[rgba(239,159,39,0.2)] text-base shadow-[0_0_0_1px_rgba(239,159,39,0.3)]">
              ⚡
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#f3f6fa]">Quick flip</p>
              <p className="truncate text-[11px] text-[#8b96a5]">{subtopicName || topicName}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {shareButton}
            <span className="shrink-0 rounded-full bg-[rgba(29,158,117,0.18)] px-2.5 py-1 text-[11px] font-bold text-[#1d9e75] ring-1 ring-[rgba(29,158,117,0.35)]">
              {safeIndex + 1}/{filteredCards.length}
            </span>
          </div>
        </div>
      )}

      {!isDive ? (
        <div className="mb-3 flex flex-col gap-2">
          {subtopicOptions && subtopicOptions.length > 1 && (
            <select
              aria-label="Filter cards by subtopic"
              value={effectiveSubtopic}
              onChange={(e) => handleSubtopicChange(e.target.value)}
              className="w-full rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-muted/50 focus:border-primary/30 focus:outline-none focus:ring-2 focus:ring-primary/10"
            >
              {subtopicOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          )}
          <span className="edu-chip w-fit bg-muted text-xs text-muted-foreground">
            {filteredCards.length} card{filteredCards.length !== 1 ? "s" : ""}
            {effectiveSubtopic ? ` · ${effectiveSubtopic}` : ""}
          </span>
        </div>
      ) : null}

      {isDive ? (
        <div className="mb-2.5 h-1 w-full overflow-hidden rounded-full bg-[#1b212b]" aria-hidden>
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#ef9f27] to-[#1d9e75] transition-[width] duration-300"
            style={{
              width: `${((safeIndex + 1) / Math.max(1, filteredCards.length)) * 100}%`,
            }}
          />
        </div>
      ) : null}

      {displayCard && (
        <RevisionCard
          key={displayCard.id}
          card={displayCard}
          isFlipped={flipped}
          onFlip={handleFlip}
          compact={compact}
          presentation={presentation}
        />
      )}

      <div
        className={`flex items-center justify-between gap-2 px-0.5 ${isDive ? "mt-3" : "mt-4"}`}
      >
        <Button
          size="icon"
          variant="ghost"
          className={
            isDive
              ? "h-9 w-9 shrink-0 rounded-full border border-[#2a3444] bg-[#1b212b] text-[#eaeff5] hover:border-[#ef9f27]/50 hover:bg-[#243041]"
              : "h-9 w-9 shrink-0 rounded-full"
          }
          onClick={goPrev}
          disabled={filteredCards.length <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
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
                  className={`rounded-full transition-all ${
                    i === safeIndex
                      ? isDive
                        ? "h-2 w-5 bg-[#ef9f27]"
                        : "h-2.5 w-2.5 bg-primary/80"
                      : isDive
                        ? "h-1.5 w-1.5 bg-[#3a4556] hover:bg-[#8b96a5]"
                        : "h-2 w-2 bg-muted hover:bg-muted-foreground/40"
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
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            size="icon"
            variant="ghost"
            className={
              isDive
                ? "h-9 w-9 rounded-full border border-[#2a3444] bg-[#1b212b] text-[#eaeff5] hover:border-[#1d9e75]/50 hover:bg-[#243041]"
                : "h-9 w-9 rounded-full"
            }
            onClick={goNext}
            disabled={filteredCards.length <= 1}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          {displayCard && <SaveCardButton card={displayCard} />}
        </div>
      </div>
      {!isDive ? (
        <p className="mt-1 text-center text-xs text-muted-foreground">
          {displayCard ? safeIndex + 1 : 0} of {filteredCards.length} cards
        </p>
      ) : null}

      {!compact && !isDive && onAddCard && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/50 p-3 text-xs text-muted-foreground">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <span>
            Tip: Cards you add are kept separate per subtopic and level, and are ready for direct
            Supabase syncing.
          </span>
        </div>
      )}

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

      <InstaCueShareSheet
        open={shareSheetOpen}
        onOpenChange={(open) => {
          setShareSheetOpen(open);
          if (!open) {
            revokeSharePreview();
            setShareBlob(null);
            setShareError(null);
          }
        }}
        blob={shareBlob}
        previewUrl={sharePreviewUrl}
        loading={false}
        error={shareError}
        filename={
          displayCard ? `edublast-instacue-${displayCard.id}.png` : "edublast-instacue.png"
        }
        onToast={(opts) => toast(opts)}
      />
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
  const types: InstaCueCardType[] = ["concept", "formula", "common_mistake", "trap"];
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
            <label className="text-sm font-medium text-foreground block mb-2">Type</label>
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
          <Button onClick={onAdd} disabled={!front.trim() || !back.trim()} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Card
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
