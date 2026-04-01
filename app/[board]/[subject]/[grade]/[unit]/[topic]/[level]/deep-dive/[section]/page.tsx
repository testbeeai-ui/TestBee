"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { getDeepDiveContent } from "@/data/deepDiveContent";
import { getTheoryOrPlaceholder } from "@/data/topicTheory";
import { resolveTopicFromParams, buildTopicPath } from "@/lib/topicRoutes";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import type { SavedRevisionUnit, SavedBit, SavedFormula, Board } from "@/types";
import { parseTheorySections } from "@/components/TheoryContentWithDeepDive";
import TheoryContent from "@/components/TheoryContent";
import WallToggleSimulation from "@/components/WallToggleSimulation";
import ParticleCollisionSandbox from "@/components/ParticleCollisionSandbox";
import ThermometerScaleSandbox from "@/components/ThermometerScaleSandbox";
import InstaCue from "@/components/InstaCue";
import SubjectChatbot from "@/components/SubjectChatbot";
import { useUserStore } from "@/store/useUserStore";
import { getInstaCueCards } from "@/data/instaCueCards";
import type { InstaCueCard } from "@/data/instaCueCards";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, BookOpen, Zap, Bookmark, ChevronLeft, ChevronRight, CheckCircle2, XCircle, Calculator, RefreshCw } from "lucide-react";
import type { BitsQuestion, PracticeFormula } from "@/data/deepDiveContent";
import { canRegenerate, generateFormulaQuestions } from "@/lib/formulaQuestionGenerators";
import PremiumFeatureDialog from "@/components/PremiumFeatureDialog";
import { syncAllSavedContent } from "@/lib/savedContentService";
import MathText from "@/components/MathText";
import { stripFormulaDelimiters } from "@/lib/stripFormulaDelimiters";
import { subtopicMathTextLabel } from "@/lib/subtopicTitles";

/** Check if a BitsQuestion matches a SavedBit (same content). */
function isBitSaved(question: BitsQuestion, savedBits: SavedBit[]): boolean {
  return savedBits.some(
    (b) =>
      b.question === question.question &&
      b.options.length === question.options.length &&
      b.options.every((o, i) => o === question.options[i]) &&
      b.correctAnswer === question.correctAnswer
  );
}

/** Return saved Bit id for this question (content match), else null. */
function getSavedBitId(question: BitsQuestion, savedBits: SavedBit[]): string | null {
  const hit = savedBits.find(
    (b) =>
      b.question === question.question &&
      b.options.length === question.options.length &&
      b.options.every((o, i) => o === question.options[i]) &&
      b.correctAnswer === question.correctAnswer
  );
  return hit?.id ?? null;
}

