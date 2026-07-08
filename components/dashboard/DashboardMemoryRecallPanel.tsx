"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  RotateCw,
  Flag,
  Clock,
  CheckCircle2,
  Check,
  Lightbulb,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import { fetchSavedContent, patchRevisionCardRecall } from "@/lib/saved/savedContentService";
import { mergeAllSavedContent } from "@/lib/saved/mergeSavedContent";
import { dedupeRevisionCards } from "@/lib/saved/revisionCardIdentity";
import {
  applyRevisionRecallAction,
  getRevisionRecallFeedback,
  isInMemoryRecallQueue,
} from "@/lib/saved/revisionCardRecall";
import { useRecallNowMs } from "@/hooks/useRecallNowMs";
import { useToast } from "@/hooks/use-toast";
import { DEMO_REVISION_CARDS } from "@/lib/saved/demoRevisionCards";
import type { SavedRevisionCard, Subject } from "@/types";
import { cn } from "@/lib/utils";
import { INSTACUE_TYPE_CONFIG } from "@/lib/instacue/instaCueTypeConfig";
import { normalizeCardMath } from "@/lib/saved/revisionCardMath";
import MathText from "@/components/MathText";
import type { RecallAction } from "@/components/dashboard/DashboardMemoryRecallFlipCard";

function isDemoCardId(id: string): boolean {
  return id.startsWith("demo-");
}

type FilterSubject = "all" | Subject;

const SUBJECT_FILTERS: { id: FilterSubject; label: string }[] = [
  { id: "all", label: "All" },
  { id: "physics", label: "Physics" },
  { id: "chemistry", label: "Chemistry" },
  { id: "math", label: "Mathematics" },
];

const SUBJECT_STYLE: Record<
  Subject,
  { border: string; label: string; text: string; display: string }
> = {
  physics: {
    border: "border-blue-500/30 hover:border-blue-500/65 shadow-[0_0_10px_rgba(59,130,246,0.06)] hover:shadow-[0_0_18px_rgba(59,130,246,0.22)]",
    label: "bg-blue-500/10 text-blue-400",
    text: "text-blue-450",
    display: "Physics",
  },
  chemistry: {
    border: "border-emerald-500/30 hover:border-emerald-500/65 shadow-[0_0_10px_rgba(16,185,129,0.06)] hover:shadow-[0_0_18px_rgba(16,185,129,0.22)]",
    label: "bg-emerald-500/10 text-emerald-400",
    text: "text-emerald-450",
    display: "Chemistry",
  },
  math: {
    border: "border-purple-500/30 hover:border-purple-500/65 shadow-[0_0_10px_rgba(168,85,247,0.06)] hover:shadow-[0_0_18px_rgba(168,85,247,0.22)]",
    label: "bg-purple-500/10 text-purple-400",
    text: "text-purple-450",
    display: "Mathematics",
  },
};

function CardActions({
  selectedAction,
  onAction,
}: {
  selectedAction: RecallAction | null;
  onAction: (action: RecallAction) => void;
}) {
  const actions: {
    id: RecallAction;
    label: string;
    icon: React.ReactNode;
    activeIcon: React.ReactNode;
    activeClass: string;
  }[] = [
    {
      id: "unsure",
      label: "Unsure",
      icon: <Flag className="h-3.5 w-3.5 text-[#EF9F27]" aria-hidden />,
      activeIcon: <Flag className="h-3.5 w-3.5 fill-[#EF9F27] text-[#EF9F27]" aria-hidden />,
      activeClass: "bg-[#EF9F27]/10 border-[#EF9F27]/30 text-[#EF9F27]",
    },
    {
      id: "tomorrow",
      label: "Tomorrow",
      icon: <Clock className="h-3.5 w-3.5 text-[#378ADD]" aria-hidden />,
      activeIcon: <CheckCircle2 className="h-3.5 w-3.5 text-[#378ADD]" aria-hidden />,
      activeClass: "bg-[#378ADD]/10 border-[#378ADD]/30 text-[#378ADD]",
    },
    {
      id: "know_it",
      label: "Know It",
      icon: <CheckCircle2 className="h-3.5 w-3.5 text-[#1D9E75]" aria-hidden />,
      activeIcon: <Check className="h-3.5 w-3.5 text-[#1D9E75]" aria-hidden />,
      activeClass: "bg-[#1D9E75]/10 border-[#1D9E75]/30 text-[#1D9E75]",
    },
  ];

  return (
    <div className="flex items-center justify-around gap-2.5 border-t border-white/5 pt-3.5">
      {actions.map((action) => {
        const isSelected = selectedAction === action.id;
        const isDimmed = selectedAction != null && !isSelected;
        return (
          <button
            key={action.id}
            type="button"
            onClick={() => onAction(action.id)}
            disabled={isDimmed}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[11px] font-bold transition-all",
              isSelected
                ? action.activeClass
                : "border-white/5 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground",
              isDimmed && "pointer-events-none opacity-30"
            )}
          >
            {isSelected ? action.activeIcon : action.icon}
            {action.label}
          </button>
        );
      })}
    </div>
  );
}

