"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import AppLayout from '@/components/AppLayout';
import { useUserStore } from '@/store/useUserStore';
import { questions } from '@/data/questions';
import QuestionCard from '@/components/QuestionCard';
import { BookMarked, Trash2, Plus, BookOpen, ChevronRight, Zap, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { BitsCarousel } from '@/components/BitsCarousel';
import { FormulaMcqCarousel } from '@/components/FormulaMcqCarousel';
import type { SavedRevisionCard, SavedRevisionUnit, SavedBit, SavedFormula } from '@/types';
import { ProtectedRoute } from "@/components/ProtectedRoute";
import InstaCuePlayer from '@/components/InstaCuePlayer';
import AddRevisionCardModal from '@/components/AddRevisionCardModal';
import { buildDeepDivePath } from '@/lib/topicRoutes';
import { fetchSavedContent, syncAllSavedContent } from '@/lib/savedContentService';
import { mergeAllSavedContent } from '@/lib/mergeSavedContent';
import { useAuth } from '@/hooks/useAuth';

const DEMO_CARDS: SavedRevisionCard[] = [
  {
    id: 'demo-1',
    type: 'formula',
    frontContent: 'What is Newton\'s Second Law of Motion?',
    backContent: 'F = ma\n\nForce equals mass times acceleration. The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass.',
    subtopicName: 'Newton\'s Second Law',
    topic: 'Laws of Motion',
    subject: 'physics',
    classLevel: 11,
    status: 'new'
  },
  {
    id: 'demo-2',
    type: 'concept',
    frontContent: 'What is the powerhouse of the cell?',
    backContent: 'Mitochondria\n\nThey generate most of the chemical energy needed to power the cell\'s biochemical reactions.',
    subtopicName: 'Cellular Respiration',
    topic: 'Cell Biology',
    subject: 'biology',
    classLevel: 11,
    status: 'new'
  },
  {
    id: 'demo-3',
    type: 'common_mistake',
    frontContent: 'Does (x + y)² equal x² + y²?',
    backContent: 'No, (x + y)² = x² + 2xy + y²\n\nForgetting the middle term (2xy) is a very common algebraic mistake.',
    subtopicName: 'Binomial Expansion',
    topic: 'Algebra',
    subject: 'math',
    classLevel: 11,
    status: 'new'
  },
];

type RevisionTab = 'instacue' | 'units' | 'saved';

/** Show only the subtopic name: strip "Subtopic 1.1:" prefix and " (Level: ...)" suffix. */
function subtopicDisplayName(sectionTitle: string): string {
  return sectionTitle
    .replace(/^Subtopic\s+[\d.]+\s*:\s*/i, '')
    .replace(/\s*\(Level:.*$/i, '')
    .trim() || sectionTitle;
}

const Revision = () => {
  const { user: authUser } = useAuth();
  const user = useUserStore((s) => s.user);
  const unsaveQuestion = useUserStore((s) => s.unsaveQuestion);
  const unsaveRevisionUnit = useUserStore((s) => s.unsaveRevisionUnit);
  const unsaveBit = useUserStore((s) => s.unsaveBit);
  const unsaveFormula = useUserStore((s) => s.unsaveFormula);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<RevisionTab>('instacue');

  const savedQuestions = questions.filter((q) => user?.savedQuestions.includes(q.id));
  const savedCards = user?.savedRevisionCards ?? [];
  const signedIn = Boolean(authUser);
  const displayCards = signedIn ? savedCards : savedCards.length > 0 ? savedCards : DEMO_CARDS;
  const savedRevisionUnits = user?.savedRevisionUnits ?? [];
  const savedBitsStoreCount = user?.savedBits?.length ?? 0;
  const savedFormulasStoreCount = user?.savedFormulas?.length ?? 0;
  const savedTabBadgeCount = savedBitsStoreCount + savedFormulasStoreCount;
  const [savedBits, setSavedBits] = useState<SavedBit[]>([]);
  const [savedFormulas, setSavedFormulas] = useState<SavedFormula[]>([]);
  const [savedContentLoading, setSavedContentLoading] = useState(false);

  useEffect(() => {
    setSavedBits(user?.savedBits ?? []);
    setSavedFormulas(user?.savedFormulas ?? []);
  }, [user?.savedBits, user?.savedFormulas]);

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
          data.savedBits,
          data.savedFormulas,
          data.savedRevisionCards,
          data.savedRevisionUnits
        );
        useUserStore.getState().setSavedFromServer(
          merged.savedBits,
          merged.savedFormulas,
          merged.savedRevisionCards,
          merged.savedRevisionUnits
        );
        setSavedBits(merged.savedBits);
        setSavedFormulas(merged.savedFormulas);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  useEffect(() => {
    if (activeTab !== 'saved') return;
    const storeBits = useUserStore.getState().user?.savedBits ?? [];
    const storeFormulas = useUserStore.getState().user?.savedFormulas ?? [];
    queueMicrotask(() => setSavedContentLoading(true));
    fetchSavedContent()
      .then(
        ({
          savedBits: bits,
          savedFormulas: formulas,
          savedRevisionCards: revisionCards,
          savedRevisionUnits: revisionUnits,
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
          bits,
          formulas,
          revisionCards,
          revisionUnits
        );
        useUserStore.getState().setSavedFromServer(
          merged.savedBits,
          merged.savedFormulas,
          merged.savedRevisionCards,
          merged.savedRevisionUnits
        );
        setSavedBits(merged.savedBits);
        setSavedFormulas(merged.savedFormulas);
      })
      .catch(() => {
        setSavedBits(storeBits);
        setSavedFormulas(storeFormulas);
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

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="max-w-4xl mx-auto px-4 pt-1 pb-8">

          {/* Header + Tabs — title reflects active section (two separate “pages”) */}
          <div className="mb-5">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              {activeTab === 'instacue' ? (
                <h1 className="text-[24px] font-bold text-[#1e293b] tracking-tight">
                  <span className="text-[#f59e0b] font-extrabold">Insta</span>
                  <span className="text-[#1e293b] font-extrabold">Cue</span>
                  <span className="text-[#1e293b] font-bold"> Cards</span>
                </h1>
              ) : activeTab === 'units' ? (
                <h1 className="text-[24px] font-bold text-[#1e293b] tracking-tight">
                  <span className="text-[#1e293b] font-extrabold">Unit Revision</span>
                </h1>
              ) : (
                <h1 className="text-[24px] font-bold text-[#1e293b] tracking-tight">
                  <span className="text-[#1e293b] font-extrabold">Saved Bits & Formulas</span>
                </h1>
              )}
              <div className="inline-flex rounded-full border-2 border-border bg-muted/30 p-0.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setActiveTab('instacue')}
                  className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors inline-flex items-center gap-1.5 ${activeTab === 'instacue' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  InstaCue Cards
                  <span
                    className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] font-extrabold ${activeTab === 'instacue' ? 'bg-primary-foreground/20' : 'bg-muted'}`}
                  >
                    {savedCards.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('units')}
                  className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors inline-flex items-center gap-1.5 ${activeTab === 'units' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Unit Revision
                  <span
                    className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] font-extrabold ${activeTab === 'units' ? 'bg-primary-foreground/20' : 'bg-muted'}`}
                  >
                    {savedRevisionUnits.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('saved')}
                  className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors inline-flex items-center gap-1.5 ${activeTab === 'saved' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Saved Bits & Formulas
                  <span
                    className={`tabular-nums rounded-full px-1.5 py-0.5 text-[11px] font-extrabold ${activeTab === 'saved' ? 'bg-primary-foreground/20' : 'bg-muted'}`}
                  >
                    {savedTabBadgeCount}
                  </span>
                </button>
              </div>
            </div>
            <p className="text-[#64748b] text-[13px] mt-0.5 font-medium">
              {activeTab === 'instacue'
                ? 'Quick revision flashcards with active recall and spaced repetition'
                : activeTab === 'units'
                  ? 'Deep Dive sections you marked for revision'
                  : 'Bits and formula practice you saved from Deep Dive'}
            </p>
          </div>

          {activeTab === 'instacue' && (
            <>
              {signedIn && displayCards.length === 0 ? (
                <div className="edu-card p-10 text-center rounded-2xl border-2 border-dashed border-border">
                  <BookMarked className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">No InstaCue cards yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">
                    Add flashcards while studying from any Deep Dive (bookmark on a card) to build your revision deck.
                  </p>
                  <Button variant="outline" className="rounded-xl" asChild>
                    <Link href="/explore-1">
                      Go to Explore <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              ) : (
                <InstaCuePlayer
                  cards={displayCards}
                  onClose={() => { }}
                />
              )}

              {/* Saved Questions section below if any */}
              {savedQuestions.length > 0 && (
            <section className="mt-16">
              <h3 className="text-[13px] font-bold text-[#94a3b8] mb-4 uppercase tracking-wider">
                Saved Questions
              </h3>
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
                        onClick={() => setActiveId(q.id)}
                        className="w-full edu-card p-5 text-left"
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
            </section>
              )}
            </>
          )}

          {activeTab === 'saved' && (
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
                  <p className="text-muted-foreground font-medium">No saved Bits or formulas yet</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-4">Use the Save button (bookmark icon) on Bits or Practice Formulas in any Deep Dive section to add them here.</p>
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
                        Saved Bits
                      </h3>
                      <Accordion type="multiple" defaultValue={groupedBits.map((g) => g.label)} className="space-y-3">
                        {groupedBits.map(({ label, bits }) => (
                          <AccordionItem
                            key={label}
                            value={label}
                            className="border rounded-xl px-4 bg-card/50 border-border"
                          >
                            <AccordionTrigger className="px-0 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                              <span className="font-bold text-foreground">
                                {label}
                              </span>
                              <span className="text-sm font-medium text-muted-foreground ml-2">
                                ({bits.length} bit{bits.length !== 1 ? 's' : ''})
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
                      <Accordion type="multiple" defaultValue={groupedFormulas.map((g) => g.label)} className="space-y-3">
                        {groupedFormulas.map(({ label, formulas }) => (
                          <AccordionItem
                            key={label}
                            value={label}
                            className="border rounded-xl px-4 bg-card/50 border-border"
                          >
                            <AccordionTrigger className="px-0 py-3 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                              <span className="font-bold text-foreground">
                                {label}
                              </span>
                              <span className="text-sm font-medium text-muted-foreground ml-2">
                                ({formulas.length} question{formulas.length !== 1 ? 's' : ''})
                              </span>
                            </AccordionTrigger>
                            <AccordionContent className="px-0 pb-4">
                              <FormulaMcqCarousel formulas={formulas} onUnsave={handleUnsaveFormula} />
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

          {activeTab === 'units' && (
            <section>
              {savedRevisionUnits.length === 0 ? (
                <div className="edu-card p-10 text-center rounded-2xl border-2 border-dashed border-border">
                  <BookOpen className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground font-medium">No units marked for revision yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Use &quot;Mark for revision&quot; on any Deep Dive page to add it here.</p>
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
                      unit.level === 'basics'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-400/40 font-bold'
                        : unit.level === 'intermediate'
                          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-400/40 font-bold'
                          : 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-400/40 font-bold';
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
                            {unit.subject.charAt(0).toUpperCase() + unit.subject.slice(1)} · Class {unit.classLevel}
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
                        <p className="text-sm font-bold text-foreground line-clamp-2 flex-1" title={unit.sectionTitle}>
                          {subtopicDisplayName(unit.sectionTitle)}
                        </p>
                        <div className="flex items-center gap-2 mt-auto pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-xl flex-1 h-9 px-3"
                            asChild
                          >
                            <Link href={deepDiveHref} className="inline-flex items-center justify-center gap-1 font-bold whitespace-nowrap">
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
        {activeTab === 'instacue' && (
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

        <AddRevisionCardModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
        />

      </AppLayout>
    </ProtectedRoute>
  );
}

export default Revision;
