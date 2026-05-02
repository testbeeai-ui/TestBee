"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useUserStore } from "@/store/useUserStore";
import { questions } from "@/data/questions";
import QuestionCard from "@/components/QuestionCard";
import { BookMarked, Trash2, Plus, BookOpen, ChevronRight, Zap, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { BitsCarousel } from "@/components/BitsCarousel";
import { FormulaMcqCarousel } from "@/components/FormulaMcqCarousel";
import type {
  SavedRevisionCard,
  SavedRevisionUnit,
  SavedBit,
  SavedFormula,
  SavedCommunityPost,
} from "@/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import InstaCuePlayer from "@/components/InstaCuePlayer";
import AddRevisionCardModal from "@/components/AddRevisionCardModal";
import { buildDeepDivePath } from "@/lib/topicRoutes";
import { fetchSavedContent, syncAllSavedContent } from "@/lib/savedContentService";
import { mergeAllSavedContent } from "@/lib/mergeSavedContent";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const DEMO_CARDS: SavedRevisionCard[] = [
  {
    id: "demo-1",
    type: "formula",
    frontContent: "What is Newton's Second Law of Motion?",
    backContent:
      "F = ma\n\nForce equals mass times acceleration. The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass.",
    subtopicName: "Newton's Second Law",
    topic: "Laws of Motion",
    subject: "physics",
    classLevel: 11,
    status: "new",
  },
  {
    id: "demo-2",
    type: "concept",
    frontContent: "What is the powerhouse of the cell?",
    backContent:
      "Mitochondria\n\nThey generate most of the chemical energy needed to power the cell's biochemical reactions.",
    subtopicName: "Cellular Respiration",
    topic: "Cell Biology",
    subject: "chemistry",
    classLevel: 11,
    status: "new",
  },
  {
    id: "demo-3",
    type: "common_mistake",
    frontContent: "Does (x + y)² equal x² + y²?",
    backContent:
      "No, (x + y)² = x² + 2xy + y²\n\nForgetting the middle term (2xy) is a very common algebraic mistake.",
    subtopicName: "Binomial Expansion",
    topic: "Algebra",
    subject: "math",
    classLevel: 11,
    status: "new",
  },
];

type RevisionTab = "instacue" | "units" | "saved" | "community" | "questions";

/** Show only the subtopic name: strip "Subtopic 1.1:" prefix and " (Level: ...)" suffix. */
function subtopicDisplayName(sectionTitle: string): string {
  return (
    sectionTitle
      .replace(/^Subtopic\s+[\d.]+\s*:\s*/i, "")
      .replace(/\s*\(Level:.*$/i, "")
      .trim() || sectionTitle
  );
}

const VALID_REVISION_TABS: RevisionTab[] = [
  "instacue",
  "units",
  "saved",
  "community",
  "questions",
];

const RevisionContent = () => {
  const searchParams = useSearchParams();
  const { user: authUser } = useAuth();
  const user = useUserStore((s) => s.user);
  const unsaveQuestion = useUserStore((s) => s.unsaveQuestion);
  const unsaveRevisionUnit = useUserStore((s) => s.unsaveRevisionUnit);
  const unsaveBit = useUserStore((s) => s.unsaveBit);
  const unsaveFormula = useUserStore((s) => s.unsaveFormula);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RevisionTab>("instacue");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && VALID_REVISION_TABS.includes(tab as RevisionTab)) {
      setActiveTab(tab as RevisionTab);
    }
  }, [searchParams]);

  const savedQuestionsCount = useMemo(
    () => new Set(user?.savedQuestions ?? []).size,
    [user?.savedQuestions]
  );
  const savedQuestions = useMemo(
    () => questions.filter((q) => (user?.savedQuestions ?? []).includes(q.id)),
    [user?.savedQuestions]
  );
  const savedCards = user?.savedRevisionCards ?? [];
  const signedIn = Boolean(authUser);
  const displayCards = signedIn ? savedCards : savedCards.length > 0 ? savedCards : DEMO_CARDS;
  const savedRevisionUnits = user?.savedRevisionUnits ?? [];
  const savedBitsStoreCount = user?.savedBits?.length ?? 0;
  const savedFormulasStoreCount = user?.savedFormulas?.length ?? 0;
  const savedCommunityPostsStoreCount = user?.savedCommunityPosts?.length ?? 0;
  const savedTabBadgeCount = savedBitsStoreCount + savedFormulasStoreCount;
  const [savedBits, setSavedBits] = useState<SavedBit[]>([]);
  const [savedFormulas, setSavedFormulas] = useState<SavedFormula[]>([]);
  const [savedCommunityPosts, setSavedCommunityPosts] = useState<SavedCommunityPost[]>([]);
  const [savedContentLoading, setSavedContentLoading] = useState(false);

  useEffect(() => {
    setSavedBits(user?.savedBits ?? []);
    setSavedFormulas(user?.savedFormulas ?? []);
    setSavedCommunityPosts(user?.savedCommunityPosts ?? []);
  }, [user?.savedBits, user?.savedFormulas, user?.savedCommunityPosts]);

  useEffect(() => {
    if (!authUser?.id) return;
    let cancelled = false;
    fetchSavedContent()
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
        setSavedBits(merged.savedBits);
        setSavedFormulas(merged.savedFormulas);
        setSavedCommunityPosts(merged.savedCommunityPosts);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (activeTab !== "saved" && activeTab !== "community") return;
    const storeBits = useUserStore.getState().user?.savedBits ?? [];
    const storeFormulas = useUserStore.getState().user?.savedFormulas ?? [];
    const storeCommunityPosts = useUserStore.getState().user?.savedCommunityPosts ?? [];
    queueMicrotask(() => setSavedContentLoading(true));
    fetchSavedContent()
      .then(
        ({
          savedBits: bits,
          savedFormulas: formulas,
          savedRevisionCards: revisionCards,
          savedRevisionUnits: revisionUnits,
          savedCommunityPosts: communityPosts,
        }) => {
          const u = useUserStore.getState().user;
          if (!u) {
            setSavedBits(storeBits);
            setSavedFormulas(storeFormulas);
            return;
          }
          const merged = mergeAllSavedContent(
            u.savedBits ?? [],
            u.savedFormulas ?? [],
            u.savedRevisionCards ?? [],
            u.savedRevisionUnits ?? [],
            u.savedCommunityPosts ?? [],
            bits,
            formulas,
            revisionCards,
            revisionUnits,
            communityPosts
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
          setSavedBits(merged.savedBits);
          setSavedFormulas(merged.savedFormulas);
          setSavedCommunityPosts(merged.savedCommunityPosts);
        }
      )
      .catch(() => {
        setSavedBits(storeBits);
        setSavedFormulas(storeFormulas);
        setSavedCommunityPosts(storeCommunityPosts);
      })
      .finally(() => setSavedContentLoading(false));
  }, [activeTab]);

  /** Group saved bits by subject + topic (e.g. "Physics · Thermodynamics"). */
  const groupedBits = useMemo(() => {
    const groups = new Map<string, SavedBit[]>();
    for (const bit of savedBits) {
      const key = `${bit.subject} · ${bit.topic}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(bit);
    }
    return Array.from(groups.entries()).map(([label, bits]) => ({ label, bits }));
  }, [savedBits]);

  /** Group saved formulas by subject + topic (same pattern as bits). */
  const groupedFormulas = useMemo(() => {
    const groups = new Map<string, SavedFormula[]>();
    for (const formula of savedFormulas) {
      const key = `${formula.subject} · ${formula.topic}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(formula);
    }
    return Array.from(groups.entries()).map(([label, formulas]) => ({ label, formulas }));
  }, [savedFormulas]);

  const handleUnsaveBit = (bitId: string) => {
    unsaveBit(bitId);
    const u = useUserStore.getState().user;
    const nextBits = u?.savedBits ?? [];
    setSavedBits(nextBits);
    syncAllSavedContent().catch(() => {});
  };

  const handleUnsaveFormula = (formulaId: string) => {
    unsaveFormula(formulaId);
    const u = useUserStore.getState().user;
    const nextFormulas = u?.savedFormulas ?? [];
    setSavedFormulas(nextFormulas);
    syncAllSavedContent().catch(() => {});
  };

  const handleUnsaveCommunityPost = (postId: string) => {
    useUserStore.getState().unsaveCommunityPost(postId);
    const u = useUserStore.getState().user;
    setSavedCommunityPosts(u?.savedCommunityPosts ?? []);
    syncAllSavedContent().catch(() => {});
  };

  const revisionNavItems = useMemo(
    () => [
      { id: "instacue" as const, label: "InstaCue Cards", count: displayCards.length },
      { id: "units" as const, label: "Unit Revision", count: savedRevisionUnits.length },
      { id: "saved" as const, label: "Saved Quiz & Formulas", count: savedTabBadgeCount },
      {
        id: "community" as const,
        label: "Community Posts",
        count: savedCommunityPostsStoreCount,
      },
      { id: "questions" as const, label: "Saved Questions", count: savedQuestionsCount },
    ],
    [
      displayCards.length,
      savedRevisionUnits.length,
      savedTabBadgeCount,
      savedCommunityPostsStoreCount,
      savedQuestionsCount,
    ]
  );

  const sectionTitle =
    activeTab === "instacue"
      ? "InstaCue Cards"
      : activeTab === "units"
        ? "Unit Revision"
        : activeTab === "saved"
          ? "Saved Quiz & Formulas"
          : activeTab === "community"
            ? "Community Posts"
            : "Saved Questions";

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 pt-1 pb-8">
          <div className="mb-6 space-y-4">
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                {activeTab === "instacue" ? (
                  <>
                    <span className="text-orange-500 dark:text-orange-400">Insta</span>
                    <span className="text-slate-400 dark:text-slate-400">Cue Cards</span>
                  </>
                ) : (
                  sectionTitle
                )}
              </h1>
              <p className="text-muted-foreground text-sm mt-1 font-medium">
                {activeTab === "instacue"
                  ? "Quick revision flashcards with active recall and spaced repetition"
                  : activeTab === "units"
                    ? "Deep Dive sections you marked for revision"
                    : activeTab === "saved"
                      ? "Quiz and formula practice you saved from Deep Dive"
                      : activeTab === "community"
                        ? "Community feed posts you saved for revision"
                        : "Your personal stash of MCQs and numeric problems from Practice and Explore — saved in one tap, reviewed anytime."}
              </p>
              {activeTab === "questions" && (
                <p className="text-muted-foreground/90 text-xs mt-2 leading-relaxed max-w-2xl">
                  Save while you practice: each bookmark lands here and updates the{" "}
                  <strong className="text-foreground font-semibold">Saved Questions</strong> count on
                  your dashboard Revision strip right away. Open a card to practice again or remove it
                  when you no longer need it.
                </p>
              )}
            </div>

            <nav className="-mx-1 px-1 pb-0.5" aria-label="Revision sections">
              <div className="rounded-2xl border border-border bg-muted/30 p-2 sm:p-3 dark:bg-black/25">
                <div className="flex w-full min-w-0 flex-nowrap gap-1 sm:gap-1.5">
                  {revisionNavItems.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <Link
                        key={item.id}
                        href={`/revision?tab=${item.id}`}
                        replace
                        scroll={false}
                        aria-current={isActive ? "page" : undefined}
                        title={item.label}
                        className={cn(
                          "flex min-w-0 flex-1 items-center justify-center gap-1 rounded-full border px-1.5 py-1.5 text-[10px] font-bold transition-all sm:gap-1.5 sm:px-2 sm:py-2 sm:text-xs md:text-sm",
                          isActive
                            ? "border-transparent bg-primary text-primary-foreground shadow-md"
                            : "border-border/70 bg-background/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <span className="min-w-0 truncate text-center leading-tight">{item.label}</span>
                        <span
                          className={cn(
                            "shrink-0 tabular-nums rounded-full px-1.5 py-0.5 text-[9px] font-extrabold sm:min-w-[1.5rem] sm:px-2 sm:text-[11px]",
                            isActive
                              ? "bg-white/20 text-primary-foreground"
                              : "border border-border/60 bg-muted text-foreground"
                          )}
                        >
                          {item.count}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </nav>
          </div>

          {activeTab === "instacue" && (
            <>
              {signedIn && displayCards.length === 0 ? (
                <div className="edu-card p-10 text-center rounded-2xl border-2 border-dashed border-border">
                  <BookMarked className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">No InstaCue cards yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Add flashcards while studying from any Deep Dive (bookmark on a card) to build
                    your revision deck.
                  </p>
                  <Button variant="outline" className="rounded-xl" asChild>
                    <Link href="/explore-1">
                      Go to Explore <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <InstaCuePlayer cards={displayCards} onClose={() => {}} />
              )}
            </>
          )}

          {activeTab === "questions" && (
            <section className="space-y-4">
              {savedQuestionsCount === 0 ? (
                <div className="edu-card p-8 sm:p-10 text-center rounded-2xl border-2 border-dashed border-border">
                  <BookMarked className="w-12 h-12 mx-auto text-muted-foreground mb-4" aria-hidden />
                  <h2 className="text-lg font-bold text-foreground tracking-tight">
                    No saved questions yet
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 mb-5 max-w-md mx-auto leading-relaxed">
                    Anything you save from the question bank while practising shows up in this list — same
                    layout you see here: title, short context, and your count in the tab above.
                  </p>
                  <div className="text-left max-w-md mx-auto rounded-xl border border-border/60 bg-muted/20 px-4 py-3 mb-6 text-sm text-muted-foreground space-y-2">
                    <p className="font-semibold text-foreground text-xs uppercase tracking-wide">
                      How it works
                    </p>
                    <ol className="list-decimal list-inside space-y-1.5 leading-relaxed">
                      <li>Go to Practice or open a topic with MCQs.</li>
                      <li>Tap <strong className="text-foreground">Save</strong> on any question you want to revisit.</li>
                      <li>Return here to swipe through saved items or tap one to practice in full.</li>
                    </ol>
                  </div>
                  <Button variant="outline" className="rounded-xl font-semibold" asChild>
                    <Link href="/play">
                      Go to practice <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              ) : savedQuestions.length === 0 ? (
                <div className="edu-card p-8 sm:p-10 text-center rounded-2xl border-2 border-dashed border-border">
                  <BookMarked className="w-12 h-12 mx-auto text-muted-foreground mb-4" aria-hidden />
                  <h2 className="text-lg font-bold text-foreground tracking-tight">
                    {savedQuestionsCount} saved question{savedQuestionsCount === 1 ? "" : "s"} on your
                    account
                  </h2>
                  <p className="text-sm text-muted-foreground mt-2 mb-5 max-w-lg mx-auto leading-relaxed">
                    The counter above is correct — those bookmarks are stored for you. This preview list
                    only renders questions that exist in the on-device catalog, so very new or custom IDs
                    may not appear as cards yet.
                  </p>
                  <p className="text-xs text-muted-foreground mb-6 max-w-md mx-auto leading-relaxed">
                    Open <strong className="text-foreground">Explore</strong> or{" "}
                    <strong className="text-foreground">Practice</strong> where you originally saved the
                    question to work it again; your Revision dashboard badge still updates as soon as you
                    save.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                    <Button variant="outline" className="rounded-xl font-semibold" asChild>
                      <Link href="/play">
                        Go to practice <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                    <Button variant="ghost" className="rounded-xl font-semibold" asChild>
                      <Link href="/explore-1">
                        Go to Explore <ChevronRight className="w-4 h-4 ml-1" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl">
                    Below are the questions you saved, in the same card style as the rest of Revision: tap
                    a row to open the full question, or use the trash icon to remove it from your bank.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                  {savedQuestions.map((q, i) => (
                    <motion.div
                      key={q.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      {activeId === q.id ? (
                        <div className="sm:col-span-2">
                          <QuestionCard question={q} onNext={() => setActiveId(null)} />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setActiveId(q.id)}
                          className="w-full edu-card p-5 text-left border border-border rounded-xl"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="edu-chip bg-primary/10 text-primary mb-2">
                                {q.subject} · {q.topic}
                              </span>
                              <p className="text-sm font-bold text-foreground mt-2 line-clamp-2">
                                {q.question}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                unsaveQuestion(q.id);
                              }}
                              className="shrink-0 rounded-xl hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </button>
                      )}
                    </motion.div>
                  ))}
                </div>
                </>
              )}
            </section>
          )}

          {activeTab === "saved" && (
            <section>
              {savedContentLoading ? (
                <div className="edu-card p-10 text-center rounded-2xl border-2 border-dashed border-border">
                  <div className="animate-pulse flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted" />
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-64 bg-muted rounded" />
                  </div>
                </div>
              ) : savedBits.length === 0 && savedFormulas.length === 0 ? (
                <div className="edu-card p-10 text-center rounded-2xl border-2 border-dashed border-border">
                  <BookMarked className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">No saved quizzes or formulas yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Use the Save button (bookmark icon) on quizzes or Practice Formulas in any Deep
                    Dive section to add them here.
                  </p>
                  <Button variant="outline" className="rounded-xl" asChild>
                    <Link href="/explore-1">
                      Go to Explore <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-8">
                  {savedBits.length > 0 && (
                    <div>
                      <h3 className="text-[13px] font-bold text-[#94a3b8] mb-4 uppercase tracking-wider flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Saved quizzes
                      </h3>
                      <Accordion
                        type="multiple"
                        defaultValue={groupedBits.map((g) => g.label)}
                        className="space-y-3"
                      >
                        {groupedBits.map(({ label, bits }) => (
                          <AccordionItem
                            key={label}
                            value={label}
                            className="border rounded-xl px-4 bg-card/50 border-border"
                          >
                            <AccordionTrigger className="px-0 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                              <span className="font-bold text-foreground">{label}</span>
                              <span className="text-sm font-medium text-muted-foreground ml-2">
                                ({bits.length} bit{bits.length !== 1 ? "s" : ""})
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-0 pb-4">
                              <BitsCarousel bits={bits} onUnsave={handleUnsaveBit} />
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  )}
                  {savedFormulas.length > 0 && (
                    <div>
                      <h3 className="text-[13px] font-bold text-[#94a3b8] mb-4 uppercase tracking-wider flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        Formulas MCQ&apos;s
                      </h3>
                      <Accordion
                        type="multiple"
                        defaultValue={groupedFormulas.map((g) => g.label)}
                        className="space-y-3"
                      >
                        {groupedFormulas.map(({ label, formulas }) => (
                          <AccordionItem
                            key={label}
                            value={label}
                            className="border rounded-xl px-4 bg-card/50 border-border"
                          >
                            <AccordionTrigger className="px-0 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                              <span className="font-bold text-foreground">{label}</span>
                              <span className="text-sm font-medium text-muted-foreground ml-2">
                                ({formulas.length} question{formulas.length !== 1 ? "s" : ""})
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-0 pb-4">
                              <FormulaMcqCarousel
                                formulas={formulas}
                                onUnsave={handleUnsaveFormula}
                              />
                            </AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {activeTab === "community" && (
            <section>
              {savedContentLoading ? (
                <div className="edu-card p-10 text-center rounded-2xl border-2 border-dashed border-border">
                  <div className="animate-pulse flex flex-col items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted" />
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-64 bg-muted rounded" />
                  </div>
                </div>
              ) : savedCommunityPosts.length === 0 ? (
                <div className="edu-card p-10 text-center rounded-2xl border-2 border-dashed border-border">
                  <BookMarked className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">No saved community posts yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Use &quot;Save for revision&quot; on any community post in Lessons to keep it
                    here.
                  </p>
                  <Button variant="outline" className="rounded-xl" asChild>
                    <Link href="/explore-1">
                      Go to Lessons <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {savedCommunityPosts.map((post, i) => (
                    <motion.div
                      key={post.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="rounded-xl border border-border bg-card/70 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {post.subject ? (
                            <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-0.5 text-xs font-semibold text-blue-300 ring-1 ring-inset ring-blue-400/30">
                              {post.subject}
                            </span>
                          ) : null}
                          {post.chapterRef ? (
                            <span className="inline-flex items-center rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs font-semibold text-cyan-200 ring-1 ring-inset ring-cyan-400/30">
                              CH {post.chapterRef}
                            </span>
                          ) : null}
                          {post.topicRef ? (
                            <span className="inline-flex items-center rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-semibold text-violet-200 ring-1 ring-inset ring-violet-400/30">
                              TP {post.topicRef}
                            </span>
                          ) : null}
                          {post.subtopicRef ? (
                            <span className="inline-flex items-center rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/35">
                              SUB {post.subtopicRef}
                            </span>
                          ) : null}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleUnsaveCommunityPost(post.postId)}
                          className="rounded-xl shrink-0 hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      {post.title ? (
                        <p className="mt-2 text-sm font-bold text-foreground">{post.title}</p>
                      ) : null}
                      <p className="mt-1 text-sm text-foreground/90 whitespace-pre-wrap">
                        {post.content}
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </section>
          )}

          {activeTab === "units" && (
            <section>
              {savedRevisionUnits.length === 0 ? (
                <div className="edu-card p-10 text-center rounded-2xl border-2 border-dashed border-border">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">
                    No units marked for revision yet
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Use &quot;Mark for revision&quot; on any Deep Dive page to add it here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {savedRevisionUnits.map((unit: SavedRevisionUnit, i: number) => {
                    const deepDiveHref = buildDeepDivePath(
                      unit.board.toLowerCase(),
                      unit.subject,
                      unit.classLevel,
                      unit.unitName,
                      unit.subtopicName,
                      unit.level,
                      unit.sectionIndex
                    );
                    const levelLabel = unit.level.charAt(0).toUpperCase() + unit.level.slice(1);
                    const levelStyles =
                      unit.level === "basics"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-400/40 font-bold"
                        : unit.level === "intermediate"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-400/40 font-bold"
                          : "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-400/40 font-bold";
                    return (
                      <motion.div
                        key={unit.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="edu-card p-4 rounded-xl border-2 border-primary/20 flex flex-col gap-3 h-full"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="edu-chip bg-primary/10 text-primary text-xs font-bold">
                            {unit.subject.charAt(0).toUpperCase() + unit.subject.slice(1)} · Class{" "}
                            {unit.classLevel}
                          </span>
                          <span
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${levelStyles}`}
                          >
                            {levelLabel}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {unit.unitName} → {unit.subtopicName}
                        </p>
                        <p
                          className="text-sm font-bold text-foreground line-clamp-2 flex-1"
                          title={unit.sectionTitle}
                        >
                          {subtopicDisplayName(unit.sectionTitle)}
                        </p>
                        <div className="flex items-center gap-2 mt-auto pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl flex-1 h-9 px-3"
                            asChild
                          >
                            <Link
                              href={deepDiveHref}
                              className="inline-flex items-center justify-center gap-1 font-bold whitespace-nowrap"
                            >
                              <span>Open</span>
                              <ChevronRight className="w-4 h-4 shrink-0" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              unsaveRevisionUnit(unit.id);
                              syncAllSavedContent().catch(() => {});
                            }}
                            className="rounded-xl shrink-0 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Floating Action Button — only on InstaCue Cards tab (add card); Unit Revision is separate */}
        {activeTab === "instacue" && (
          <div className="fixed bottom-8 right-8 z-40">
            <Button
              size="icon"
              className="w-14 h-14 rounded-full shadow-lg bg-[#172033] hover:bg-[#1f2b44] text-white"
              onClick={() => setIsAddModalOpen(true)}
            >
              <Plus className="w-6 h-6" />
            </Button>
          </div>
        )}

        <AddRevisionCardModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} />
      </AppLayout>
    </ProtectedRoute>
  );
};

export default function Revision() {
  return (
    <Suspense fallback={<div className="min-h-[40vh]" />}>
      <RevisionContent />
    </Suspense>
  );
}
