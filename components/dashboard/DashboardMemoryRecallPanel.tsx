"use client";

import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { Brain, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserStore } from "@/store/useUserStore";
import { fetchSavedContent, patchRevisionCardRecall } from "@/lib/saved/savedContentService";
import { mergeAllSavedContent } from "@/lib/saved/mergeSavedContent";
import { dedupeRevisionCards } from "@/lib/saved/revisionCardIdentity";
import {
  applyRevisionRecallAction,
  countScheduledTomorrow,
  countUnsureInRevisionDeck,
  getRevisionRecallFeedback,
  isInMemoryRecallQueue,
} from "@/lib/saved/revisionCardRecall";
import { useRecallNowMs } from "@/hooks/useRecallNowMs";
import { useToast } from "@/hooks/use-toast";
import { DEMO_REVISION_CARDS } from "@/lib/saved/demoRevisionCards";
import type { SavedRevisionCard } from "@/types";
import { cn } from "@/lib/utils";
import DashboardMemoryRecallFlipCard, {
  type RecallAction,
} from "@/components/dashboard/DashboardMemoryRecallFlipCard";

const PER_PAGE = 10;

function isDemoCardId(id: string): boolean {
  return id.startsWith("demo-");
}

export default function DashboardMemoryRecallPanel() {
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const storeUser = useUserStore((s) => s.user);
  const updateRevisionCardStatus = useUserStore((s) => s.updateRevisionCardStatus);
  const refreshDueRevisionCards = useUserStore((s) => s.refreshDueRevisionCards);

  const [page, setPage] = useState(1);
  const [flippedCardId, setFlippedCardId] = useState<string | null>(null);
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

  const dueTomorrowCount = useMemo(
    () => countScheduledTomorrow(cardsWithLocalStatus, nowMs),
    [cardsWithLocalStatus, nowMs]
  );

  const unsureCount = useMemo(
    () => countUnsureInRevisionDeck(cardsWithLocalStatus),
    [cardsWithLocalStatus]
  );

  const totalPages = Math.max(1, Math.ceil(recallQueue.length / PER_PAGE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setFlippedCardId(null);
  }, [page]);

  const pageCards = useMemo(() => {
    const start = (page - 1) * PER_PAGE;
    return recallQueue.slice(start, start + PER_PAGE);
  }, [recallQueue, page]);

  useEffect(() => {
    if (flippedCardId && !pageCards.some((c) => c.id === flippedCardId)) {
      setFlippedCardId(null);
    }
  }, [pageCards, flippedCardId]);

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
        if (synced) {
          patchRevisionCardRecall(synced).catch(() => {});
        }
      }
    },
    [nowMs, toast, updateRevisionCardStatus]
  );

  const goPage = (next: number) => {
    if (next < 1 || next > totalPages) return;
    setFlippedCardId(null);
    setPage(next);
  };

  const handleGridPointer = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (!flippedCardId) return;
      const under = document.elementFromPoint(e.clientX, e.clientY);
      const host = under?.closest("[data-memory-recall-card]");
      const id = host?.getAttribute("data-memory-recall-card");
      if (id !== flippedCardId) {
        setFlippedCardId(null);
      }
    },
    [flippedCardId]
  );

  const clearFlippedCard = useCallback(() => {
    setFlippedCardId(null);
  }, []);

  return (
    <div className="dashboard-memory-recall min-w-0 w-full rounded-xl border border-border/70 bg-card/80 shadow-sm">
      <div
        className="flex items-center justify-between border-b border-border/60 px-3 py-2"
        onMouseEnter={clearFlippedCard}
      >
        <h2 className="flex items-center gap-1.5 text-[13.5px] font-medium text-foreground">
          <Brain className="h-4 w-4 text-[#EF9F27]" aria-hidden />
          Memory Recall
        </h2>
        <div className="flex items-center gap-1.5">
          {dueTomorrowCount > 0 ? (
            <span className="rounded-full border border-[#EF9F27]/60 bg-[#EF9F27]/10 px-2 py-0.5 text-[10px] font-medium text-[#FAC775]">
              Due Tomorrow
            </span>
          ) : null}
          <span className="text-[11.5px] text-muted-foreground">
            {recallQueue.length} cards
          </span>
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-2 border-b border-border/60 bg-muted/20 px-3 py-1"
        onMouseEnter={clearFlippedCard}
      >
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full border-2 border-[#378ADD]" aria-hidden />
          Physics
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full border-2 border-[#1D9E75]" aria-hidden />
          Chemistry
        </span>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <span className="h-2 w-2 rounded-full border-2 border-[#7F77DD]" aria-hidden />
          Mathematics
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">Tap card to see answer</span>
      </div>

      <div
        className="grid grid-cols-2 gap-2 p-2 pb-1.5"
        onMouseMove={handleGridPointer}
      >
        {pageCards.map((card) => (
          <div key={card.id} data-memory-recall-card={card.id} className="min-h-0">
            <DashboardMemoryRecallFlipCard
              card={card}
              flipped={flippedCardId === card.id}
              onFlipChange={(next) => setFlippedCardId(next ? card.id : null)}
              onPeerHover={() => {
                if (flippedCardId != null && flippedCardId !== card.id) {
                  setFlippedCardId(null);
                }
              }}
              selectedAction={
                (localPatches[card.id]?.status as RecallAction | undefined) ?? null
              }
              onAction={(action) => handleAction(card, action)}
            />
          </div>
        ))}
      </div>

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-1 border-t border-border/60 px-2.5 py-2">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => goPage(page - 1)}
            className="flex items-center gap-0.5 rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-emerald-500/50 hover:text-emerald-500 disabled:pointer-events-none disabled:opacity-30"
          >
            <ChevronLeft className="h-3 w-3" aria-hidden />
            Prev
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => goPage(n)}
              className={cn(
                "rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                n === page
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-border/70 bg-muted/30 text-muted-foreground hover:border-emerald-500/50 hover:text-emerald-500"
              )}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => goPage(page + 1)}
            className="flex items-center gap-0.5 rounded-md border border-border/70 bg-muted/30 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-emerald-500/50 hover:text-emerald-500 disabled:pointer-events-none disabled:opacity-30"
          >
            Next
            <ChevronRight className="h-3 w-3" aria-hidden />
          </button>
        </div>
      ) : null}

      <Link
        href="/revision?tab=instacue"
        className="block border-t border-border/60 py-2 text-center text-[11px] font-bold text-emerald-500 hover:underline"
      >
        Open full revision →
      </Link>
      {unsureCount > 0 ? (
        <p className="border-t border-border/60 px-3 pb-2 text-center text-[10px] text-muted-foreground">
          {unsureCount} card{unsureCount === 1 ? "" : "s"} in{" "}
          <Link href="/revision?tab=instacue" className="font-semibold text-emerald-500 hover:underline">
            Unsure
          </Link>{" "}
          (Revision only)
        </p>
      ) : null}
    </div>
  );
}
