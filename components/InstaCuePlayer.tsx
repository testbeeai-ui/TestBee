import React, { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/useUserStore";
import { useAuth } from "@/hooks/useAuth";
import { patchRevisionCardRecall } from "@/lib/saved/savedContentService";
import MathText from "@/components/MathText";
import { SavedRevisionCard } from "@/types";
import { reportInstacueCardRead } from "@/lib/rdm/reports/reportInstacueCardRead";
import { normalizeCardMath } from "@/lib/saved/revisionCardMath";
import { dedupeRevisionCards } from "@/lib/saved/revisionCardIdentity";
import {
  applyRevisionRecallAction,
  getRevisionRecallFeedback,
  isInRevisionStudyDeck,
  isInTomorrowTab,
  promoteDueTomorrowCards,
} from "@/lib/saved/revisionCardRecall";
import { useRecallNowMs } from "@/hooks/useRecallNowMs";
import { useToast } from "@/hooks/use-toast";
import {
  Plus,
  HelpCircle,
  Clock,
  Check,
  Layers,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface Props {
  cards: SavedRevisionCard[];
  onClose: () => void;
}

type TabType = "new" | "unsure" | "tomorrow" | "all";

function subtopicPillTitle(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export default function InstaCuePlayer({ cards, onClose }: Props) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const updateRevisionCardStatus = useUserStore((s) => s.updateRevisionCardStatus);
  const refreshDueRevisionCards = useUserStore((s) => s.refreshDueRevisionCards);
  const instacueReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("new");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [localPatches, setLocalPatches] = useState<
    Record<string, Pick<SavedRevisionCard, "status" | "reviewAt">>
  >({});

  const nowMs = useRecallNowMs();

  useEffect(() => {
    refreshDueRevisionCards();
  }, [nowMs, refreshDueRevisionCards]);

  const studyDeck = useMemo(() => {
    const promoted = promoteDueTomorrowCards(cards, nowMs);
    const patched = promoted.map((c) => ({ ...c, ...localPatches[c.id] }));
    return dedupeRevisionCards(patched).filter((c) => isInRevisionStudyDeck(c, nowMs));
  }, [cards, localPatches, nowMs]);

  const groupedCards = useMemo(() => {
    return {
      new: studyDeck.filter((c) => (c.status ?? "new") === "new"),
      unsure: studyDeck.filter((c) => c.status === "unsure"),
      tomorrow: studyDeck.filter((c) => isInTomorrowTab(c, nowMs)),
      all: studyDeck,
    };
  }, [studyDeck, nowMs]);

  const activeCards = groupedCards[activeTab];
  const currentCard = activeCards[currentIndex];

  useEffect(() => {
    setIsFlipped(false);
  }, [currentCard?.id]);

  useEffect(() => {
    setCurrentIndex((index) => {
      if (activeCards.length === 0) return 0;
      const maxIndex = activeCards.length - 1;
      const currentId = activeCards[index]?.id;
      if (currentId && activeCards.some((c) => c.id === currentId)) {
        const nextIndex = activeCards.findIndex((c) => c.id === currentId);
        return nextIndex >= 0 ? nextIndex : Math.min(index, maxIndex);
      }
      return Math.min(index, maxIndex);
    });
  }, [activeCards, activeTab]);

  useEffect(() => {
    if (!profile?.id || !currentCard?.id) return;
    const cardId = currentCard.id;
    if (instacueReadTimerRef.current) clearTimeout(instacueReadTimerRef.current);
    instacueReadTimerRef.current = setTimeout(() => {
      instacueReadTimerRef.current = null;
      void reportInstacueCardRead(cardId);
    }, 600);
    return () => {
      if (instacueReadTimerRef.current) clearTimeout(instacueReadTimerRef.current);
    };
  }, [profile?.id, currentCard?.id]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setCurrentIndex(0);
    setIsFlipped(false);
  };

  const handleStatusUpdate = (status: "unsure" | "tomorrow" | "know_it") => {
    if (!currentCard) return;

    const updated = applyRevisionRecallAction(currentCard, status, nowMs);
    setLocalPatches((prev) => ({
      ...prev,
      [currentCard.id]: { status: updated.status, reviewAt: updated.reviewAt },
    }));

    updateRevisionCardStatus(currentCard.id, status);
    const stored = useUserStore.getState().user?.savedRevisionCards ?? [];
    const synced = stored.find((c) => c.id === currentCard.id);
    if (synced) {
      patchRevisionCardRecall(synced).catch(() => {});
    }

    const feedback = getRevisionRecallFeedback(status, {
      reviewAt: updated.reviewAt,
      nowMs,
    });
    toast({ title: feedback.title, description: feedback.description });

    if (activeTab !== "all") {
      setCurrentIndex((prev) => Math.max(0, prev));
    } else if (currentIndex < activeCards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
    setIsFlipped(false);
  };

  const nextCard = () => {
    if (currentIndex < activeCards.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setIsFlipped(false);
    }
  };

  const prevCard = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setIsFlipped(false);
    }
  };

  const progressPercentage =
    activeCards.length === 0 ? 0 : Math.round(((currentIndex + 1) / activeCards.length) * 100);

  const TABS: { id: TabType; label: string; icon: React.ReactNode; count: number }[] = [
    { id: "new", label: "New", icon: <Plus className="w-4 h-4" />, count: groupedCards.new.length },
    {
      id: "unsure",
      label: "Unsure",
      icon: <HelpCircle className="w-4 h-4" />,
      count: groupedCards.unsure.length,
    },
    {
      id: "tomorrow",
      label: "Tomorrow",
      icon: <Clock className="w-4 h-4" />,
      count: groupedCards.tomorrow.length,
    },
    {
      id: "all",
      label: "All Cards",
      icon: <Layers className="w-4 h-4" />,
      count: groupedCards.all.length,
    },
  ];

  return (
    <div className="w-full">
      <div className="max-w-4xl w-full">
        {/* Tabs */}
        <div className="flex gap-1.5 mb-4 overflow-x-auto pb-2 scrollbar-none sm:gap-3 sm:mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 min-w-[60px] sm:min-w-[120px] flex flex-col items-center justify-center py-2.5 rounded-lg border transition-all sm:py-4 sm:rounded-xl ${
                activeTab === tab.id
                  ? "bg-primary/15 border-primary/40 text-foreground shadow-sm"
                  : "bg-card border-border/50 text-muted-foreground hover:border-primary/30 hover:text-foreground shadow-sm"
              }`}
            >
              <div className="flex items-center gap-1 sm:gap-2 mb-0.5 sm:mb-1">
                <span
                  className={`${activeTab === tab.id ? "text-primary" : "text-muted-foreground"}`}
                >
                  {tab.icon}
                </span>
                <span className="text-[10px] font-semibold sm:text-[14px]">{tab.label}</span>
              </div>
              <span className="text-base font-extrabold text-foreground sm:text-[22px]">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Progress */}
        <div className="flex flex-col mb-5 sm:mb-8">
          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground mb-1.5 px-1 sm:text-[13px] sm:mb-2">
            <span>
              Card {activeCards.length > 0 ? currentIndex + 1 : 0} of {activeCards.length}
            </span>
            <span>{progressPercentage}% Complete</span>
          </div>
          <div className="h-[6px] w-full bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              style={{ originX: 0 }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: progressPercentage / 100 }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Card Area */}
        <div className="flex flex-col items-center justify-start relative">
          <AnimatePresence mode="wait">
            {currentCard ? (
              <motion.div
                key={currentCard.id + (isFlipped ? "-back" : "-front")}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
                className="w-full max-w-2xl bg-card rounded-xl shadow-sm border border-border p-3.5 sm:p-5 md:p-6 cursor-pointer select-none sm:rounded-2xl"
                onClick={() => setIsFlipped((f) => !f)}
              >
                {!isFlipped ? (
                  // Front of Card
                  <div className="flex flex-col h-full min-h-[180px] sm:min-h-[230px]">
                    <div className="mb-3 flex items-center gap-1.5 sm:mb-4 sm:gap-2">
                      <span className="shrink-0 px-2.5 py-0.5 bg-primary/20 text-primary text-[10px] font-semibold rounded-full capitalize sm:px-3.5 sm:py-1 sm:text-[11px]">
                        {currentCard.type.replace("_", " ")}
                      </span>
                      <span className="shrink-0 px-2.5 py-0.5 bg-muted text-muted-foreground text-[10px] font-medium rounded-full lowercase sm:px-3.5 sm:py-1 sm:text-[11px]">
                        {currentCard.subject}
                      </span>
                      {currentCard.subtopicName ? (
                        <span
                          className="flex min-w-0 flex-1 items-center rounded-full border border-border/60 bg-muted/50 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:px-3 sm:py-1 sm:text-[11px]"
                          title={subtopicPillTitle(currentCard.subtopicName)}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            <MathText
                              as="span"
                              compact
                              className="instacue-subtopic-pill-math block min-w-0"
                              title={subtopicPillTitle(currentCard.subtopicName)}
                            >
                              {normalizeCardMath(currentCard.subtopicName, true)}
                            </MathText>
                          </span>
                        </span>
                      ) : (
                        <span className="min-w-0 flex-1" aria-hidden />
                      )}
                      <span className="shrink-0 px-2.5 py-0.5 bg-muted text-muted-foreground text-[10px] font-bold rounded-full uppercase tracking-wider sm:px-3.5 sm:py-1 sm:text-[11px]">
                        {currentCard.status === "new"
                          ? "New"
                          : (currentCard.status ?? "new").replace("_", " ")}
                      </span>
                    </div>

                    <div className="flex flex-1 items-center justify-center px-1 py-2 sm:px-2 sm:py-4">
                      <MathText
                        as="div"
                        className="w-full text-center text-[17px] font-semibold leading-snug text-foreground sm:text-[22px] sm:leading-relaxed md:text-[24px]"
                        weight="semibold"
                      >
                        {normalizeCardMath(currentCard.frontContent)}
                      </MathText>
                    </div>

                    <div className="mt-4 flex justify-center w-full sm:mt-6">
                      <p className="text-muted-foreground text-[11px] flex items-center gap-1.5 font-medium sm:text-[13px] sm:gap-2">
                        <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Tap to reveal answer
                      </p>
                    </div>
                  </div>
                ) : (
                  // Back of Card
                  <div className="flex flex-col h-full min-h-[180px] sm:min-h-[230px]">
                    <div className="mb-3 flex items-center gap-1.5 sm:mb-4 sm:gap-2">
                      {currentCard.subtopicName ? (
                        <span
                          className="flex min-w-0 flex-1 items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-[10px] font-medium text-primary sm:px-3 sm:py-1 sm:text-[11px]"
                          title={subtopicPillTitle(currentCard.subtopicName)}
                        >
                          <span className="min-w-0 flex-1 truncate">
                            <MathText
                              as="span"
                              compact
                              className="instacue-subtopic-pill-math block min-w-0"
                              title={subtopicPillTitle(currentCard.subtopicName)}
                            >
                              {normalizeCardMath(currentCard.subtopicName, true)}
                            </MathText>
                          </span>
                        </span>
                      ) : (
                        <span className="min-w-0 flex-1" aria-hidden />
                      )}
                      <span className="shrink-0 px-2.5 py-0.5 text-muted-foreground text-[11px] font-bold rounded-full border border-border sm:px-3.5 sm:py-1 sm:text-xs">
                        Answer
                      </span>
                    </div>

                    <div className="flex flex-1 items-center justify-center px-1 py-2 sm:px-2 sm:py-4">
                      <MathText
                        as="div"
                        className="w-full text-center text-[16px] font-semibold leading-snug text-foreground/95 sm:text-[20px] sm:leading-relaxed md:text-[22px]"
                        weight="semibold"
                      >
                        {normalizeCardMath(currentCard.backContent)}
                      </MathText>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="text-center p-12 bg-card rounded-2xl border border-dashed border-border w-full max-w-2xl">
                <div className="w-16 h-16 bg-muted text-muted-foreground rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">
                  You&apos;re all caught up!
                </h3>
                <p className="text-muted-foreground">
                  There are no cards in this section right now.
                </p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer Controls */}
        <div className="mt-4 flex items-center justify-center gap-4 pb-4">
          {currentCard && isFlipped ? (
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <Button
                variant="outline"
                className="cursor-pointer border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 px-4 py-3 rounded-xl font-semibold text-xs bg-card sm:px-7 sm:py-5 sm:rounded-[14px] sm:text-[14px]"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusUpdate("unsure");
                }}
              >
                <HelpCircle className="w-4 h-4 mr-1.5 sm:w-[18px] sm:h-[18px] sm:mr-2" />
                Unsure
              </Button>
              <Button
                variant="outline"
                className="cursor-pointer border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 px-4 py-3 rounded-xl font-semibold text-xs bg-card sm:px-7 sm:py-5 sm:rounded-[14px] sm:text-[14px]"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusUpdate("tomorrow");
                }}
              >
                <Clock className="w-4 h-4 mr-1.5 sm:w-[18px] sm:h-[18px] sm:mr-2" />
                Tomorrow
              </Button>
              <Button
                className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-3 rounded-xl font-semibold text-xs border-none shadow-sm sm:px-7 sm:py-5 sm:rounded-[14px] sm:text-[14px]"
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusUpdate("know_it");
                }}
              >
                <Check className="w-4 h-4 mr-1.5 sm:w-[18px] sm:h-[18px] sm:mr-2" />
                Know It
              </Button>
            </div>
          ) : currentCard && !isFlipped ? (
            <div className="flex items-center gap-4 text-muted-foreground font-semibold text-xs sm:gap-8 sm:text-[15px]">
              <button
                className="flex items-center gap-1.5 hover:text-foreground transition-colors disabled:opacity-40 sm:gap-2"
                onClick={prevCard}
                disabled={currentIndex === 0}
              >
                <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Previous
              </button>
              <span className="w-px h-3.5 bg-border sm:h-4" />
              <button
                className="flex items-center gap-1.5 hover:text-foreground transition-colors disabled:opacity-40 sm:gap-2"
                onClick={nextCard}
                disabled={currentIndex === activeCards.length - 1}
              >
                Next <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