export default function DashboardMemoryRecallPanel() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const storeUser = useUserStore((s) => s.user);
  const updateRevisionCardStatus = useUserStore((s) => s.updateRevisionCardStatus);
  const refreshDueRevisionCards = useUserStore((s) => s.refreshDueRevisionCards);

  const [activeFilter, setActiveFilter] = useState<FilterSubject>("all");
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [localPatches, setLocalPatches] = useState<
    Record<string, Pick<SavedRevisionCard, "status" | "reviewAt">>
  >({});

  useEffect(() => {
    if (!authUser?.id) return;
    let cancelled = false;
    fetchSavedContent({ types: ["savedRevisionCards"] })
      .then((data) => {
        if (cancelled) return;
        const u = useUserStore.getState().user;
        if (!u) return;
        const merged = mergeAllSavedContent(
          u.savedBits ?? [],
          u.savedFormulas ?? [],
          u.savedRevisionCards ?? [],
          u.savedRevisionUnits ?? [],
          u.savedCommunityPosts ?? [],
          data.savedBits,
          data.savedFormulas,
          data.savedRevisionCards,
          data.savedRevisionUnits,
          data.savedCommunityPosts
        );
        useUserStore
          .getState()
          .setSavedFromServer(
            merged.savedBits,
            merged.savedFormulas,
            merged.savedRevisionCards,
            merged.savedRevisionUnits,
            merged.savedCommunityPosts
          );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  const savedCards = useMemo(
    () => dedupeRevisionCards(storeUser?.savedRevisionCards ?? []),
    [storeUser?.savedRevisionCards]
  );

  const deck = useMemo((): SavedRevisionCard[] => {
    if (savedCards.length > 0) return savedCards;
    return DEMO_REVISION_CARDS;
  }, [savedCards]);

  const nowMs = useRecallNowMs();

  useEffect(() => {
    refreshDueRevisionCards();
  }, [nowMs, refreshDueRevisionCards]);

  const cardsWithLocalStatus = useMemo(
    () =>
      deck.map((card) => {
        const patch = localPatches[card.id];
        if (!patch) return card;
        return { ...card, ...patch };
      }),
    [deck, localPatches]
  );

  const recallQueue = useMemo(
    () => cardsWithLocalStatus.filter((c) => isInMemoryRecallQueue(c, nowMs)),
    [cardsWithLocalStatus, nowMs]
  );

  const filteredDeck = useMemo(() => {
    if (activeFilter === "all") return recallQueue;
    return recallQueue.filter((c) => c.subject === activeFilter);
  }, [recallQueue, activeFilter]);

  const safeIndex = Math.min(cardIndex, Math.max(0, filteredDeck.length - 1));
  const total = filteredDeck.length;
  const currentCard = filteredDeck[safeIndex] ?? null;

  // Always show the question side when navigating to a different card.
  useLayoutEffect(() => {
    setFlipped(false);
  }, [currentCard?.id]);

  const selectFilter = (f: FilterSubject) => {
    setActiveFilter(f);
    setCardIndex(0);
    setFlipped(false);
  };

  const goNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (safeIndex < total - 1) {
      setFlipped(false);
      setCardIndex(safeIndex + 1);
    }
  };
  const goPrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (safeIndex > 0) {
      setFlipped(false);
      setCardIndex(safeIndex - 1);
    }
  };

  const handleAction = useCallback(
    (card: SavedRevisionCard, action: RecallAction) => {
      const updated = applyRevisionRecallAction(card, action, nowMs);
      setLocalPatches((prev) => ({
        ...prev,
        [card.id]: { status: updated.status, reviewAt: updated.reviewAt },
      }));
      const feedback = getRevisionRecallFeedback(action, {
        reviewAt: updated.reviewAt,
        nowMs,
      });
      toast({ title: feedback.title, description: feedback.description });
      if (!isDemoCardId(card.id)) {
        updateRevisionCardStatus(card.id, action);
        const stored = useUserStore.getState().user?.savedRevisionCards ?? [];
        const synced = stored.find((c) => c.id === card.id);
        if (synced) patchRevisionCardRecall(synced).catch(() => {});
      }
    },
    [nowMs, toast, updateRevisionCardStatus]
  );

  const renderCard = (card: SavedRevisionCard) => {
    const style = SUBJECT_STYLE[card.subject] ?? SUBJECT_STYLE.physics;
    const typeCfg =
      INSTACUE_TYPE_CONFIG[card.type ?? "concept"] ?? INSTACUE_TYPE_CONFIG.concept;
    const selectedAction =
      (localPatches[card.id]?.status as RecallAction | undefined) ?? null;

    return (
      <div
        key={card.id}
        role="button"
        tabIndex={0}
        aria-label={
          flipped ? "Card flipped — showing answer" : "Card — tap to reveal answer"
        }
        onClick={() => setFlipped((f) => !f)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
        className={cn(
          "relative cursor-pointer overflow-hidden rounded-xl border bg-[#111418]/60 shadow-sm transition-all duration-300 select-none",
          style.border
        )}
      >
        {/* Card header */}
        <div className="flex items-center gap-2 border-b border-white/5 px-5 pt-4 pb-3.5">
          <span
            className={cn(
              "inline-flex rounded px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider leading-none",
              typeCfg.badge
            )}
          >
            {typeCfg.label}
          </span>
          <span className={cn("text-[11px] font-bold uppercase tracking-wider", style.text)}>
            {style.display}
          </span>
          <RotateCw className="ml-auto h-3.5 w-3.5 text-muted-foreground/30" aria-hidden />
        </div>

        {/* Card body */}
        <div className="px-5 py-4" style={{ minHeight: 140 }}>
          {!flipped ? (
            <MathText
              weight="semibold"
              className="block text-[13.5px] leading-relaxed text-white font-semibold"
            >
              {normalizeCardMath(card.frontContent, true)}
            </MathText>
          ) : (
            <>
              <div className="mb-2.5 flex items-center gap-1.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#1D9E75]">
                <Lightbulb className="h-3.5 w-3.5" aria-hidden />
                Answer
              </div>
              <MathText
                weight="normal"
                className="block text-[13px] leading-relaxed text-[#c9d1d9] font-medium"
              >
                {normalizeCardMath(card.backContent, true) ||
                  "No answer saved for this card."}
              </MathText>
            </>
          )}
        </div>

        {/* Bottom bar */}
        {!flipped ? (
          <div className="flex items-center justify-center gap-1.5 border-t border-white/5 px-5 py-3.5 text-[11.5px] font-bold text-muted-foreground/60 hover:text-foreground/90 transition-colors">
            <RotateCw className="h-3.5 w-3.5" aria-hidden />
            Tap to reveal answer
          </div>
        ) : (
          <div
            className="border-t border-white/5 px-5 pb-4 pt-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <CardActions
              selectedAction={selectedAction}
              onAction={(action) => handleAction(card, action)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="dashboard-memory-recall min-w-0 w-full rounded-xl border border-white/5 bg-card/50 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-bold text-foreground sm:text-base">
          <Brain className="h-4.5 w-4.5 text-[#EF9F27]" aria-hidden />
          Instacue
        </h2>
        <Link
          href="/revision?tab=instacue"
          className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 hover:underline"
        >
          View all
        </Link>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/5 px-5 py-3.5">
        {SUBJECT_FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => selectFilter(f.id)}
            className={cn(
              "rounded-full px-3.5 py-1 text-[11.5px] font-bold transition-all border",
              activeFilter === f.id
                ? "bg-emerald-500/10 text-emerald-450 border-emerald-500/25 shadow-sm shadow-emerald-500/5"
                : "bg-white/5 text-muted-foreground border-white/5 hover:bg-white/10 hover:text-foreground"
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs font-semibold text-muted-foreground">
          {total} cards
        </span>
      </div>

      {/* Card area */}
      <div className="p-5">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-muted/5 py-10 text-center">
            <Brain className="mb-2.5 h-8 w-8 text-muted-foreground/30" aria-hidden />
            <p className="text-sm font-bold text-muted-foreground">No cards due</p>
            <p className="mt-1 text-xs text-muted-foreground/60 max-w-[200px] leading-relaxed">
              Save Instacue cards from lessons to review here
            </p>
          </div>
        ) : currentCard ? (
          renderCard(currentCard)
        ) : null}
      </div>

      {/* Nav */}
      {total > 0 && (
        <div className="flex items-center justify-between border-t border-white/5 px-5 py-3">
          <button
            type="button"
            disabled={safeIndex === 0}
            onClick={goPrev}
            className="flex items-center gap-1 text-[12.5px] font-bold text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-4.5 w-4.5" aria-hidden />
            Prev
          </button>
          <span className="text-xs font-semibold text-muted-foreground">
            {safeIndex + 1} of {total}
          </span>
          <button
            type="button"
            disabled={safeIndex === total - 1}
            onClick={goNext}
            className="flex items-center gap-1 text-[12.5px] font-bold text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
          >
            Next
            <ChevronRight className="h-4.5 w-4.5" aria-hidden />
          </button>
        </div>
      )}

      {/* Footer */}
      <Link
        href="/revision?tab=instacue"
        className="block border-t border-white/5 py-3.5 text-center text-xs font-bold text-emerald-500 hover:text-emerald-450 hover:underline"
      >
        Open full revision →
      </Link>
    </div>
  );
}