/** One-question-at-a-time Bits quiz (like explore Bits / second image reference). */
function BitsQuiz({
  questions,
  subject,
  topic,
  compact,
  layout,
  navigationPlacement,
  onSaveBit,
  onUnsaveBit,
  checkIsSaved,
  getSavedBitId,
  onIndexChange,
}: {
  questions: BitsQuestion[];
  subject: string;
  topic: string;
  compact?: boolean;
  layout?: "default" | "formula-modal";
  navigationPlacement?: "top" | "bottom";
  onSaveBit?: (question: BitsQuestion) => void;
  onUnsaveBit?: (bitId: string) => void;
  checkIsSaved?: (question: BitsQuestion) => boolean;
  getSavedBitId?: (question: BitsQuestion) => string | null;
  /** Called when the current question index changes (for formula save – save only current question). */
  onIndexChange?: (index: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const isFormulaLayout = layout === "formula-modal";
  const navAtBottom = navigationPlacement === "bottom";
  useEffect(() => {
    onIndexChange?.(index);
  }, [index, onIndexChange]);
  const q = questions[index]!;
  const isCurrentBitSaved = checkIsSaved?.(q) ?? false;
  const answered = selected !== null;
  const isCorrect = selected === q.correctAnswer;

  const handleSelect = (i: number) => {
    if (answered) return;
    setSelected(i);
  };

  return (
    <div className={compact ? "space-y-3 pt-1" : "space-y-4 pt-2"}>
      {!navAtBottom && (
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className={isFormulaLayout ? "rounded-full h-10 min-w-[92px] px-4 text-[17px] font-semibold text-muted-foreground disabled:opacity-100 disabled:text-muted-foreground" : "rounded-xl"}
            onClick={() => { setIndex((i) => Math.max(0, i - 1)); setSelected(null); }}
            disabled={index === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className={`${isFormulaLayout ? "text-[30px] font-extrabold text-foreground tracking-tight" : "text-sm font-bold text-muted-foreground"}`}>
            Question {index + 1} of {questions.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            className={isFormulaLayout ? "rounded-full h-10 min-w-[92px] px-4 text-[17px] font-semibold" : "rounded-xl"}
            onClick={() => { setIndex((i) => Math.min(questions.length - 1, i + 1)); setSelected(null); }}
            disabled={index === questions.length - 1}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className={`edu-chip text-xs font-bold ${isFormulaLayout ? "bg-primary/10 text-primary rounded-full px-3 py-1.5" : "bg-primary/10 text-primary"}`}>
          <Zap className="w-3.5 h-3.5 inline mr-1" />
          {subject}
        </span>
        <span className={`${isFormulaLayout ? "text-sm font-semibold text-foreground" : "text-xs font-bold text-foreground"}`}>{topic}</span>
      </div>

      <div className={`bg-card rounded-3xl border border-border shadow-sm ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <h3 className={`font-bold text-foreground leading-snug flex-1 min-w-0 ${compact ? "text-sm" : "text-base"}`}>
            {q.question}
          </h3>
          {onSaveBit && (
            <Button
              variant="ghost"
              size="icon"
              className={`shrink-0 rounded-xl h-8 w-8 ${isCurrentBitSaved ? "text-primary" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
              onClick={() => {
                if (!isCurrentBitSaved) {
                  onSaveBit(q);
                  return;
                }
                const savedId = getSavedBitId?.(q);
                if (savedId && onUnsaveBit) onUnsaveBit(savedId);
              }}
              title={isCurrentBitSaved ? "Remove saved Bit" : "Save this Bit"}
            >
              <Bookmark className={`w-4 h-4 ${isCurrentBitSaved ? "fill-current" : ""}`} />
            </Button>
          )}
        </div>
        <div className={compact ? "space-y-1.5" : "space-y-2"}>
          {q.options.map((opt, i) => {
            let optionClass = "bg-muted hover:bg-muted/80 text-foreground";
            if (answered) {
              if (i === q.correctAnswer) optionClass = "bg-emerald-500/15 border-2 border-emerald-500 text-foreground";
              else if (i === selected && !isCorrect) optionClass = "bg-destructive/15 border-2 border-destructive text-foreground";
              else optionClass = "bg-muted/50 text-muted-foreground";
            } else if (i === selected) optionClass = "bg-primary/20 border-2 border-primary text-foreground";
            return (
              <button
                key={i}
                type="button"
                disabled={answered}
                onClick={() => handleSelect(i)}
                className={`w-full text-left rounded-2xl text-sm font-medium transition-all flex items-center gap-2 ${optionClass} ${compact ? "p-2.5" : "p-3"}`}
              >
                <span className="w-6 h-6 rounded-full bg-background/60 flex items-center justify-center text-xs shrink-0 font-bold">
                  {String.fromCharCode(65 + i)}
                </span>
                {opt}
                {answered && i === q.correctAnswer && <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 ml-auto" />}
                {answered && i === selected && !isCorrect && <XCircle className="w-4 h-4 shrink-0 text-destructive ml-auto" />}
              </button>
            );
          })}
        </div>
        {answered && q.solution && (
          <div className={`rounded-xl bg-primary/5 border border-primary/20 text-sm text-muted-foreground ${compact ? "mt-2 p-2.5" : "mt-3 p-3"}`}>
            <span className="font-semibold text-foreground">Explanation: </span>
            {q.solution}
          </div>
        )}
      </div>

      {navAtBottom && (
        <div className="flex items-center justify-between gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className={isFormulaLayout ? "rounded-full h-10 min-w-[92px] px-4 text-[17px] font-semibold text-muted-foreground disabled:opacity-100 disabled:text-muted-foreground" : "rounded-xl"}
            onClick={() => { setIndex((i) => Math.max(0, i - 1)); setSelected(null); }}
            disabled={index === 0}
          >
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <span className={`${isFormulaLayout ? "text-[30px] font-extrabold text-foreground tracking-tight" : "text-sm font-bold text-muted-foreground"}`}>
            Question {index + 1} of {questions.length}
          </span>
          <Button
            variant="outline"
            size="sm"
            className={isFormulaLayout ? "rounded-full h-10 min-w-[92px] px-4 text-[17px] font-semibold" : "rounded-xl"}
            onClick={() => { setIndex((i) => Math.min(questions.length - 1, i + 1)); setSelected(null); }}
            disabled={index === questions.length - 1}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * Deep Dive uses its OWN content store — completely separate from the topic page.
 * When no Deep Dive content exists → blank main area + empty InstaCue.
 * Changes here never affect the topic overview page.
 */

export default function DeepDivePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const fromRandom = searchParams.get("mode") === "random";
  const board = params.board as string;
  const subject = params.subject as string;
  const grade = params.grade as string;
  const unitSlug = params.unit as string;
  const topicSlug = params.topic as string;
  const level = params.level as string;
  const sectionParam = params.section as string;
  const sectionIndex = parseInt(sectionParam ?? "0", 10);

  const { taxonomy, loading: taxonomyLoading, error: taxonomyError } = useTopicTaxonomy();

  const resolved = useMemo(
    () => resolveTopicFromParams(board, subject, grade, unitSlug, topicSlug, level, taxonomy),
    [board, subject, grade, unitSlug, topicSlug, level, taxonomy]
  );

  const user = useUserStore((s) => s.user);
  const savedBits = user?.savedBits ?? [];
  const savedFormulas = user?.savedFormulas ?? [];
  const saveRevisionCard = useUserStore((s) => s.saveRevisionCard);
  const saveRevisionUnit = useUserStore((s) => s.saveRevisionUnit);
  const unsaveRevisionUnit = useUserStore((s) => s.unsaveRevisionUnit);
  const saveBit = useUserStore((s) => s.saveBit);
  const unsaveBit = useUserStore((s) => s.unsaveBit);
  const saveFormula = useUserStore((s) => s.saveFormula);
  const unsaveFormula = useUserStore((s) => s.unsaveFormula);
  const savedCards = user?.savedRevisionCards ?? [];
  const savedRevisionUnits = user?.savedRevisionUnits ?? [];
  const [bitsDialogOpen, setBitsDialogOpen] = useState(false);
  const [formulaDialogOpen, setFormulaDialogOpen] = useState(false);
  const [selectedFormula, setSelectedFormula] = useState<PracticeFormula | null>(null);
  const [formulaPracticeQuestions, setFormulaPracticeQuestions] = useState<BitsQuestion[] | null>(null);
  const [formulaQuizKey, setFormulaQuizKey] = useState(0);
  const [bitsSaveDialogOpen, setBitsSaveDialogOpen] = useState(false);
  const [pendingBit, setPendingBit] = useState<BitsQuestion | null>(null);
  const [pendingBitFormulaContext, setPendingBitFormulaContext] = useState<{ name: string; formulaLatex?: string } | null>(null);
  const [formulaSaveDialogOpen, setFormulaSaveDialogOpen] = useState(false);
  const [formulaRegenDialogOpen, setFormulaRegenDialogOpen] = useState(false);
  const [formulaCurrentIndex, setFormulaCurrentIndex] = useState(0);
  const levelLabel = level === "intermediate" ? "Intermediate" : level === "advanced" ? "Advanced" : "Basic";

  const { deepDiveContent, sectionTitle, instaCueCards, topicHref, topicNode, subtopicName } = useMemo(() => {
    if (!resolved) return { deepDiveContent: null, sectionTitle: "Deep Dive", instaCueCards: [] as InstaCueCard[], topicHref: "/explore-1", topicNode: null, subtopicName: "" };
    const { topicNode: node, subtopicName: stName, level: diffLevel } = resolved;
    const diffLevelStr = diffLevel as "basics" | "intermediate" | "advanced";
    const dd = getDeepDiveContent(node.subject, node.classLevel, node.topic, stName, sectionIndex, diffLevelStr);
    const theoryData = getTheoryOrPlaceholder(
      node.subject,
      node.classLevel,
      node.topic,
      stName,
      diffLevel as "basics" | "intermediate" | "advanced"
    );
    const parsed = parseTheorySections(theoryData.theory);
    const fallbackTitle = parsed.sections[sectionIndex]?.title ?? `Section ${sectionIndex + 1}`;
    const href = buildTopicPath(
      board,
      node.subject,
      node.classLevel,
      node.topic,
      stName,
      diffLevel,
      fromRandom ? "random" : undefined
    );
    const baseCards = getInstaCueCards(node.subject, node.classLevel, node.topic, [stName], sectionIndex, diffLevelStr);
    const userCards = savedCards
      .filter(
        (c) => {
          const typedCard = c as Partial<InstaCueCard>;
          return (
            c.topic === node.topic &&
            c.subtopicName === stName &&
            c.subject === node.subject &&
            c.classLevel === node.classLevel &&
            typedCard.sectionIndex === sectionIndex &&
            typedCard.level === diffLevelStr
          );
        }
      )
      .map((c) => ({ ...c })) as InstaCueCard[];
    const instaCueCards = [...baseCards, ...userCards];
    return {
      deepDiveContent: dd,
      sectionTitle: dd?.title ?? fallbackTitle,
      instaCueCards,
      topicHref: href,
      topicNode: node,
      subtopicName: stName,
    };
  }, [resolved, sectionIndex, board, savedCards, fromRandom]);

  const savedFormulaIdForCurrentQuestion = useMemo(() => {
    if (!selectedFormula || !topicNode) return null;
    const allQuestions = formulaPracticeQuestions ?? selectedFormula.bitsQuestions;
    if (allQuestions.length === 0) return null;
    const idx = Math.max(0, Math.min(formulaCurrentIndex, allQuestions.length - 1));
    const currentQuestion = allQuestions[idx];
    if (!currentQuestion) return null;

    const hit = savedFormulas.find((f) => {
      if (
        f.name !== selectedFormula.name ||
        f.subject !== topicNode.subject ||
        f.topic !== topicNode.topic ||
        f.subtopicName !== subtopicName ||
        f.classLevel !== topicNode.classLevel ||
        f.level !== level ||
        f.sectionIndex !== sectionIndex
      ) {
        return false;
      }
      const savedQ = f.bitsQuestions?.[0];
      return (
        !!savedQ &&
        savedQ.question === currentQuestion.question &&
        savedQ.correctAnswer === currentQuestion.correctAnswer &&
        savedQ.options.length === currentQuestion.options.length &&
        savedQ.options.every((o, i) => o === currentQuestion.options[i])
      );
    });

    return hit?.id ?? null;
  }, [
    selectedFormula,
    topicNode,
    formulaPracticeQuestions,
    formulaCurrentIndex,
    savedFormulas,
    subtopicName,
    level,
    sectionIndex,
  ]);

  const revisionUnitId = useMemo(
    () =>
      topicNode
        ? `rev-unit-${board}-${subject}-${topicNode.classLevel}-${unitSlug}-${topicSlug}-${level}-${sectionIndex}`
        : "",
    [board, subject, topicNode, unitSlug, topicSlug, level, sectionIndex]
  );
  const isSavedForRevision = savedRevisionUnits.some((u) => u.id === revisionUnitId);

  const handleToggleRevision = () => {
    if (!topicNode) return;
    if (isSavedForRevision) {
      unsaveRevisionUnit(revisionUnitId);
    } else {
      const unit: SavedRevisionUnit = {
        id: revisionUnitId,
        board: (board === "icse" ? "ICSE" : "CBSE") as Board,
        subject: topicNode.subject,
        classLevel: topicNode.classLevel,
        unitName: topicNode.topic,
        subtopicName,
        level: level as "basics" | "intermediate" | "advanced",
        sectionIndex,
        sectionTitle,
      };
      saveRevisionUnit(unit);
    }
  };

  if (taxonomyLoading) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-16 px-4 text-center">
          <p className="text-muted-foreground font-semibold">Loading deep dive…</p>
        </div>
      </AppLayout>
    );
  }

  if (!resolved || !topicNode) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-16 px-4 text-center">
          <h1 className="text-xl font-bold text-foreground mb-2">Topic not found</h1>
          <p className="text-muted-foreground mb-6">
            {taxonomyError ??
              "This topic or unit may not exist, or your syllabus has not loaded. Check the URL or go back to Explore."}
          </p>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href="/explore-1">Back to Explore</Link>
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href={topicHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border-2 border-primary/30 text-primary hover:bg-primary/10 transition-colors -ml-1"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" /> Back to topic
          </Link>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-sm font-bold text-primary">
            <Zap className="w-4 h-4" />
            {topicNode.subject.charAt(0).toUpperCase() + topicNode.subject.slice(1)}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-muted text-sm font-bold text-muted-foreground">
            Class {topicNode.classLevel}
          </span>
          <Button
            variant={isSavedForRevision ? "secondary" : "outline"}
            size="sm"
            onClick={handleToggleRevision}
            className="rounded-full font-bold border-primary/30 text-primary hover:bg-primary/10 ml-auto"
          >
            <Bookmark
              className={`w-4 h-4 mr-1.5 shrink-0 ${isSavedForRevision ? "fill-current" : ""}`}
            />
            {isSavedForRevision ? "Saved for revision" : "Mark for revision"}
          </Button>
        </div>

        <h2 className="font-extrabold text-xl text-foreground mb-2 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          {sectionTitle}
        </h2>
        <p className="text-sm text-muted-foreground mb-6 min-w-0 overflow-hidden">
          <MathText as="span" weight="semibold" className="font-semibold text-foreground">
            {subtopicMathTextLabel(subtopicName)}
          </MathText>
        </p>

        <div className="flex flex-col lg:flex-row gap-6">
          <main className="flex-1 min-w-0 space-y-4">
            <div className="edu-card p-6 rounded-2xl border-2 border-primary/30 ring-2 ring-primary/20 shadow-lg">
              {deepDiveContent?.content ? (
                <TheoryContent theory={deepDiveContent.content} />
              ) : (
                <div className="min-h-[200px]" />
              )}
            </div>
            {deepDiveContent?.playableElements?.includes("wall-toggle") && <WallToggleSimulation />}
            {deepDiveContent?.playableElements?.includes("particle-sandbox") && <ParticleCollisionSandbox />}
            {deepDiveContent?.playableElements?.includes("thermometer-sandbox") && <ThermometerScaleSandbox />}
          </main>

          <aside className="w-full lg:w-80 xl:w-96 shrink-0">
            <div className="lg:sticky lg:top-24">
              <InstaCue
              cards={instaCueCards}
              topicName={topicNode.topic}
              subtopicName={subtopicName}
              level={level as "basics" | "intermediate" | "advanced"}
              subject={topicNode.subject}
              classLevel={topicNode.classLevel}
              onAddCard={
                user
                  ? (card) => {
                      const id = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                      saveRevisionCard({
                        ...card,
                        id,
                        sectionIndex,
                        board: (board === "icse" ? "ICSE" : "CBSE") as Board,
                      } as Parameters<typeof saveRevisionCard>[0]);
                      syncAllSavedContent().catch(() => {});
                    }
                  : undefined
              }
            />
              <section className="mt-4 edu-card rounded-2xl p-4 border border-border">
                <p className="text-sm font-medium text-foreground mb-2">
                  Want to recall what you&apos;ve read?
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-xl gap-2 font-bold border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => setBitsDialogOpen(true)}
                >
                  <Zap className="w-4 h-4" />
                  Bits
                </Button>
                <>
                  <p className="text-sm font-medium text-foreground mt-3 mb-2">
                    Want to practice formulas?
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-xl gap-2 font-bold border-primary/40 text-primary hover:bg-primary/10"
                    onClick={() => {
                      setSelectedFormula(null);
                      setFormulaDialogOpen(true);
                    }}
                  >
                    <Calculator className="w-4 h-4" />
                    Practice Formulas
                  </Button>
                </>
              </section>
            </div>
          </aside>
        </div>

        <Dialog open={bitsDialogOpen} onOpenChange={setBitsDialogOpen}>
          <DialogContent className="rounded-2xl max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Zap className="w-5 h-5 text-primary shrink-0" />
                <span>Bits — Subtopic {sectionIndex + 1}: </span>
                <MathText as="span" className="min-w-0">{subtopicMathTextLabel(subtopicName)}</MathText>
                <span> (Level: {levelLabel})</span>
              </DialogTitle>
            </DialogHeader>
            {deepDiveContent?.bitsQuestions && deepDiveContent.bitsQuestions.length > 0 ? (
              <BitsQuiz
                questions={deepDiveContent.bitsQuestions}
                subject={topicNode.subject.charAt(0).toUpperCase() + topicNode.subject.slice(1)}
                topic={topicNode.topic}
                onSaveBit={(q) => {
                  setPendingBit(q);
                  setBitsSaveDialogOpen(true);
                }}
                onUnsaveBit={(bitId) => {
                  unsaveBit(bitId);
                  syncAllSavedContent().catch(() => {});
                }}
                checkIsSaved={(q) => isBitSaved(q, savedBits)}
                getSavedBitId={(q) => getSavedBitId(q, savedBits)}
              />
            ) : deepDiveContent?.bits ? (
              <div className="pt-2">
                <TheoryContent theory={deepDiveContent.bits} />
              </div>
            ) : (
              <div className="pt-2 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <Button variant="outline" size="sm" className="rounded-xl" disabled>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                  </Button>
                  <span className="text-sm font-bold text-muted-foreground">Question 0 of 0</span>
                  <Button variant="outline" size="sm" className="rounded-xl" disabled>
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
                <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                  <p className="text-sm font-semibold text-foreground">No bits added yet</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Future bits for this subtopic and level will appear here and connect directly to Supabase.
                  </p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <PremiumFeatureDialog
          open={bitsSaveDialogOpen}
          onOpenChange={(open) => {
            setBitsSaveDialogOpen(open);
            if (!open) {
              setPendingBit(null);
              setPendingBitFormulaContext(null);
            }
          }}
          actionLabel="Save Bit"
          onConfirm={() => {
            if (!pendingBit || !topicNode) return;
            const bit: SavedBit = {
              id: `bit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              question: pendingBit.question,
              options: pendingBit.options,
              correctAnswer: pendingBit.correctAnswer,
              solution: pendingBit.solution,
              subject: topicNode.subject,
              topic: topicNode.topic,
              subtopicName,
              classLevel: topicNode.classLevel,
              unitName: topicNode.topic,
              level,
              board: (board === "icse" ? "ICSE" : "CBSE") as Board,
              sectionIndex,
              ...(pendingBitFormulaContext && {
                formulaName: pendingBitFormulaContext.name,
                formulaLatex: pendingBitFormulaContext.formulaLatex,
              }),
            };
            saveBit(bit);
            setPendingBit(null);
            setPendingBitFormulaContext(null);
            syncAllSavedContent().catch(() => {});
          }}
        />

        <PremiumFeatureDialog
          open={formulaSaveDialogOpen}
          onOpenChange={setFormulaSaveDialogOpen}
          actionLabel="Save current question"
          onConfirm={() => {
            if (!selectedFormula || !topicNode) return;
            const allQuestions = formulaPracticeQuestions ?? selectedFormula.bitsQuestions;
            const idx = Math.max(0, Math.min(formulaCurrentIndex, allQuestions.length - 1));
            const currentQuestion = allQuestions[idx]!;
            const formula: SavedFormula = {
              id: `formula-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: selectedFormula.name,
              formulaLatex: selectedFormula.formulaLatex,
              description: selectedFormula.description,
              bitsQuestions: [{
                question: currentQuestion.question,
                options: currentQuestion.options,
                correctAnswer: currentQuestion.correctAnswer,
                solution: currentQuestion.solution,
              }],
              subject: topicNode.subject,
              topic: topicNode.topic,
              subtopicName,
              classLevel: topicNode.classLevel,
              unitName: topicNode.topic,
              level,
              board: (board === "icse" ? "ICSE" : "CBSE") as Board,
              sectionIndex,
            };
            saveFormula(formula);
            syncAllSavedContent().catch(() => {});
          }}
        />

        <PremiumFeatureDialog
          open={formulaRegenDialogOpen}
          onOpenChange={setFormulaRegenDialogOpen}
          actionLabel="Regenerate"
          onConfirm={() => {
            if (!selectedFormula) return;
            const next = generateFormulaQuestions(selectedFormula.name, selectedFormula.bitsQuestions);
            if (next.length > 0) {
              setFormulaPracticeQuestions(next);
              setFormulaQuizKey((k) => k + 1);
              setFormulaCurrentIndex(0);
            }
          }}
        />

        <Dialog
          open={formulaDialogOpen}
          onOpenChange={(open) => {
            setFormulaDialogOpen(open);
            if (!open) {
              setSelectedFormula(null);
              setFormulaPracticeQuestions(null);
              setFormulaSaveDialogOpen(false);
              setFormulaRegenDialogOpen(false);
            }
          }}
        >
          <DialogContent className="rounded-2xl max-w-2xl h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
            <DialogHeader className="shrink-0 px-6 pt-5 pb-2">
              <DialogTitle className="flex items-center gap-2 text-lg">
                <Calculator className="w-5 h-5 text-primary shrink-0" />
                {selectedFormula ? selectedFormula.name : "Which formula do you want to practice?"}
              </DialogTitle>
            </DialogHeader>
            {selectedFormula ? (
              <div className="flex flex-col flex-1 min-h-0">
                <div className="shrink-0 px-6 pt-3 pb-2 space-y-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-xl gap-1.5 -ml-1 text-muted-foreground hover:text-foreground h-8 px-2 justify-start w-fit font-semibold"
                    onClick={() => {
                      setSelectedFormula(null);
                      setFormulaPracticeQuestions(null);
                    }}
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Formulas
                  </Button>
                  {selectedFormula.description && (
                    <p className="text-base text-muted-foreground leading-relaxed [&_.katex]:text-[1em]">
                      <MathText>{selectedFormula.description}</MathText>
                    </p>
                  )}
                  {selectedFormula.formulaLatex && (
                    <div className="text-foreground bg-muted/50 rounded-2xl px-6 py-5 overflow-x-auto math-text-katex-heavy [&_.katex]:text-[clamp(1rem,3.5vw,1.5rem)]">
                      <MathText weight="bold">{`$$${stripFormulaDelimiters(selectedFormula.formulaLatex)}$$`}</MathText>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
                  <BitsQuiz
                    key={formulaQuizKey}
                    questions={formulaPracticeQuestions ?? selectedFormula.bitsQuestions}
                    subject={topicNode.subject.charAt(0).toUpperCase() + topicNode.subject.slice(1)}
                    topic={topicNode.topic}
                    compact
                    layout="formula-modal"
                    navigationPlacement="bottom"
                    onSaveBit={(q) => {
                      setPendingBit(q);
                      setPendingBitFormulaContext(selectedFormula ? { name: selectedFormula.name, formulaLatex: selectedFormula.formulaLatex } : null);
                      setBitsSaveDialogOpen(true);
                    }}
                    onUnsaveBit={(bitId) => {
                      unsaveBit(bitId);
                      syncAllSavedContent().catch(() => {});
                    }}
                    checkIsSaved={(q) => isBitSaved(q, savedBits)}
                    getSavedBitId={(q) => getSavedBitId(q, savedBits)}
                    onIndexChange={setFormulaCurrentIndex}
                  />
                </div>
                <div className="shrink-0 px-6 pb-5 pt-2 flex flex-col gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-2xl gap-2 font-semibold border-primary/40 text-primary hover:bg-primary/10 h-11 text-[25px]"
                    onClick={() => {
                      if (savedFormulaIdForCurrentQuestion) {
                        unsaveFormula(savedFormulaIdForCurrentQuestion);
                        syncAllSavedContent().catch(() => {});
                        return;
                      }
                      setFormulaSaveDialogOpen(true);
                    }}
                  >
                    <Bookmark className="w-4 h-4" />
                    {savedFormulaIdForCurrentQuestion ? "Remove saved question" : "Save current question"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-2xl gap-2 font-semibold border-primary/40 text-primary hover:bg-primary/10 h-11 text-[25px]"
                    onClick={() => setFormulaRegenDialogOpen(true)}
                  >
                    <RefreshCw className="w-4 h-4" />
                    Regenerate
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6">
                {(deepDiveContent?.practiceFormulas?.length ?? 0) > 0 ? (
                  <div className="grid gap-2">
                    {(deepDiveContent?.practiceFormulas ?? []).map((formula, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => {
                          setSelectedFormula(formula);
                          setFormulaCurrentIndex(0);
                        }}
                        className="text-left p-4 rounded-xl border-2 border-border hover:border-primary/40 hover:bg-primary/5 transition-all"
                      >
                        <span className="font-bold text-foreground">{formula.name}</span>
                        {formula.description && (
                          <p className="text-sm text-muted-foreground mt-1 [&_.katex]:text-[0.95em]">
                            <MathText>{formula.description}</MathText>
                          </p>
                        )}
                        {formula.formulaLatex && (
                          <div className="mt-2 text-primary overflow-x-auto [&_.katex]:text-[1em]">
                            <MathText>{`$$${stripFormulaDelimiters(formula.formulaLatex)}$$`}</MathText>
                          </div>
                        )}
                        <span className="text-xs text-muted-foreground mt-2 block">
                          {formula.bitsQuestions.length} question{formula.bitsQuestions.length !== 1 ? "s" : ""}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-border p-6 text-center">
                    <p className="text-sm font-semibold text-foreground">No practice formulas added yet</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Future formulas for this subtopic and level will appear here and connect directly to Supabase.
                    </p>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Subject AI Chatbot – available on every deep-dive page */}
        <SubjectChatbot
          subject={topicNode.subject}
          topic={topicNode.topic}
          subtopic={subtopicName}
        />
      </div>
    </AppLayout>
  );
}
