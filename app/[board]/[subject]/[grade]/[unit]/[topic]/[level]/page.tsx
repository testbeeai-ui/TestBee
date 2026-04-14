"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import AppLayout from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { getTheoryOrPlaceholder, getTopicOverviewOrPlaceholder } from "@/data/topicTheory";
import TheoryContent from "@/components/TheoryContent";
import TopicAgentTracePanel from "@/components/TopicAgentTracePanel";
import {
  TheoryPanelSkeleton,
} from "@/components/SubtopicLessonSkeletons";
import {
  resolveTopicFromParams,
  buildTopicPath,
  buildTopicOverviewPath,
  getSiblingTopics,
  appendQueryParams,
} from "@/lib/topicRoutes";
import {
  humanReadableSubtopicTitle,
  prettifySubtopicTitle,
  subtopicDeepDiveHeadingMarkdown,
  subtopicMathTextLabel,
  subtopicNavPreviewPlain,
} from "@/lib/subtopicTitles";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import type { DifficultyLevel } from "@/lib/slugs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ArrowLeft, BookOpen, Zap, ChevronLeft, ChevronRight, Shuffle, Video, FileText, ExternalLink, Lightbulb, Sparkles, CheckCircle2, Loader2, RefreshCw, ListChecks, Play, Pause, RotateCcw, Bookmark } from "lucide-react";
import type { DeepDiveReference } from "@/data/deepDiveContent";
import MathText from "@/components/MathText";
import { stripFormulaDelimiters } from "@/lib/stripFormulaDelimiters";
import SubjectChatbot from "@/components/SubjectChatbot";
import InstaCue from "@/components/InstaCue";
import { getInstaCueCards, type InstaCueCard } from "@/data/instaCueCards";
import { useUserStore } from "@/store/useUserStore";
import type { Board, Subject, SavedBit, SavedFormula, SavedRevisionUnit } from "@/types";
import { syncAllSavedContent } from "@/lib/savedContentService";
import {
  fetchSubtopicContent,
  upsertSubtopicContent,
  generateSubtopicContent,
  generateInstaCueCards,
  generateBitsQuestions,
  generateFormulaPractice,
  saveFormulaPractice,
  type ArtifactInstaCueCard,
  type ArtifactBitsQuestion,
  type ArtifactFormula,
} from "@/lib/subtopicContentService";
import { fetchMagicWallBasket, type MagicWallBasketItem, makeTopicKey } from "@/lib/magicWallBasketService";
import { assessSubtopicRow } from "@/lib/subtopicCompleteness";
import { canRegenerate, generateFormulaQuestions, getFallbackPracticeFormulas } from "@/lib/formulaQuestionGenerators";
import {
  fetchTopicContent,
  generateTopicContent,
  upsertTopicContent,
  postCompleteSubtopic,
  fetchTopicHubThreeLevelGate,
  type TopicAgentTrace,
  type TopicSubtopicPreview,
} from "@/lib/topicContentService";
import {
  MIN_BITS_QUESTIONS,
  MIN_INSTACUE_CARDS,
  subtopicTheoryIsPlaceholder,
} from "@/lib/subtopicCompleteness";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fuzzySubtopicKey } from "@/lib/utils";
import { fetchBitsAttempt, saveBitsAttempt, type BitsAttemptRecord } from "@/lib/bitsAttemptService";
import {
  fetchSubtopicEngagement,
  saveSubtopicEngagement,
  type SubtopicEngagementScope,
  type SubtopicEngagementSnapshot,
} from "@/lib/subtopicEngagementService";
import SubtopicWheelDialog from "@/components/SubtopicWheelDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SUBTOPIC_STACK_PREVIEW_CHARS = 420;

/**
 * Manual “AI artifacts” pipeline (InstaCue → Bits → Formulas) lives in `runAiArtifactPipeline` below.
 * Tune these delays to space out Vertex/Gemini calls and reduce ECONNRESET / rate limits.
 */
const ARTIFACT_PIPELINE_BETWEEN_STEPS_MS = 15_000;
/** After subtopic/deep-dive save, brief pause so generate-* APIs read committed theory from DB. */
const ARTIFACT_PIPELINE_AFTER_DEEP_DIVE_SETTLE_MS = 1_200;
const ARTIFACT_STEP_MAX_ATTEMPTS = 3;
const ARTIFACT_STEP_RETRY_DELAY_MS = 3_000;

function truncateForStack(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.lastIndexOf(" ", max);
  return (cut > max * 0.5 ? text.slice(0, cut) : text.slice(0, max)).trim() + "…";
}

/**
 * Keep model content intact but present it cleanly in preview cards.
 * This is display-only formatting for readability.
 */
function formatSubtopicPreviewText(raw: string): string {
  let s = String(raw ?? "").replace(/\r\n/g, "\n").trim();
  if (!s) return "";

  const alreadyStructured =
    /(^|\n)\s*(#{1,6}\s|[-*]\s|\d+\.\s|>)/m.test(s) || s.includes("\n\n");
  if (alreadyStructured) return s;

  // Promote common inline labels to their own lines.
  s = s
    .replace(/\s+(Exam\s*Trap:)/gi, "\n\n$1")
    .replace(/\s+(Key\s*Idea[s]?:)/gi, "\n\n$1")
    .replace(/\s+(Curie[- ]Weiss\s*Law:)/gi, "\n\n$1")
    .replace(/\s+(Where\s+[A-Za-z]\s+is\b)/g, "\n\n$1");

  // Sentence-wise paragraphing for compact AI output.
  s = s.replace(/([.?!])\s+(?=[A-Z(\\])/g, "$1\n\n");
  s = s.trim();

  // Convert simple paragraph blocks into bullet points for cleaner scanability.
  const blocks = s
    .split(/\n{2,}/)
    .map((b) => b.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (blocks.length <= 1) return s;

  return blocks.map((b) => `- ${b}`).join("\n");
}

function delay(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function runArtifactStepWithRetries<T>(
  stepLabel: string,
  fn: () => Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  let last = "";
  for (let attempt = 1; attempt <= ARTIFACT_STEP_MAX_ATTEMPTS; attempt++) {
    try {
      const value = await fn();
      return { ok: true, value };
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
      if (attempt < ARTIFACT_STEP_MAX_ATTEMPTS) {
        await delay(ARTIFACT_STEP_RETRY_DELAY_MS);
      }
    }
  }
  return {
    ok: false,
    error: last ? `${stepLabel}: ${last}` : `${stepLabel} failed`,
  };
}

function shouldUseTwoColumnOptions(options: string[]): boolean {
  // Use 2x2 only for short, plain-text options.
  // Math-heavy options (LaTeX/chemical equations/symbol-dense strings) stay single-column
  // to avoid overflow/overlap.
  return options.every((opt) => {
    const text = opt.trim();
    if (!text || text.length > 44 || text.includes("\n")) return false;
    if (/[\\$^_{}]|->|→|⇌|<=|>=|=|\+|\/|\d[A-Za-z]|[A-Za-z]\d/.test(text)) return false;
    return true;
  });
}

function getCorrectOptionIndex(question: ArtifactBitsQuestion): number {
  const idx = question.options.findIndex((o) => o === question.correctAnswer);
  return idx >= 0 ? idx : 0;
}

function isBitSaved(question: ArtifactBitsQuestion, savedBits: SavedBit[]): boolean {
  const correctIdx = getCorrectOptionIndex(question);
  return savedBits.some(
    (b) =>
      b.question === question.question &&
      b.options.length === question.options.length &&
      b.options.every((o, i) => o === question.options[i]) &&
      b.correctAnswer === correctIdx
  );
}

function getSavedBitId(question: ArtifactBitsQuestion, savedBits: SavedBit[]): string | null {
  const correctIdx = getCorrectOptionIndex(question);
  const hit = savedBits.find(
    (b) =>
      b.question === question.question &&
      b.options.length === question.options.length &&
      b.options.every((o, i) => o === question.options[i]) &&
      b.correctAnswer === correctIdx
  );
  return hit?.id ?? null;
}

function getBitsSignature(items: ArtifactBitsQuestion[]): string {
  const raw = items
    .map((q, idx) => `${idx + 1}|${q.question}|${q.correctAnswer}|${q.options.join("||")}`)
    .join("###");
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = (hash * 31 + raw.charCodeAt(i)) | 0;
  }
  return `v1-${items.length}-${Math.abs(hash)}`;
}

function subtopicNavPreviewLine(raw: string): string {
  return subtopicNavPreviewPlain(raw);
}

function shuffleWithCorrectOption(options: string[], correctAnswer: string): { options: string[]; correctAnswer: string } {
  const indexed = options.map((opt, idx) => ({ opt, idx }));
  indexed.sort(() => Math.random() - 0.5);
  const shuffled = indexed.map((x) => x.opt);
  const correctIdx = options.findIndex((x) => x === correctAnswer);
  const nextCorrect =
    correctIdx >= 0
      ? shuffled[indexed.findIndex((x) => x.idx === correctIdx)]
      : shuffled[0] ?? "";
  return { options: shuffled, correctAnswer: nextCorrect };
}

function mutateNumbersLite(input: string): string {
  return String(input ?? "").replace(/\b-?\d+\b/g, (m) => {
    if (Math.random() > 0.35) return m;
    const n = Number(m);
    if (!Number.isFinite(n)) return m;
    const delta = Math.floor(Math.random() * 5) - 2;
    if (delta === 0) return m;
    return String(Math.trunc(n + delta));
  });
}

function ensureMinimumFormulaBits(
  current: ArtifactBitsQuestion[],
  seed: ArtifactBitsQuestion[],
  min = 5
): ArtifactBitsQuestion[] {
  const out = [...current];
  if (seed.length === 0) return out;
  let i = 0;
  while (out.length < min) {
    const src = seed[i % seed.length]!;
    const tweakedOptions = src.options.map((o) => mutateNumbersLite(o));
    const correctIdx = Math.max(0, src.options.findIndex((o) => o === src.correctAnswer));
    const corrected = tweakedOptions[correctIdx] ?? tweakedOptions[0] ?? src.correctAnswer;
    const shuffled = shuffleWithCorrectOption(tweakedOptions, corrected);
    out.push({
      question: mutateNumbersLite(src.question),
      options: shuffled.options,
      correctAnswer: shuffled.correctAnswer,
      solution: mutateNumbersLite(src.solution ?? ""),
    });
    i += 1;
  }
  return out;
}

function regenerateFormulaBitsAlgorithmic(
  formulaName: string,
  base: ArtifactBitsQuestion[]
): ArtifactBitsQuestion[] {
  if (base.length === 0) return [];
  if (canRegenerate(formulaName)) {
    const converted = base.map((q) => {
      const idx = Math.max(0, q.options.findIndex((o) => o === q.correctAnswer));
      return {
        question: q.question,
        options: q.options,
        correctAnswer: idx,
        solution: q.solution,
      };
    });
    const generated = generateFormulaQuestions(formulaName, converted);
    if (generated.length > 0) {
      const mapped = generated.map((g) => {
        const ci = Math.max(0, Math.min(g.correctAnswer, g.options.length - 1));
        return {
          question: g.question,
          options: g.options,
          correctAnswer: g.options[ci] ?? g.options[0] ?? "",
          solution: g.solution ?? "",
        };
      });
      return ensureMinimumFormulaBits(mapped, mapped, 5);
    }
  }
  const mutated = base.map((q) => {
    const mutatedQuestion = mutateNumbersLite(q.question);
    const mutatedOptions = q.options.map((o) => mutateNumbersLite(o));
    const correctIdx = Math.max(0, q.options.findIndex((o) => o === q.correctAnswer));
    const corrected = mutatedOptions[correctIdx] ?? mutatedOptions[0] ?? q.correctAnswer;
    const shuffled = shuffleWithCorrectOption(mutatedOptions, corrected);
    return {
      question: mutatedQuestion,
      options: shuffled.options,
      correctAnswer: shuffled.correctAnswer,
      solution: mutateNumbersLite(q.solution ?? ""),
    };
  });
  return ensureMinimumFormulaBits(mutated, base, 5);
}

const LEVELS: { value: DifficultyLevel; label: string }[] = [
  { value: "basics", label: "Basic" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

/** Subtopic focus timer: 10 minutes */
const FOCUS_TIMER_INITIAL_SECONDS = 600;

const TOPIC_PROGRESS_CHECKLIST = [
  {
    number: 1,
    text: "Spend atleast 10 minutes on this sub topic",
    borderClass: "border-violet-500/45",
    badgeClass: "bg-violet-500/20 text-violet-200 border-violet-400/60",
    glowClass: "shadow-[0_0_0_1px_rgba(139,92,246,0.3)]",
  },
  {
    number: 2,
    text: "Answer all questions in the Quiz even if it's wrong",
    borderClass: "border-cyan-500/45",
    badgeClass: "bg-cyan-500/20 text-cyan-200 border-cyan-400/60",
    glowClass: "shadow-[0_0_0_1px_rgba(6,182,212,0.3)]",
  },
  {
    number: 3,
    text: "Scroll and see all Insta Que cards",
    borderClass: "border-emerald-500/45",
    badgeClass: "bg-emerald-500/20 text-emerald-200 border-emerald-400/60",
    glowClass: "shadow-[0_0_0_1px_rgba(16,185,129,0.3)]",
  },
  {
    number: 4,
    text: "Click all formulae and practice the numerals",
    borderClass: "border-amber-500/45",
    badgeClass: "bg-amber-500/20 text-amber-200 border-amber-400/60",
    glowClass: "shadow-[0_0_0_1px_rgba(245,158,11,0.3)]",
  },
  {
    number: 5,
    text: "Revise all concepts and show concepts pages",
    borderClass: "border-rose-500/45",
    badgeClass: "bg-rose-500/20 text-rose-200 border-rose-400/60",
    glowClass: "shadow-[0_0_0_1px_rgba(225,29,72,0.3)]",
  },
] as const;

function formatFocusTimer(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = (safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function TopicPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isRandomMode = searchParams.get("mode") === "random";
  const isMagicWallSource = searchParams.get("source") === "magic-wall";
  const mode = isRandomMode ? "random" : "linear";

  const board = params.board as string;
  const subject = params.subject as string;
  const grade = params.grade as string;
  const unitSlug = params.unit as string;
  const topicSlug = params.topic as string;
  const level = params.level as string;

  const [magicWallBasket, setMagicWallBasket] = useState<MagicWallBasketItem[]>([]);
  const [loadingMagicWallBasket, setLoadingMagicWallBasket] = useState(false);
  const [magicWallQueueOpen, setMagicWallQueueOpen] = useState(false);
  const [progressQueueOpen, setProgressQueueOpen] = useState(false);
  const [focusTimerSeconds, setFocusTimerSeconds] = useState(FOCUS_TIMER_INITIAL_SECONDS);
  const [focusTimerRunning, setFocusTimerRunning] = useState(false);
  const [bitsVisitedIndices, setBitsVisitedIndices] = useState<Set<number>>(new Set());
  const [instaCueValidatedIndices, setInstaCueValidatedIndices] = useState<Set<number>>(new Set());
  /** Cards the learner has landed on in the carousel (scroll / dots), not only flipped. */
  const [instaCueNavIndices, setInstaCueNavIndices] = useState<Set<number>>(new Set());
  /** Per-formula numerals draft in the formulas dialog (key = formula index). */
  const [formulaByIdx, setFormulaByIdx] = useState<Record<number, { qIdx: number; answers: Record<number, number> }>>({});
  const engagementHydratedRef = useRef<string | null>(null);
  const engagementSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isMagicWallSource) return;
    let cancelled = false;
    setLoadingMagicWallBasket(true);
    fetchMagicWallBasket()
      .then((items) => {
        if (!cancelled) setMagicWallBasket(items);
      })
      .catch((err) => {
        console.error("Failed to load magic wall basket:", err);
      })
      .finally(() => {
        if (!cancelled) setLoadingMagicWallBasket(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isMagicWallSource]);

  const { taxonomy, loading: taxonomyLoading, error: taxonomyError } = useTopicTaxonomy();

  const resolved = useMemo(
    () =>
      resolveTopicFromParams(board, subject, grade, unitSlug, topicSlug, level, taxonomy),
    [board, subject, grade, unitSlug, topicSlug, level, taxonomy]
  );

  const topicNode = resolved?.topicNode ?? null;
  
  const currentTopicKey = useMemo(() => {
    if (!topicNode) return "";
    return makeTopicKey({
      board: board as Board,
      subject: topicNode.subject,
      classLevel: topicNode.classLevel,
      unitName: topicNode.unitTitle ?? topicNode.unitLabel ?? "Unit",
      chapterTitle: topicNode.chapterTitle ?? topicNode.topic,
      topicName: topicNode.topic,
    });
  }, [board, topicNode]);

  const topicLevelSiblings = useMemo(() => {
    if (!topicNode) return { prev: null, next: null } as const;
    if (isMagicWallSource && magicWallBasket.length > 0) {
      const idx = magicWallBasket.findIndex(item => item.topicKey === currentTopicKey);
      if (idx !== -1) {
        const prevItem = idx > 0 ? magicWallBasket[idx - 1] : null;
        const nextItem = idx < magicWallBasket.length - 1 ? magicWallBasket[idx + 1] : null;
        
        return {
          prev: prevItem ? {
            subject: prevItem.subject,
            classLevel: prevItem.classLevel,
            topic: prevItem.topicName,
          } : null,
          next: nextItem ? {
            subject: nextItem.subject,
            classLevel: nextItem.classLevel,
            topic: nextItem.topicName,
          } : null,
        } as const;
      }
    }
    return getSiblingTopics(taxonomy, topicNode);
  }, [taxonomy, topicNode, isMagicWallSource, magicWallBasket, currentTopicKey]);
  const isOverview = resolved?.isOverview === true;
  const subtopicIndex = resolved?.subtopicIndex ?? 0;
  const subtopicName = resolved?.subtopicName ?? "";
  const difficultyLevel = (resolved?.level ?? "basics") as DifficultyLevel;

  useEffect(() => {
    if (isOverview || !focusTimerRunning) return;
    const interval = setInterval(() => {
      setFocusTimerSeconds((prev) => {
        if (prev <= 1) {
          setFocusTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOverview, focusTimerRunning]);

  useEffect(() => {
    if (progressQueueOpen && !isOverview && focusTimerSeconds > 0) {
      setFocusTimerRunning(true);
    }
  }, [progressQueueOpen, isOverview, focusTimerSeconds]);

  // 3-column subtopic dashboard: left theory nav + main + right InstaCue/Quiz/Numerals/Concepts
  const isSubtopicDashboardLayout = !isOverview;
  // Approved topic-hub layout override for all overview pages.
  const isInvestorTopicHubLayout = isOverview;
  const user = useUserStore((s) => s.user);
  const saveRevisionCard = useUserStore((s) => s.saveRevisionCard);
  const saveBit = useUserStore((s) => s.saveBit);
  const unsaveBit = useUserStore((s) => s.unsaveBit);
  const saveFormula = useUserStore((s) => s.saveFormula);
  const unsaveFormula = useUserStore((s) => s.unsaveFormula);
  const saveRevisionUnit = useUserStore((s) => s.saveRevisionUnit);
  const unsaveRevisionUnit = useUserStore((s) => s.unsaveRevisionUnit);
  const { toast } = useToast();
  const { loading: authLoading, session } = useAuth();
  const [dbTheory, setDbTheory] = useState<string>("");
  const [dbTheoryExists, setDbTheoryExists] = useState(false);
  const [canEditTheory, setCanEditTheory] = useState(false);
  const [loadingDbTheory, setLoadingDbTheory] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftTheory, setDraftTheory] = useState("");
  const [draftDidYouKnow, setDraftDidYouKnow] = useState("");
  const [draftReferencesJson, setDraftReferencesJson] = useState("[]");
  const [dbReferences, setDbReferences] = useState<DeepDiveReference[]>([]);
  const [dbDidYouKnow, setDbDidYouKnow] = useState("");
  const [savingTheory, setSavingTheory] = useState(false);

  const [topicWhyStudy, setTopicWhyStudy] = useState("");
  const [topicSubtopicPreviews, setTopicSubtopicPreviews] = useState<TopicSubtopicPreview[]>([]);
  const [topicContentExists, setTopicContentExists] = useState(false);
  const [topicContentLoading, setTopicContentLoading] = useState(false);
  const [canEditTopicContent, setCanEditTopicContent] = useState(false);
  const [generatingTopic, setGeneratingTopic] = useState(false);
  const [topicRegenFeedbackOpen, setTopicRegenFeedbackOpen] = useState(false);
  const [fbLiked, setFbLiked] = useState("");
  const [fbDisliked, setFbDisliked] = useState("");
  const [fbInstructions, setFbInstructions] = useState("");
  const [topicAgentTrace, setTopicAgentTrace] = useState<TopicAgentTrace | null>(null);
  const [topicEditorOpen, setTopicEditorOpen] = useState(false);
  const [draftTopicWhyStudy, setDraftTopicWhyStudy] = useState("");
  const [draftTopicSubtopicPreviews, setDraftTopicSubtopicPreviews] = useState<TopicSubtopicPreview[]>([]);
  const [savingTopicContent, setSavingTopicContent] = useState(false);
  const [generatingDeepDive, setGeneratingDeepDive] = useState(false);
  const [wheelOpen, setWheelOpen] = useState(false);
  const [subtopicAgentTrace, setSubtopicAgentTrace] = useState<TopicAgentTrace | null>(null);
  const savedBits = user?.savedBits ?? [];

  const persistSavedContent = useCallback(() => {
    syncAllSavedContent().catch(() => {
      toast({
        title: "Sync failed",
        description: "Saved locally, but Supabase sync failed. Please retry.",
        variant: "destructive",
      });
    });
  }, [toast]);
  const revisionUnitId = useMemo(() => {
    if (!topicNode || isOverview || !subtopicName) return "";
    return `rev-topic-${board}-${subject}-${topicNode.classLevel}-${unitSlug}-${topicSlug}-${difficultyLevel}-${subtopicIndex}`;
  }, [board, subject, topicNode, isOverview, subtopicName, unitSlug, topicSlug, difficultyLevel, subtopicIndex]);

  const isSavedForRevision = useMemo(
    () => (!!revisionUnitId && (user?.savedRevisionUnits ?? []).some((u) => u.id === revisionUnitId)),
    [revisionUnitId, user?.savedRevisionUnits]
  );

  const handleToggleRevisionUnit = useCallback(() => {
    if (!topicNode || isOverview || !subtopicName || !revisionUnitId) return;
    if (isSavedForRevision) {
      unsaveRevisionUnit(revisionUnitId);
      persistSavedContent();
      toast({ title: "Removed from Revision Units" });
      return;
    }
    const unit: SavedRevisionUnit = {
      id: revisionUnitId,
      board: (board === "icse" ? "ICSE" : "CBSE") as Board,
      subject: topicNode.subject,
      classLevel: topicNode.classLevel,
      unitName: topicNode.topic,
      subtopicName,
      level: difficultyLevel,
      sectionIndex: subtopicIndex,
      sectionTitle: subtopicName,
    };
    saveRevisionUnit(unit);
    persistSavedContent();
    toast({ title: "Saved to Revision Units" });
  }, [
    topicNode,
    isOverview,
    subtopicName,
    revisionUnitId,
    isSavedForRevision,
    unsaveRevisionUnit,
    toast,
    board,
    difficultyLevel,
    subtopicIndex,
    saveRevisionUnit,
    persistSavedContent,
  ]);

  // Artifact state (InstaCue AI, Bits, Formulas)
  const [dbInstacueCards, setDbInstacueCards] = useState<ArtifactInstaCueCard[]>([]);
  const [dbBitsQuestions, setDbBitsQuestions] = useState<ArtifactBitsQuestion[]>([]);
  const [dbPracticeFormulas, setDbPracticeFormulas] = useState<ArtifactFormula[]>([]);
  const [generatingInstacue, setGeneratingInstacue] = useState(false);
  const [generatingBits, setGeneratingBits] = useState(false);
  const [generatingFormulas, setGeneratingFormulas] = useState(false);
  const [bitsDialogOpen, setBitsDialogOpen] = useState(false);
  const [referencesDialogOpen, setReferencesDialogOpen] = useState(false);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [conceptsPage, setConceptsPage] = useState(0);
  /** Concept-tab pagination pages visited (for progress checklist item 5) */
  const [viewedConceptPages, setViewedConceptPages] = useState<Set<number>>(() => new Set([0]));
  const [formulasDialogOpen, setFormulasDialogOpen] = useState(false);
  const [bitsCurrentIdx, setBitsCurrentIdx] = useState(0);
  const [bitsSelectedAnswers, setBitsSelectedAnswers] = useState<Record<number, number>>({});
  const [submittingBits, setSubmittingBits] = useState(false);
  const [bitsReviewMode, setBitsReviewMode] = useState(false);
  const [bitsAttempt, setBitsAttempt] = useState<BitsAttemptRecord | null>(null);
  const [selectedFormulaIdx, setSelectedFormulaIdx] = useState<number | null>(null);
  const [formulaBitsCurrentIdx, setFormulaBitsCurrentIdx] = useState(0);
  const [formulaBitsSelectedAnswers, setFormulaBitsSelectedAnswers] = useState<Record<number, number>>({});
  const [formulaQuestionsOverride, setFormulaQuestionsOverride] = useState<Record<number, ArtifactBitsQuestion[]>>({});
  const [artifactRunLog, setArtifactRunLog] = useState<string[]>([]);
  const [artifactRunStatus, setArtifactRunStatus] = useState<
    "idle" | "running" | "success" | "partial" | "failed"
  >("idle");
  const [artifactLastRunAt, setArtifactLastRunAt] = useState<string | null>(null);
  const [topicHubGateLoading, setTopicHubGateLoading] = useState(false);
  const [topicHubGateOk, setTopicHubGateOk] = useState(true);
  const [topicHubGateMissing, setTopicHubGateMissing] = useState<DifficultyLevel[]>([]);
  const [completingSubtopicAll, setCompletingSubtopicAll] = useState(false);

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7826/ingest/70e4f01b-2a33-46c4-8228-3ea27639475c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'548b33'},body:JSON.stringify({sessionId:'548b33',runId:'pre-fix',hypothesisId:'H2-H3',location:'page.tsx:620',message:'formula dialog state changed',data:{formulasDialogOpen,selectedFormulaIdx,practiceCount:dbPracticeFormulas.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [formulasDialogOpen, selectedFormulaIdx, dbPracticeFormulas.length]);

  useEffect(() => {
    if (!topicNode?.topic) return;
    setBitsVisitedIndices(new Set());
    setBitsCurrentIdx(0);
    setBitsSelectedAnswers({});
    setBitsDialogOpen(false);
    setBitsReviewMode(false);
    setInstaCueValidatedIndices(new Set());
    setInstaCueNavIndices(new Set());
    setFormulaByIdx({});
    engagementHydratedRef.current = null;
    setConceptsPage(0);
    setViewedConceptPages(new Set([0]));
  }, [board, topicNode?.topic, subtopicName, difficultyLevel]);

  useEffect(() => {
    if (!bitsDialogOpen || dbBitsQuestions.length === 0) return;
    setBitsVisitedIndices((prev) => {
      const next = new Set(prev);
      next.add(bitsCurrentIdx);
      return next;
    });
  }, [bitsDialogOpen, bitsCurrentIdx, dbBitsQuestions.length]);

  const subtopicAiBlockedByTopicHub = useMemo(() => {
    if (isOverview) return false;
    if (!canEditTheory) return false;
    if (topicHubGateLoading) return true;
    return !topicHubGateOk;
  }, [isOverview, canEditTheory, topicHubGateLoading, topicHubGateOk]);

  /** Subtopic row already has AI output in Supabase — allow regen even if theory text fails placeholder heuristics. */
  const hasPersistedAiArtifacts = useMemo(
    () =>
      dbInstacueCards.length >= MIN_INSTACUE_CARDS ||
      dbBitsQuestions.length >= MIN_BITS_QUESTIONS ||
      dbPracticeFormulas.length > 0,
    [dbInstacueCards.length, dbBitsQuestions.length, dbPracticeFormulas.length]
  );

  /** Topic hub is required for first-time generation; don't block admins who already have saved artifacts. */
  const artifactActionsTopicHubBlocked = useMemo(
    () => subtopicAiBlockedByTopicHub && !hasPersistedAiArtifacts,
    [subtopicAiBlockedByTopicHub, hasPersistedAiArtifacts]
  );

  const bitsSignature = useMemo(() => getBitsSignature(dbBitsQuestions), [dbBitsQuestions]);
  /** Full "Standard areas: …" string must reach MathText so KaTeX can format circle/parabola rows. */
  const displaySubtopicTitle = useMemo(() => subtopicMathTextLabel(subtopicName), [subtopicName]);
  const practiceFormulasForUi = useMemo(() => {
    if (dbPracticeFormulas.length > 0) return dbPracticeFormulas;
    if (!topicNode || !subtopicName) return [];
    return getFallbackPracticeFormulas({
      subject: topicNode.subject,
      topic: topicNode.topic,
      subtopicName,
    });
  }, [dbPracticeFormulas, topicNode, subtopicName]);

  const currentFormulaQuestion = useMemo(() => {
    if (selectedFormulaIdx === null) return null;
    const formula = practiceFormulasForUi[selectedFormulaIdx];
    if (!formula) return null;
    const formulaQuestions = formulaQuestionsOverride[selectedFormulaIdx] ?? formula.bitsQuestions ?? [];
    if (formulaQuestions.length === 0) return null;
    const idx = Math.max(0, Math.min(formulaBitsCurrentIdx, formulaQuestions.length - 1));
    return {
      formula,
      question: formulaQuestions[idx]!,
    };
  }, [selectedFormulaIdx, practiceFormulasForUi, formulaQuestionsOverride, formulaBitsCurrentIdx]);

  const savedFormulaIdForCurrentQuestion = useMemo(() => {
    if (!topicNode || !subtopicName || !currentFormulaQuestion) return null;
    const { formula, question } = currentFormulaQuestion;
    const hit = (user?.savedFormulas ?? []).find((f) => {
      if (
        f.name !== formula.name ||
        f.subject !== topicNode.subject ||
        f.topic !== topicNode.topic ||
        f.subtopicName !== subtopicName ||
        f.classLevel !== topicNode.classLevel ||
        f.level !== difficultyLevel
      ) {
        return false;
      }
      const savedQ = f.bitsQuestions?.[0];
      return (
        !!savedQ &&
        savedQ.question === question.question &&
        savedQ.correctAnswer === getCorrectOptionIndex(question) &&
        savedQ.options.length === question.options.length &&
        savedQ.options.every((o, i) => o === question.options[i])
      );
    });
    return hit?.id ?? null;
  }, [topicNode, subtopicName, currentFormulaQuestion, user?.savedFormulas, difficultyLevel]);

  /** InstaCue / Bits / Formulas need persisted theory unless this subtopic level already has DB artifacts to regenerate from. */
  const hasDeepDiveForAiArtifacts = useMemo(() => {
    if (hasPersistedAiArtifacts) return true;
    if (!dbTheoryExists) return false;
    const t = dbTheory.trim();
    if (!t) return false;
    return !subtopicTheoryIsPlaceholder(t);
  }, [hasPersistedAiArtifacts, dbTheoryExists, dbTheory]);

  const appendArtifactLog = useCallback((message: string) => {
    const ts = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setArtifactRunLog((prev) => [...prev, `[${ts}] ${message}`]);
  }, []);

  const artifactCountsRef = useRef({ insta: 0, bits: 0, formulas: 0 });
  useEffect(() => {
    artifactCountsRef.current = {
      insta: dbInstacueCards.length,
      bits: dbBitsQuestions.length,
      formulas: dbPracticeFormulas.length,
    };
  }, [dbInstacueCards.length, dbBitsQuestions.length, dbPracticeFormulas.length]);

  /** InstaCue → Bits → Practice Formulas (manual run from dedicated AI buttons). */
  const runAiArtifactPipeline = useCallback(
    async (opts?: { skipDeepDiveGate?: boolean }) => {
      if (!topicNode || !subtopicName) return;
      if (!opts?.skipDeepDiveGate && !hasDeepDiveForAiArtifacts) return;

      const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
      const runLog: string[] = [];
      const beforeInsta = artifactCountsRef.current.insta;
      const beforeBits = artifactCountsRef.current.bits;
      const beforeFormulas = artifactCountsRef.current.formulas;
      let nextInsta = beforeInsta;
      let nextBits = beforeBits;
      let nextFormulas = beforeFormulas;

      setArtifactRunStatus("running");
      setArtifactLastRunAt(new Date().toLocaleString());
      setArtifactRunLog([]);
      appendArtifactLog("Run started manually: InstaCue → Bits → Formulas.");
      appendArtifactLog(
        `Current counts before run -> InstaCue: ${beforeInsta}, Bits: ${beforeBits}, Practice Formulas: ${beforeFormulas}.`,
      );
      setGeneratingInstacue(true);
      const stepErrors: string[] = [];
      try {
        runLog.push("Started AI Cards");
        appendArtifactLog(
          `Step 1/3: Generating InstaCue cards (up to ${ARTIFACT_STEP_MAX_ATTEMPTS} attempts, ${ARTIFACT_STEP_RETRY_DELAY_MS / 1000}s between retries).`,
        );
        const instaRes = await runArtifactStepWithRetries("InstaCue", () =>
          generateInstaCueCards({
          board: boardName,
          subject: topicNode.subject as Subject,
          classLevel: topicNode.classLevel as 11 | 12,
          topic: topicNode.topic,
          subtopicName,
          level: difficultyLevel,
          includeTrace: true,
          })
        );
        if (instaRes.ok) {
          const out = instaRes.value;
        setDbInstacueCards(out.items);
        nextInsta = out.items.length;
        runLog.push(`Finished AI Cards (${out.items.length})`);
        appendArtifactLog(`Step 1/3 complete: InstaCue generated ${out.items.length} cards (was ${beforeInsta}).`);
        toast({
          title: `Generated ${out.items.length} InstaCue cards`,
          description: "Starting Bits generation…",
        });
        } else {
          stepErrors.push(instaRes.error);
          runLog.push("AI Cards failed");
          appendArtifactLog(`Step 1/3 failed after retries: ${instaRes.error}`);
        }

        appendArtifactLog(
          `Waiting ${Math.round(ARTIFACT_PIPELINE_BETWEEN_STEPS_MS / 1000)}s before Bits (step gap — edit ARTIFACT_PIPELINE_BETWEEN_STEPS_MS in page.tsx to change).`,
        );
        await delay(ARTIFACT_PIPELINE_BETWEEN_STEPS_MS);

        setGeneratingBits(true);
        try {
          runLog.push("Started Bits");
          appendArtifactLog(
            `Step 2/3: Generating Bits questions (up to ${ARTIFACT_STEP_MAX_ATTEMPTS} attempts).`,
          );
          const bitsRes = await runArtifactStepWithRetries("Bits", () =>
            generateBitsQuestions({
            board: boardName,
            subject: topicNode.subject as Subject,
            classLevel: topicNode.classLevel as 11 | 12,
            topic: topicNode.topic,
            subtopicName,
            level: difficultyLevel,
            includeTrace: true,
            })
          );
          if (bitsRes.ok) {
            const bitsOut = bitsRes.value;
          setDbBitsQuestions(bitsOut.items);
          nextBits = bitsOut.items.length;
          setBitsCurrentIdx(0);
          setBitsSelectedAnswers({});
          runLog.push(`Finished Bits (${bitsOut.items.length})`);
          appendArtifactLog(`Step 2/3 complete: Bits generated ${bitsOut.items.length} questions (was ${beforeBits}).`);
          toast({
            title: `Generated ${bitsOut.items.length} Bits questions`,
            description: "Starting formula practice generation…",
          });
          } else {
            stepErrors.push(bitsRes.error);
            runLog.push("Bits failed");
            appendArtifactLog(`Step 2/3 failed after retries: ${bitsRes.error}`);
          }
        } finally {
          setGeneratingBits(false);
        }

        appendArtifactLog(
          `Waiting ${Math.round(ARTIFACT_PIPELINE_BETWEEN_STEPS_MS / 1000)}s before Practice Formulas (same step gap).`,
        );
        await delay(ARTIFACT_PIPELINE_BETWEEN_STEPS_MS);

        setGeneratingFormulas(true);
        try {
          runLog.push("Started Formula Practice");
          appendArtifactLog(
            `Step 3/3: Generating Practice Formulas (up to ${ARTIFACT_STEP_MAX_ATTEMPTS} attempts).`,
          );
          const formulasRes = await runArtifactStepWithRetries("Formulas", () =>
            generateFormulaPractice({
            board: boardName,
            subject: topicNode.subject as Subject,
            classLevel: topicNode.classLevel as 11 | 12,
            topic: topicNode.topic,
            subtopicName,
            level: difficultyLevel,
            includeTrace: true,
            })
          );
          if (formulasRes.ok) {
            const formulasOut = formulasRes.value;
          setDbPracticeFormulas(formulasOut.items);
          nextFormulas = formulasOut.items.length;
          setSelectedFormulaIdx(null);
          setFormulaBitsCurrentIdx(0);
          setFormulaBitsSelectedAnswers({});
          runLog.push(`Finished Formula Practice (${formulasOut.items.length})`);
          appendArtifactLog(
            `Step 3/3 complete: Practice Formulas generated ${formulasOut.items.length} sets (was ${beforeFormulas}).`,
          );
          toast({ title: `Generated ${formulasOut.items.length} formula sets` });
          } else {
            stepErrors.push(formulasRes.error);
            runLog.push("Formula Practice failed");
            appendArtifactLog(`Step 3/3 failed after retries: ${formulasRes.error}`);
          }
        } finally {
          setGeneratingFormulas(false);
        }

        appendArtifactLog(
          `Run finished -> InstaCue: ${nextInsta}, Bits: ${nextBits}, Practice Formulas: ${nextFormulas}. Errors: ${stepErrors.length}.`,
        );
        if (stepErrors.length === 0) {
        setArtifactRunStatus("success");
        toast({
          title: "AI artifacts completed",
          description: runLog.join(" → "),
        });
        } else if (stepErrors.length === 3) {
          setArtifactRunStatus("failed");
          toast({
            title: "AI artifacts failed",
            description: stepErrors.join(" · "),
            variant: "destructive",
          });
        } else {
          setArtifactRunStatus("partial");
          toast({
            title: "AI artifacts partially completed",
            description: stepErrors.join(" · "),
          });
        }
      } catch (e) {
        appendArtifactLog(`Run failed unexpectedly: ${e instanceof Error ? e.message : "Unknown error"}`);
        setArtifactRunStatus("failed");
        toast({
          title: e instanceof Error ? e.message : "Generation failed",
          variant: "destructive",
        });
      } finally {
        setGeneratingInstacue(false);
      }
    },
    [
      appendArtifactLog,
      board,
      difficultyLevel,
      hasDeepDiveForAiArtifacts,
      subtopicName,
      toast,
      topicNode,
    ]
  );

  const runDeepDiveGeneration = useCallback(
    async (opts?: { fromSubtopicAi?: boolean }) => {
      if (!topicNode || !subtopicName) return false;
      const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
      const existingPreview =
        topicSubtopicPreviews.find((p) => p.subtopicName.trim().toLowerCase() === subtopicName.trim().toLowerCase())
          ?.preview ?? "";
      const isRegenerate = dbTheoryExists;
      setGeneratingDeepDive(true);
      setSubtopicAgentTrace(null);
      try {
        const out = await generateSubtopicContent({
          board: boardName,
          subject: topicNode.subject as Subject,
          classLevel: topicNode.classLevel as 11 | 12,
          topic: topicNode.topic,
          subtopicName,
          level: difficultyLevel as "basics" | "intermediate" | "advanced",
          chapterTitle: topicNode.chapterTitle,
          preview: existingPreview,
          includeTrace: true,
        });
        setDbTheory(out.theory);
        setDbTheoryExists(true);
        setDbDidYouKnow(out.didYouKnow);
        setDbReferences(out.references);
        setSubtopicAgentTrace(out.trace ?? null);
        toast({
          title: isRegenerate ? "Deep dive regenerated" : "Deep dive generated",
          description:
            (out.ragChunks != null
              ? `${subtopicName} (${difficultyLevel}) · Saved to Supabase · RAG passages used: ${out.ragChunks}. `
              : `${subtopicName} (${difficultyLevel}) · Saved to Supabase. `) +
            (opts?.fromSubtopicAi
              ? "Starting InstaCue, Bits, and formula practice."
              : canEditTheory
                ? "Now use Generate Subtopic AI to create InstaCue, Bits, and formula practice."
                : "Use the section generate buttons to build InstaCue, Bits, and formulas."),
        });
        return true;
      } catch (e) {
        const message = e instanceof Error ? e.message : "Generation failed";
        toast({ title: message, variant: "destructive" });
        return false;
      } finally {
        setGeneratingDeepDive(false);
      }
    },
    [
      board,
      canEditTheory,
      dbTheoryExists,
      difficultyLevel,
      subtopicName,
      toast,
      topicNode,
      topicSubtopicPreviews,
    ]
  );

  const runSubtopicAiGeneration = useCallback(async () => {
    if (!topicNode || !subtopicName) return;
    if (generatingDeepDive || generatingInstacue || generatingBits || generatingFormulas || loadingDbTheory) return;
    const deepDiveOk = await runDeepDiveGeneration({ fromSubtopicAi: true });
    if (!deepDiveOk) return;
    await delay(ARTIFACT_PIPELINE_AFTER_DEEP_DIVE_SETTLE_MS);
    await runAiArtifactPipeline({ skipDeepDiveGate: true });
  }, [
    generatingBits,
    generatingDeepDive,
    generatingFormulas,
    generatingInstacue,
    loadingDbTheory,
    runAiArtifactPipeline,
    runDeepDiveGeneration,
    subtopicName,
    topicNode,
  ]);

  const runBitsOnly = useCallback(async () => {
    if (!topicNode || !subtopicName || !hasDeepDiveForAiArtifacts) return;
    if (artifactActionsTopicHubBlocked) {
      toast({
        title: "Topic hub incomplete",
        description: `Generate the topic hub for Basics, Intermediate, and Advanced first. Missing: ${
          topicHubGateMissing.length ? topicHubGateMissing.join(", ") : "one or more levels"
        }.`,
        variant: "destructive",
      });
      return;
    }
    if (generatingDeepDive || generatingInstacue || generatingBits || generatingFormulas) return;
    const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
    setArtifactRunStatus("running");
    setArtifactLastRunAt(new Date().toLocaleString());
    setArtifactRunLog([]);
    appendArtifactLog("Manual run started: Bits only.");
    setGeneratingBits(true);
    try {
      const bitsOut = await generateBitsQuestions({
        board: boardName,
        subject: topicNode.subject as Subject,
        classLevel: topicNode.classLevel as 11 | 12,
        topic: topicNode.topic,
        subtopicName,
        level: difficultyLevel,
        includeTrace: true,
      });
      setDbBitsQuestions(bitsOut.items);
      setBitsCurrentIdx(0);
      setBitsSelectedAnswers({});
      appendArtifactLog(`Bits complete: generated ${bitsOut.items.length} questions.`);
      setArtifactRunStatus("success");
      toast({ title: `Generated ${bitsOut.items.length} Bits questions` });
    } catch (e) {
      appendArtifactLog(`Bits failed: ${e instanceof Error ? e.message : "Unknown error"}`);
      setArtifactRunStatus("failed");
      toast({ title: e instanceof Error ? e.message : "Bits generation failed", variant: "destructive" });
    } finally {
      setGeneratingBits(false);
    }
  }, [
    appendArtifactLog,
    board,
    difficultyLevel,
    generatingBits,
    generatingDeepDive,
    generatingFormulas,
    generatingInstacue,
    artifactActionsTopicHubBlocked,
    hasDeepDiveForAiArtifacts,
    subtopicName,
    toast,
    topicHubGateMissing,
    topicNode,
  ]);

  const runFormulasOnly = useCallback(async () => {
    if (!topicNode || !subtopicName || !hasDeepDiveForAiArtifacts) return;
    if (artifactActionsTopicHubBlocked) {
      toast({
        title: "Topic hub incomplete",
        description: `Generate the topic hub for Basics, Intermediate, and Advanced first. Missing: ${
          topicHubGateMissing.length ? topicHubGateMissing.join(", ") : "one or more levels"
        }.`,
        variant: "destructive",
      });
      return;
    }
    if (generatingDeepDive || generatingInstacue || generatingBits || generatingFormulas) return;
    const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
    setArtifactRunStatus("running");
    setArtifactLastRunAt(new Date().toLocaleString());
    setArtifactRunLog([]);
    appendArtifactLog("Manual run started: Practice Formulas only.");
    setGeneratingFormulas(true);
    try {
      const formulasOut = await generateFormulaPractice({
        board: boardName,
        subject: topicNode.subject as Subject,
        classLevel: topicNode.classLevel as 11 | 12,
        topic: topicNode.topic,
        subtopicName,
        level: difficultyLevel,
        includeTrace: true,
      });
      setDbPracticeFormulas(formulasOut.items);
      setSelectedFormulaIdx(null);
      setFormulaBitsCurrentIdx(0);
      setFormulaBitsSelectedAnswers({});
      appendArtifactLog(`Practice Formulas complete: generated ${formulasOut.items.length} sets.`);
      setArtifactRunStatus("success");
      toast({ title: `Generated ${formulasOut.items.length} formula sets` });
    } catch (e) {
      appendArtifactLog(`Practice Formulas failed: ${e instanceof Error ? e.message : "Unknown error"}`);
      setArtifactRunStatus("failed");
      toast({ title: e instanceof Error ? e.message : "Formula generation failed", variant: "destructive" });
    } finally {
      setGeneratingFormulas(false);
    }
  }, [
    appendArtifactLog,
    board,
    difficultyLevel,
    generatingBits,
    generatingDeepDive,
    generatingFormulas,
    generatingInstacue,
    artifactActionsTopicHubBlocked,
    hasDeepDiveForAiArtifacts,
    subtopicName,
    toast,
    topicHubGateMissing,
    topicNode,
  ]);

  const runCompleteSubtopicAll = useCallback(
    async (opts?: { dryRun?: boolean }) => {
      if (!topicNode || !subtopicName) return;
      if (subtopicAiBlockedByTopicHub && opts?.dryRun !== true) {
        toast({
          title: "Topic hub incomplete",
          description: `Generate the topic hub for Basics, Intermediate, and Advanced first. Missing: ${
            topicHubGateMissing.length ? topicHubGateMissing.join(", ") : "one or more levels"
          }.`,
          variant: "destructive",
        });
        return;
      }
      const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
      setCompletingSubtopicAll(true);
      setArtifactRunStatus("running");
      setArtifactLastRunAt(new Date().toLocaleString());
      setArtifactRunLog([]);
      appendArtifactLog(
        opts?.dryRun
          ? "Audit current subtopic (no AI): basics → intermediate → advanced …"
          : "Complete-subtopic fallback: filling gaps for basics → intermediate → advanced…",
      );
      try {
        const out = await postCompleteSubtopic({
          board: boardName,
          subject: topicNode.subject as Subject,
          classLevel: topicNode.classLevel as 11 | 12,
          topic: topicNode.topic,
          subtopicName,
          hubScope: "topic",
          dryRun: opts?.dryRun === true,
        });
        if (!out.ok && out.topicHubGate && !out.topicHubGate.ok) {
          const miss = (out.topicHubGate.missingTopicLevels ?? []).join(", ");
          appendArtifactLog(`Topic hub gate failed. Missing levels: ${miss || "unknown"}`);
          setArtifactRunStatus("failed");
          toast({
            title: "Topic hub incomplete",
            description: miss ? `Missing: ${miss}` : "Generate Basics, Intermediate, and Advanced topic hubs first.",
            variant: "destructive",
          });
          return;
        }
        const levelEntries = Object.entries(out.levels ?? {});
        for (const [lv, rep] of levelEntries) {
          appendArtifactLog(
            `[${lv}] theory=${rep.theory} instacue=${rep.instacue} bits=${rep.bits} formulas=${rep.formulas}`,
          );
          for (const w of rep.warnings ?? []) appendArtifactLog(`[${lv}] ${w}`);
        }
        for (const w of out.warnings ?? []) appendArtifactLog(`Warning: ${w}`);
        for (const r of out.retries ?? []) appendArtifactLog(`Retry: ${r.level}/${r.block}`);
        if (opts?.dryRun) {
          setArtifactRunStatus("success");
          toast({ title: "Audit complete", description: "See Behind the scenes log for all levels." });
          return;
        }
        const hadFail = levelEntries.some(([, lv]) =>
          [lv.theory, lv.instacue, lv.bits, lv.formulas].some((s) => s === "failed" || s === "failed_after_retry")
        );
        setArtifactRunStatus(hadFail ? "partial" : "success");
        toast({
          title: hadFail ? "Complete-subtopic finished with issues" : "Complete-subtopic finished",
          description: "This page’s difficulty level was refreshed from the server.",
        });
        const refreshed = await fetchSubtopicContent({
          board: boardName,
          subject: topicNode.subject,
          classLevel: topicNode.classLevel,
          topic: topicNode.topic,
          subtopicName,
          level: difficultyLevel,
        });
        setDbTheory(refreshed.theory);
        setDbTheoryExists(refreshed.exists);
        setDbReferences(refreshed.references);
        setDbDidYouKnow(refreshed.didYouKnow);
        setDbInstacueCards(refreshed.instacueCards);
        setDbBitsQuestions(refreshed.bitsQuestions);
        setDbPracticeFormulas(refreshed.practiceFormulas);
      } catch (e) {
        setArtifactRunStatus("failed");
        toast({
          title: e instanceof Error ? e.message : "complete-subtopic failed",
          variant: "destructive",
        });
      } finally {
        setCompletingSubtopicAll(false);
      }
    },
    [
      appendArtifactLog,
      board,
      difficultyLevel,
      subtopicAiBlockedByTopicHub,
      subtopicName,
      toast,
      topicHubGateMissing,
      topicNode,
    ]
  );

  const runAuditAllSubtopicsAllLevels = useCallback(async () => {
    if (!topicNode) return;
    const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
    const levels: DifficultyLevel[] = ["basics", "intermediate", "advanced"];

    setArtifactRunStatus("running");
    setArtifactLastRunAt(new Date().toLocaleString());
    setArtifactRunLog([]);
    appendArtifactLog("Audit all levels (no AI): basics → intermediate → advanced (all subtopics) …");

    try {
      const subtopics = topicNode.subtopics.map((s) => s.name).filter(Boolean);
      for (const level of levels) {
        appendArtifactLog("");
        appendArtifactLog(`=== ${level.toUpperCase()} ===`);

        let complete = 0;
        let pending = 0;
        for (const name of subtopics) {
          const row = await fetchSubtopicContent({
            board: boardName,
            subject: topicNode.subject,
            classLevel: topicNode.classLevel,
            topic: topicNode.topic,
            subtopicName: name,
            level,
          });
          const assess = assessSubtopicRow({
            theory: row.theory,
            instacue_cards: row.instacueCards,
            bits_questions: row.bitsQuestions,
            practice_formulas: row.practiceFormulas,
          });

          const missing: string[] = [];
          if (assess.theoryMissingOrPlaceholder) missing.push("deep_dive");
          if (assess.instacueGap) missing.push("instacue");
          if (assess.bitsGap) missing.push("bits");
          if (!assess.skipFormulasConceptual && assess.formulasGap) missing.push("formulas");

          if (missing.length === 0) {
            complete += 1;
            appendArtifactLog(`✅ ${name}`);
          } else {
            pending += 1;
            appendArtifactLog(
              `⏳ ${name} — missing: ${missing.join(", ")}${
                assess.skipFormulasConceptual ? " (conceptual: formulas skipped)" : ""
              }`
            );
          }
        }
        appendArtifactLog(`Summary (${level}): complete=${complete} pending=${pending}`);
      }

      setArtifactRunStatus("success");
      toast({
        title: "Audit complete",
        description: "See Behind the scenes log grouped by Basics → Intermediate → Advanced.",
      });
    } catch (e) {
      setArtifactRunStatus("failed");
      toast({
        title: e instanceof Error ? e.message : "audit failed",
        variant: "destructive",
      });
    }
  }, [appendArtifactLog, board, toast, topicNode]);

  const handleWheelSelect = useCallback(
    (subtopicName: string) => {
      if (!topicNode) return;
      setWheelOpen(false);
      router.push(
        buildTopicPath(
          board,
          topicNode.subject,
          topicNode.classLevel,
          topicNode.topic,
          subtopicName,
          difficultyLevel,
          "random"
        )
      );
    },
    [board, topicNode, difficultyLevel, router]
  );

  const topicIntroMarkdown = useMemo(() => {
    if (!topicNode) return "";
    const d = getTopicOverviewOrPlaceholder(
      topicNode.subject,
      topicNode.classLevel,
      topicNode.topic,
      topicNode.subtopics.map((s) => s.name),
      difficultyLevel as "basics" | "intermediate" | "advanced"
    );
    const t = d.theory;
    const marker = "**What you will cover**";
    const i = t.indexOf(marker);
    return (i >= 0 ? t.slice(0, i) : t).trim();
  }, [topicNode, difficultyLevel]);

  const subtopicStackRows = useMemo(() => {
    if (!topicNode) return [];
    const lev = difficultyLevel as "basics" | "intermediate" | "advanced";
    return topicNode.subtopics.map((st) => {
      const td = getTheoryOrPlaceholder(
        topicNode.subject,
        topicNode.classLevel,
        topicNode.topic,
        st.name,
        lev
      );
      return {
        name: st.name,
        theoryFull: td.theory,
        isPh: subtopicTheoryIsPlaceholder(td.theory),
        hasInteractive: Boolean(td.interactiveBlocks?.length),
      };
    });
  }, [topicNode, difficultyLevel]);

  const focusedSubtopicTheoryData = useMemo(() => {
    if (!topicNode || isOverview || !subtopicName) return null;
    return getTheoryOrPlaceholder(
      topicNode.subject,
      topicNode.classLevel,
      topicNode.topic,
      subtopicName,
      difficultyLevel as "basics" | "intermediate" | "advanced"
    );
  }, [topicNode, isOverview, subtopicName, difficultyLevel]);

  const topicPreviewByName = useMemo(() => {
    const exact = new Map<string, string>();
    const fuzzy = new Map<string, string>();
    for (const row of topicSubtopicPreviews) {
      const p = row.preview.trim();
      if (!p) continue;
      const ek = row.subtopicName.trim().toLowerCase();
      if (ek && !exact.has(ek)) exact.set(ek, p);
      const fk = fuzzySubtopicKey(row.subtopicName);
      if (fk && !fuzzy.has(fk)) fuzzy.set(fk, p);
    }
    return { get: (name: string) => exact.get(name.trim().toLowerCase()) ?? fuzzy.get(fuzzySubtopicKey(name)) ?? "" };
  }, [topicSubtopicPreviews]);

  const buildTopicHubDraftPreviews = useCallback((): TopicSubtopicPreview[] => {
    if (!topicNode) return [];
    return topicNode.subtopics.map((s) => {
      const hit = topicSubtopicPreviews.find(
        (p) =>
          p.subtopicName.trim().toLowerCase() === s.name.trim().toLowerCase() ||
          fuzzySubtopicKey(p.subtopicName) === fuzzySubtopicKey(s.name)
      );
      return { subtopicName: s.name, preview: hit?.preview ?? "" };
    });
  }, [topicNode, topicSubtopicPreviews]);

  useEffect(() => {
    if (!topicNode || isOverview || !subtopicName) {
      setDbTheory("");
      setDbTheoryExists(false);
      setCanEditTheory(false);
      setEditorOpen(false);
      setDbReferences([]);
      setDbDidYouKnow("");
      setSubtopicAgentTrace(null);
      setDbInstacueCards([]);
      setDbBitsQuestions([]);
      setDbPracticeFormulas([]);
      return;
    }
    let cancelled = false;
    const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
    setLoadingDbTheory(true);
    fetchSubtopicContent({
      board: boardName,
      subject: topicNode.subject,
      classLevel: topicNode.classLevel,
      topic: topicNode.topic,
      subtopicName,
      level: difficultyLevel,
    })
      .then((res) => {
        if (cancelled) return;
        setDbTheory(res.theory);
        setDbTheoryExists(res.exists);
        setCanEditTheory(res.canEdit);
        setDbReferences(res.references);
        setDbDidYouKnow(res.didYouKnow);
        setDbInstacueCards(res.instacueCards);
        setDbBitsQuestions(res.bitsQuestions);
        setDbPracticeFormulas(res.practiceFormulas);
      })
      .catch(() => {
        if (cancelled) return;
        setDbTheory("");
        setDbTheoryExists(false);
        setCanEditTheory(false);
        setDbReferences([]);
        setDbDidYouKnow("");
        setDbInstacueCards([]);
        setDbBitsQuestions([]);
        setDbPracticeFormulas([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingDbTheory(false);
      });
    return () => {
      cancelled = true;
    };
  }, [topicNode, isOverview, subtopicName, difficultyLevel, board, authLoading, session?.access_token]);

  useEffect(() => {
    if (isOverview || !topicNode || !session?.access_token) {
      setTopicHubGateOk(true);
      setTopicHubGateMissing([]);
      setTopicHubGateLoading(false);
      return;
    }
    if (!canEditTheory) {
      setTopicHubGateOk(true);
      setTopicHubGateMissing([]);
      setTopicHubGateLoading(false);
      return;
    }
    let cancelled = false;
    setTopicHubGateLoading(true);
    setTopicHubGateOk(false);
    const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
    void fetchTopicHubThreeLevelGate({
      board: boardName,
      subject: topicNode.subject as Subject,
      classLevel: topicNode.classLevel as 11 | 12,
      topic: topicNode.topic,
      hubScope: "topic",
    })
      .then((r) => {
        if (cancelled) return;
        setTopicHubGateOk(r.ok);
        setTopicHubGateMissing(r.missingLevels);
      })
      .catch(() => {
        if (cancelled) return;
        setTopicHubGateOk(false);
        setTopicHubGateMissing(["basics", "intermediate", "advanced"]);
      })
      .finally(() => {
        if (!cancelled) setTopicHubGateLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOverview, topicNode, board, session?.access_token, canEditTheory]);

  const engagementScope = useMemo((): SubtopicEngagementScope | null => {
    if (!topicNode || isOverview || !subtopicName) return null;
    return {
      board: (board === "icse" ? "ICSE" : "CBSE") as Board,
      subject: topicNode.subject,
      classLevel: topicNode.classLevel,
      topic: topicNode.topic,
      subtopicName,
      level: difficultyLevel,
    };
  }, [topicNode, isOverview, subtopicName, difficultyLevel, board]);

  useEffect(() => {
    if (!topicNode || isOverview || !subtopicName || dbBitsQuestions.length === 0) {
      setBitsAttempt(null);
      return;
    }
    const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
    let cancelled = false;
    fetchBitsAttempt({
      board: boardName,
      subject: topicNode.subject,
      classLevel: topicNode.classLevel,
      topic: topicNode.topic,
      subtopicName,
      level: difficultyLevel,
    })
      .then(async (attempt) => {
        if (cancelled) return;
        if (attempt && attempt.bitsSignature === bitsSignature) {
          setBitsAttempt(attempt);
          engagementHydratedRef.current = bitsSignature;
          return;
        }
        setBitsAttempt(null);
        if (!engagementScope || !session?.access_token) return;
        try {
          const e = await fetchSubtopicEngagement(engagementScope);
          if (cancelled || !e || e.bitsSignature !== bitsSignature) return;
          if (engagementHydratedRef.current === bitsSignature) return;
          engagementHydratedRef.current = bitsSignature;
          if (e.bits) {
            setBitsCurrentIdx(Math.min(e.bits.currentIdx, Math.max(0, dbBitsQuestions.length - 1)));
            const sa: Record<number, number> = {};
            for (const [k, v] of Object.entries(e.bits.selectedAnswers)) {
              const nk = Number(k);
              if (Number.isInteger(nk)) sa[nk] = v;
            }
            setBitsSelectedAnswers(sa);
            setBitsVisitedIndices(new Set(e.bits.visitedIndices));
          }
          if (e.formulaByIdx) {
            const m: Record<number, { qIdx: number; answers: Record<number, number> }> = {};
            for (const [k, v] of Object.entries(e.formulaByIdx)) {
              const nk = Number(k);
              if (!Number.isInteger(nk)) continue;
              const answers: Record<number, number> = {};
              for (const [qk, qv] of Object.entries(v.answers)) {
                const nqk = Number(qk);
                if (Number.isInteger(nqk)) answers[nqk] = qv;
              }
              m[nk] = { qIdx: v.qIdx, answers };
            }
            setFormulaByIdx(m);
          }
          if (e.instaCue) {
            setInstaCueNavIndices(new Set(e.instaCue.navVisited));
            setInstaCueValidatedIndices(new Set(e.instaCue.flipped));
          }
          if (e.conceptsPages?.length) {
            setViewedConceptPages(new Set(e.conceptsPages));
          }
        } catch {
          /* column may be missing on older DBs */
        }
      })
      .catch(() => {
        if (!cancelled) setBitsAttempt(null);
      });
    return () => {
      cancelled = true;
    };
  }, [
    topicNode,
    isOverview,
    subtopicName,
    difficultyLevel,
    board,
    bitsSignature,
    dbBitsQuestions.length,
    engagementScope,
    session?.access_token,
  ]);

  useEffect(() => {
    if (!topicNode || !isOverview) {
      setTopicWhyStudy("");
      setTopicSubtopicPreviews([]);
      setTopicContentExists(false);
      setCanEditTopicContent(false);
      setTopicContentLoading(false);
      setTopicAgentTrace(null);
      return;
    }
    if (authLoading) {
      setTopicContentLoading(true);
      return;
    }

    let cancelled = false;
    const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
    setTopicContentLoading(true);
    fetchTopicContent(
      {
        board: boardName,
        subject: topicNode.subject,
        classLevel: topicNode.classLevel,
        topic: topicNode.topic,
        level: difficultyLevel,
      }
    )
      .then((res) => {
        if (cancelled) return;
        setTopicWhyStudy(res.whyStudy);
        setTopicSubtopicPreviews(res.subtopicPreviews ?? []);
        setTopicContentExists(res.exists);
        setCanEditTopicContent(res.canEdit);
      })
      .catch(() => {
        if (cancelled) return;
        setTopicWhyStudy("");
        setTopicSubtopicPreviews([]);
        setTopicContentExists(false);
        setCanEditTopicContent(false);
        setTopicAgentTrace(null);
      })
      .finally(() => {
        if (!cancelled) setTopicContentLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [topicNode, isOverview, difficultyLevel, board, authLoading, session?.access_token]);

  const sidebarInstaCueCards = useMemo(() => {
    if (!topicNode || isOverview || !subtopicName) return [] as InstaCueCard[];
    const savedCards = user?.savedRevisionCards ?? [];
    const level = difficultyLevel as "basics" | "intermediate" | "advanced";
    const baseCards = getInstaCueCards(
      topicNode.subject,
      topicNode.classLevel,
      topicNode.topic,
      [subtopicName],
      undefined,
      level
    );
    const userCards = savedCards
      .filter((c) => {
        const typedCard = c as Partial<InstaCueCard>;
        return (
          c.topic === topicNode.topic &&
          c.subtopicName === subtopicName &&
          c.subject === topicNode.subject &&
          c.classLevel === topicNode.classLevel &&
          (!typedCard.level || typedCard.level === level)
        );
      })
      .map((c) => ({ ...c })) as InstaCueCard[];
    const aiCards = dbInstacueCards
      .filter((c) => c.frontContent?.trim() && c.backContent?.trim())
      .map((c, idx) => {
        const type =
          c.type === "formula" || c.type === "common_mistake" || c.type === "trap"
            ? c.type
            : "concept";
        return {
          id: `ai-${topicNode.topic}-${subtopicName}-${level}-${idx}`,
          type,
          frontContent: c.frontContent.trim(),
          backContent: c.backContent.trim(),
          subtopicName,
          topic: topicNode.topic,
          subject: topicNode.subject,
          classLevel: topicNode.classLevel,
          level,
        } as InstaCueCard;
      });

    // Prefer AI cards first so newly generated content appears immediately on top.
    const merged = [...aiCards, ...baseCards, ...userCards];
    const seen = new Set<string>();
    return merged.filter((card) => {
      const key = `${card.type}|${card.frontContent.trim().toLowerCase()}|${card.backContent.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [topicNode, isOverview, subtopicName, difficultyLevel, user?.savedRevisionCards, dbInstacueCards]);

  const handleInstaCueValidated = useCallback((index: number) => {
    setInstaCueValidatedIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    setInstaCueNavIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const handleInstaCueNav = useCallback((index: number) => {
    setInstaCueNavIndices((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, []);

  const bitsChecklistTotal = dbBitsQuestions.length;
  /** Count answers tied to valid question indices only (avoids orphan keys; matches submit eligibility). */
  const bitsFilledQuestionCount = useMemo(() => {
    const n = dbBitsQuestions.length;
    let c = 0;
    for (let i = 0; i < n; i++) {
      if (typeof bitsSelectedAnswers[i] === "number") c++;
    }
    return c;
  }, [bitsSelectedAnswers, dbBitsQuestions.length]);
  const bitsChecklistProgress = bitsAttempt
    ? bitsChecklistTotal
    : Math.min(bitsChecklistTotal, Math.max(bitsVisitedIndices.size, bitsFilledQuestionCount));
  const instaCueChecklistTotal = sidebarInstaCueCards.length;
  const instaCueCoverageCount = useMemo(() => {
    const u = new Set<number>();
    instaCueValidatedIndices.forEach((i) => u.add(i));
    instaCueNavIndices.forEach((i) => u.add(i));
    return u.size;
  }, [instaCueValidatedIndices, instaCueNavIndices]);
  const instaCueChecklistProgress = Math.min(instaCueCoverageCount, instaCueChecklistTotal);

  const formulaProgressAggregate = useMemo(() => {
    if (practiceFormulasForUi.length === 0) return { answered: 0, total: 5 };
    let answered = 0;
    let total = 0;
    practiceFormulasForUi.forEach((f, fi) => {
      const qs = formulaQuestionsOverride[fi] ?? f.bitsQuestions ?? [];
      const t = qs.length;
      if (t <= 0) return;
      total += t;
      const pack = formulaByIdx[fi];
      const n = pack ? Object.keys(pack.answers).length : 0;
      answered += Math.min(n, t);
    });
    if (total === 0) {
      return {
        answered: Object.keys(formulaBitsSelectedAnswers).length,
        total: 5,
      };
    }
    return { answered, total };
  }, [practiceFormulasForUi, formulaQuestionsOverride, formulaByIdx, formulaBitsSelectedAnswers]);

  const formulaChecklistTotal = formulaProgressAggregate.total;
  const formulaChecklistProgress = Math.min(formulaProgressAggregate.answered, formulaChecklistTotal);

  // Extract section headings from theory markdown for left sidebar
  const dbTheorySections = useMemo(() => {
    if (!dbTheory) return [] as string[];
    const matches = [...dbTheory.matchAll(/^#{1,2}\s+(.+)/gm)];
    return matches.map((m) => (m[1] ?? "").replace(/\*\*/g, "").trim()).filter(Boolean).slice(0, 10);
  }, [dbTheory]);

  const topicHubSections = useMemo(() => {
    if (!topicNode) return [] as string[];
    const source = (topicWhyStudy.trim() || topicIntroMarkdown.trim()).trim();
    if (source) {
      const matches = [...source.matchAll(/^#{1,2}\s+(.+)/gm)]
        .map((m) => (m[1] ?? "").replace(/\*\*/g, "").trim())
        .filter(Boolean);
      if (matches.length > 0) return matches.slice(0, 10);
    }
    return topicNode.subtopics.slice(0, 8).map((s) => humanReadableSubtopicTitle(s.name));
  }, [topicNode, topicWhyStudy, topicIntroMarkdown]);

  // Concept cards for Concepts tab (concept + formula types)
  const conceptCards = useMemo(
    () => sidebarInstaCueCards.filter((c) => c.type === "concept" || c.type === "formula"),
    [sidebarInstaCueCards]
  );

  const CONCEPTS_PER_PAGE = 5;
  const totalConceptPages = Math.ceil(conceptCards.length / CONCEPTS_PER_PAGE);
  const displayedConcepts = useMemo(() => {
    const start = conceptsPage * CONCEPTS_PER_PAGE;
    return conceptCards.slice(start, start + CONCEPTS_PER_PAGE);
  }, [conceptCards, conceptsPage]);

  const conceptsChecklistTotal = totalConceptPages;
  const conceptsChecklistProgress = Math.min(viewedConceptPages.size, conceptsChecklistTotal);

  const allChecklistComplete =
    focusTimerSeconds === 0 &&
    bitsChecklistProgress >= bitsChecklistTotal &&
    instaCueChecklistProgress >= instaCueChecklistTotal &&
    formulaChecklistProgress >= formulaChecklistTotal &&
    conceptsChecklistProgress >= conceptsChecklistTotal;

  const buildEngagementSnapshot = useCallback((): SubtopicEngagementSnapshot | null => {
    if (!engagementScope || dbBitsQuestions.length === 0) return null;
    const bitsDraft =
      bitsAttempt || bitsChecklistTotal === 0
        ? null
        : (() => {
            const selectedAnswers = Object.fromEntries(
              Object.entries(bitsSelectedAnswers).map(([k, v]) => [String(k), v])
            );
            let answered = 0;
            let correct = 0;
            let wrong = 0;
            for (let idx = 0; idx < dbBitsQuestions.length; idx++) {
              const si = bitsSelectedAnswers[idx];
              if (typeof si !== "number") continue;
              answered++;
              const item = dbBitsQuestions[idx];
              if (item.options[si] === item.correctAnswer) correct++;
              else wrong++;
            }
            const graded =
              answered > 0
                ? { answered, correct, wrong, totalQuestions: bitsChecklistTotal }
                : undefined;
            return {
              currentIdx: Math.min(bitsCurrentIdx, Math.max(0, bitsChecklistTotal - 1)),
              selectedAnswers,
              visitedIndices: Array.from(bitsVisitedIndices.values()).sort((a, b) => a - b),
              ...(graded ? { graded } : {}),
            };
          })();
    const mergedFormulas = { ...formulaByIdx };
    if (formulasDialogOpen && selectedFormulaIdx !== null) {
      mergedFormulas[selectedFormulaIdx] = {
        qIdx: formulaBitsCurrentIdx,
        answers: { ...formulaBitsSelectedAnswers },
      };
    }
    const formulaSnap: Record<string, { qIdx: number; answers: Record<string, number> }> = {};
    for (const [k, v] of Object.entries(mergedFormulas)) {
      formulaSnap[String(k)] = {
        qIdx: v.qIdx,
        answers: Object.fromEntries(Object.entries(v.answers).map(([a, b]) => [String(a), b])),
      };
    }
    const nav = Array.from(instaCueNavIndices.values()).sort((a, b) => a - b);
    const flipped = Array.from(instaCueValidatedIndices.values()).sort((a, b) => a - b);
    const conceptsPages = Array.from(viewedConceptPages.values()).sort((a, b) => a - b);
    return {
      v: 1,
      bitsSignature,
      updatedAt: new Date().toISOString(),
      bits: bitsDraft,
      formulaByIdx: Object.keys(formulaSnap).length ? formulaSnap : undefined,
      instaCue: nav.length || flipped.length ? { navVisited: nav, flipped } : undefined,
      conceptsPages: conceptsPages.length ? conceptsPages : undefined,
    };
  }, [
    engagementScope,
    dbBitsQuestions,
    bitsAttempt,
    bitsChecklistTotal,
    bitsCurrentIdx,
    bitsSelectedAnswers,
    bitsVisitedIndices,
    formulaByIdx,
    formulasDialogOpen,
    selectedFormulaIdx,
    formulaBitsCurrentIdx,
    formulaBitsSelectedAnswers,
    instaCueNavIndices,
    instaCueValidatedIndices,
    viewedConceptPages,
    bitsSignature,
  ]);

  const flushSubtopicEngagementNow = useCallback(() => {
    if (engagementSaveTimerRef.current) {
      clearTimeout(engagementSaveTimerRef.current);
      engagementSaveTimerRef.current = null;
    }
    if (!engagementScope || !session?.access_token || isOverview) return;
    const snap = buildEngagementSnapshot();
    if (!snap) return;
    void saveSubtopicEngagement(engagementScope, snap).catch(() => {});
  }, [buildEngagementSnapshot, engagementScope, session?.access_token, isOverview]);

  useEffect(() => {
    if (!engagementScope || !session?.access_token || isOverview) return;
    if (engagementSaveTimerRef.current) clearTimeout(engagementSaveTimerRef.current);
    engagementSaveTimerRef.current = setTimeout(() => {
      const snap = buildEngagementSnapshot();
      if (!snap) return;
      void saveSubtopicEngagement(engagementScope, snap).catch(() => {});
    }, 900);
    return () => {
      if (engagementSaveTimerRef.current) clearTimeout(engagementSaveTimerRef.current);
    };
  }, [buildEngagementSnapshot, engagementScope, session?.access_token, isOverview]);

  // Refs for scroll-sync between theory and concepts panel
  const conceptsScrollRef = useRef<HTMLDivElement>(null);
  const conceptsHoveredRef = useRef(false);

  // Sync theory window scroll → concepts panel scroll proportionally
  useEffect(() => {
    if (!isSubtopicDashboardLayout) return;
    const onScroll = () => {
      if (conceptsHoveredRef.current) return; // user is scrolling concepts independently
      const el = conceptsScrollRef.current;
      if (!el) return;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      if (docH <= 0) return;
      const ratio = window.scrollY / docH;
      const elMax = el.scrollHeight - el.clientHeight;
      if (elMax > 0) el.scrollTop = ratio * elMax;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isSubtopicDashboardLayout]);

  // Track which theory section is in view for left sidebar highlight (scroll-based)
  useEffect(() => {
    if (!isSubtopicDashboardLayout || dbTheorySections.length === 0) return;
    let headings: HTMLElement[] = [];
    let removeScroll: (() => void) | null = null;

    const timer = setTimeout(() => {
      const theoryCard = document.querySelector("[data-theory-card]");
      if (!theoryCard) return;
      headings = Array.from(theoryCard.querySelectorAll<HTMLElement>("h2"));
      if (headings.length === 0) return;

      const update = () => {
        // "trigger line" = 30% from top of viewport
        const triggerY = window.scrollY + window.innerHeight * 0.3;
        let activeIdx = 0; // default = Theory Overview
        headings.forEach((h, i) => {
          const top = h.getBoundingClientRect().top + window.scrollY;
          if (top <= triggerY) activeIdx = i + 1;
        });
        setActiveSectionIdx(activeIdx);
      };

      window.addEventListener("scroll", update, { passive: true });
      update();
      removeScroll = () => window.removeEventListener("scroll", update);
    }, 600);

    return () => {
      clearTimeout(timer);
      removeScroll?.();
    };
  }, [isSubtopicDashboardLayout, dbTheorySections, dbTheory]);

  // Topic hub (overview): sync left "Theory overview" nav with markdown headings in the hub body
  useEffect(() => {
    if (!isInvestorTopicHubLayout || topicHubSections.length === 0) return;
    let headings: HTMLElement[] = [];
    let removeScroll: (() => void) | null = null;

    const timer = setTimeout(() => {
      const theoryCard = document.querySelector("[data-theory-card]");
      const theoryBody = theoryCard?.querySelector<HTMLElement>("[data-topic-hub-theory]");
      if (!theoryBody) {
        setActiveSectionIdx(0);
        return;
      }
      headings = Array.from(theoryBody.querySelectorAll<HTMLElement>("h1, h2"));
      if (headings.length === 0) {
        setActiveSectionIdx(0);
        return;
      }

      const update = () => {
        // Viewport-relative trigger (30% from top); works regardless of scroll root quirks
        const triggerLine = window.innerHeight * 0.3;
        let activeIdx = 0;
        const limit = Math.min(headings.length, topicHubSections.length);
        for (let i = 0; i < limit; i++) {
          const h = headings[i];
          if (h.getBoundingClientRect().top <= triggerLine) activeIdx = i + 1;
        }
        setActiveSectionIdx(activeIdx);
      };

      window.addEventListener("scroll", update, { passive: true });
      update();
      removeScroll = () => window.removeEventListener("scroll", update);
    }, 600);

    return () => {
      clearTimeout(timer);
      removeScroll?.();
    };
  }, [
    isInvestorTopicHubLayout,
    topicHubSections,
    topicWhyStudy,
    topicIntroMarkdown,
    topicContentExists,
    topicContentLoading,
    difficultyLevel,
    topicNode?.topic,
  ]);

  if (taxonomyLoading) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto w-full min-w-0 px-4 -mt-6 pt-2 pb-6">
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="h-9 w-24 rounded-full bg-muted animate-pulse" />
            <div className="h-8 w-24 rounded-full bg-muted animate-pulse" />
            <div className="h-8 w-28 rounded-full bg-muted animate-pulse" />
            <div className="h-8 w-20 rounded-full bg-muted animate-pulse" />
          </div>
          <div className="mb-4 space-y-2">
            <div className="h-4 w-64 max-w-full rounded bg-muted animate-pulse" />
            <div className="h-3 w-48 max-w-full rounded bg-muted/70 animate-pulse" />
          </div>
          <div className="flex flex-col lg:flex-row gap-6">
            <aside className="hidden lg:flex lg:w-44 shrink-0">
              <div className="w-full rounded-2xl border border-border p-3 space-y-3">
                <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                <div className="space-y-1.5">
                  <div className="h-7 w-full rounded-lg bg-muted/70 animate-pulse" />
                  <div className="h-7 w-[90%] rounded-lg bg-muted/60 animate-pulse" />
                  <div className="h-7 w-[85%] rounded-lg bg-muted/60 animate-pulse" />
                </div>
                <div className="h-px w-full bg-border" />
                <div className="space-y-1.5">
                  <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                  <div className="h-6 w-full rounded bg-muted/60 animate-pulse" />
                  <div className="h-6 w-full rounded bg-muted/60 animate-pulse" />
                </div>
                <div className="h-20 w-full rounded-xl border border-dashed border-border bg-muted/30 animate-pulse" />
              </div>
            </aside>

            <div className="flex-1 min-w-0 rounded-2xl border-2 border-border p-6 space-y-4">
              <div className="h-4 w-24 rounded bg-muted animate-pulse ml-auto" />
              <div className="h-10 w-3/4 max-w-md rounded-lg bg-muted animate-pulse" />
              <div className="flex gap-2">
                <div className="h-10 w-24 rounded-xl bg-muted animate-pulse" />
                <div className="h-10 w-28 rounded-xl bg-muted/70 animate-pulse" />
                <div className="h-10 w-24 rounded-xl bg-muted/70 animate-pulse" />
              </div>
              <div className="h-6 w-28 rounded bg-muted animate-pulse" />
              <div className="rounded-2xl border border-dashed border-border p-4 space-y-2">
                <div className="h-4 w-[55%] rounded bg-muted animate-pulse" />
                <div className="h-3 w-full rounded bg-muted/70 animate-pulse" />
                <div className="h-3 w-[92%] rounded bg-muted/70 animate-pulse" />
                <div className="h-3 w-[80%] rounded bg-muted/70 animate-pulse" />
                <div className="h-28 w-full rounded-xl bg-muted/60 animate-pulse mt-2" />
            </div>
              <div className="h-10 w-44 rounded-xl bg-muted animate-pulse" />
            </div>

            <aside className="w-full lg:w-72 xl:w-80 shrink-0 min-w-0 lg:min-w-[18rem]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-border p-3 space-y-3">
                  <div className="h-9 w-full rounded-xl bg-muted/70 animate-pulse" />
                  <div className="h-14 w-full rounded-xl border border-dashed border-border bg-muted/30 animate-pulse" />
                </div>
                <div className="rounded-2xl border border-border p-4 space-y-3">
                  <div className="h-4 w-36 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-full rounded bg-muted/70 animate-pulse" />
                  <div className="space-y-2">
                    <div className="h-11 w-full rounded-xl bg-muted/60 animate-pulse" />
                    <div className="h-11 w-full rounded-xl bg-muted/60 animate-pulse" />
                    <div className="h-11 w-full rounded-xl bg-muted/60 animate-pulse" />
                  </div>
                </div>
              </div>
            </aside>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-8">Loading syllabus and topic…</p>
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

  const backHref = isMagicWallSource 
    ? "/magic-wall" 
    : `/explore-1?subject=${topicNode.subject}&class=${topicNode.classLevel}&unit=${unitSlug}`;
  const spinAgainHref = `/explore-1?subject=${topicNode.subject}&class=${topicNode.classLevel}&unit=${unitSlug}&spin=1`;

  const allStackPlaceholders =
    subtopicStackRows.length > 0 && subtopicStackRows.every((r) => r.isPh);
  const activeTheory = dbTheoryExists ? dbTheory : focusedSubtopicTheoryData?.theory ?? "";
  const focusedTheoryIsPh =
    !focusedSubtopicTheoryData ||
    (!dbTheoryExists && subtopicTheoryIsPlaceholder(focusedSubtopicTheoryData.theory));
  const overviewHref = appendQueryParams(
    buildTopicOverviewPath(
    board,
    topicNode.subject,
    topicNode.classLevel,
    topicNode.topic,
    difficultyLevel,
    isRandomMode ? "random" : undefined
    ),
    isMagicWallSource ? { source: "magic-wall" } : {}
  );
  /** Subtopic view: top Back goes to topic overview (same as old in-card "Topic overview"). Overview: Back to Explore unit. */
  const topBackHref = isOverview ? backHref : overviewHref;
  const prevSubtopic = !isOverview && subtopicIndex > 0 ? topicNode.subtopics[subtopicIndex - 1] : null;
  const nextSubtopic =
    !isOverview && subtopicIndex < topicNode.subtopics.length - 1 ? topicNode.subtopics[subtopicIndex + 1] : null;
  const prevSubtopicHref = prevSubtopic
    ? appendQueryParams(
        buildTopicPath(
        board,
        topicNode.subject,
        topicNode.classLevel,
        topicNode.topic,
        prevSubtopic.name,
        difficultyLevel,
        isRandomMode ? "random" : undefined
        ),
        isMagicWallSource ? { source: "magic-wall" } : {}
      )
    : null;
  const nextSubtopicHref = nextSubtopic
    ? appendQueryParams(
        buildTopicPath(
        board,
        topicNode.subject,
        topicNode.classLevel,
        topicNode.topic,
        nextSubtopic.name,
        difficultyLevel,
        isRandomMode ? "random" : undefined
        ),
        isMagicWallSource ? { source: "magic-wall" } : {}
      )
    : null;
  const dashedBorderClass = `border-dashed ${
    ["border-primary/50", "border-emerald-500/50", "border-amber-500/50", "border-violet-500/50"][
      (isOverview ? 0 : subtopicIndex) % 4
    ]
  } bg-muted/10`;
  const mainCardBorderClass = isOverview
    ? allStackPlaceholders
      ? dashedBorderClass
      : "border-primary/30 ring-2 ring-primary/20"
    : focusedTheoryIsPh
      ? dashedBorderClass
      : "border-primary/30 ring-2 ring-primary/20";

  return (
    <AppLayout>
      {isMagicWallSource ? (
        <>
          <button
            type="button"
            onClick={() => setMagicWallQueueOpen(true)}
            className="fixed z-[45] left-0 top-[max(7rem,28vh)] flex h-[4.25rem] w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-r-2xl border-y border-r border-violet-500/45 bg-gradient-to-b from-violet-600 to-violet-700 text-white shadow-lg shadow-violet-950/25 hover:from-violet-500 hover:to-violet-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label="Open Magic Wall reading queue"
            aria-expanded={magicWallQueueOpen}
            aria-controls="magic-wall-queue-sheet"
          >
            <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
            <span className="text-[9px] font-extrabold uppercase tracking-tight leading-tight text-center px-0.5">
              Wall
            </span>
          </button>

          <Sheet open={magicWallQueueOpen} onOpenChange={setMagicWallQueueOpen}>
            <SheetContent
              id="magic-wall-queue-sheet"
              side="left"
              className="w-[min(22rem,100vw)] min-w-0 max-w-[22rem] overflow-hidden border-r border-violet-500/25 bg-background p-0 sm:max-w-[22rem]"
            >
              <div className="flex h-full min-h-0 flex-col p-5 pt-12">
                <SheetHeader className="space-y-1 border-b border-border pb-4 text-left">
                  <SheetTitle className="flex items-center gap-2 text-base text-violet-600 dark:text-violet-400">
                    <Sparkles className="h-4 w-4 shrink-0" />
                    Magic Wall Queue
                  </SheetTitle>
                  <SheetDescription>Your reading basket from the Magic Wall.</SheetDescription>
                </SheetHeader>
                <div className="min-h-0 flex-1 overflow-y-auto py-4">
                  {loadingMagicWallBasket ? (
                    <div className="flex items-center justify-center p-6">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : magicWallBasket.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Queue is empty.</p>
                  ) : (
                    <ul className="space-y-2">
                      {magicWallBasket.map((item, idx) => {
                        const isCurrent = item.topicKey === currentTopicKey;
                        return (
                          <li key={item.topicKey}>
                            <Link
                              href={appendQueryParams(
                                buildTopicOverviewPath(
                                  board,
                                  item.subject,
                                  item.classLevel,
                                  item.topicName,
                                  difficultyLevel,
                                  undefined,
                                  item.chapterTitle
                                ),
                                { source: "magic-wall" }
                              )}
                              onClick={() => setMagicWallQueueOpen(false)}
                              className={`block w-full text-left p-3 rounded-xl border transition-all ${
                                isCurrent
                                  ? "bg-violet-500 border-violet-500 text-white shadow-md"
                                  : "bg-background/50 border-border/50 text-foreground hover:bg-muted/80 hover:border-border"
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <span
                                  className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                                    isCurrent ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {idx + 1}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className={`text-sm font-bold truncate ${isCurrent ? "text-white" : ""}`}>
                                    {item.topicName}
                                  </p>
                                  <p
                                    className={`text-[10px] truncate mt-0.5 ${
                                      isCurrent ? "text-white/80" : "text-muted-foreground"
                                    }`}
                                  >
                                    {item.subject.toUpperCase()} · C{item.classLevel}
                                  </p>
                                </div>
                              </div>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </>
      ) : null}

      <>
        <button
          type="button"
          onClick={() => setProgressQueueOpen(true)}
          className={`fixed z-[44] left-0 flex h-[4.25rem] w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-r-2xl border-y border-r border-blue-500/45 bg-gradient-to-b from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-950/25 hover:from-blue-500 hover:to-blue-600 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
            isMagicWallSource ? "top-[calc(max(7rem,28vh)+4.75rem)]" : "top-[max(7rem,28vh)]"
          }`}
          aria-label="Open Topic Progress Checklist"
          aria-expanded={progressQueueOpen}
        >
          <ListChecks className="h-5 w-5 shrink-0" aria-hidden />
          <span className="text-[9px] font-extrabold uppercase tracking-tight leading-tight text-center px-0.5">
            Progress
          </span>
        </button>

        {progressQueueOpen ? (
          <>
            <button
              type="button"
              aria-label="Close progress popup backdrop"
              className="fixed inset-0 z-[47] bg-black/30 backdrop-blur-[1px]"
              onClick={() => setProgressQueueOpen(false)}
            />
            <div
              className={`fixed z-[48] left-[4.15rem] w-[min(84vw,24rem)] max-h-[68vh] rounded-2xl border border-blue-500/35 bg-gradient-to-b from-background via-background to-blue-950/20 shadow-2xl shadow-blue-950/35 overflow-hidden font-sans ${
                isMagicWallSource ? "top-[calc(max(7rem,28vh)+4.5rem)]" : "top-[max(7rem,28vh)]"
              }`}
              role="dialog"
              aria-modal="true"
              aria-label="Lessons and Progress checklist"
            >
              <div className="absolute -left-1.5 top-7 h-3 w-3 rotate-45 border-l border-t border-blue-500/40 bg-background/95" />
              <div className="border-b border-border/80 px-4 pt-4 pb-3 text-left">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-500">
                      <ListChecks className="h-3.5 w-3.5 shrink-0" />
                      Lessons / Progress
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Track your mastery on this topic with a compact checklist.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close progress popup"
                    className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full border border-border/70 bg-background/60 text-muted-foreground hover:text-foreground"
                    onClick={() => setProgressQueueOpen(false)}
                  >
                    ×
                  </button>
                </div>
              </div>
              <div className="max-h-[52vh] overflow-y-auto px-4 py-3.5">
                {isOverview ? (
                  <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-4 text-center">
                    <div className="mx-auto mb-2.5 flex h-10 w-10 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10">
                      <ListChecks className="h-5 w-5 text-blue-400" />
                    </div>
                    <p className="text-xs font-medium text-foreground">
                      To get into progress, go to a subtopic and complete the checklist so your topic moves into progress.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs font-semibold text-foreground/90">Complete these actions for concept mastery:</p>
                    <ul className="space-y-2.5">
                      {TOPIC_PROGRESS_CHECKLIST.map((item) => (
                        <li
                          key={item.number}
                          className={`rounded-xl border bg-background/60 px-3 py-2.5 backdrop-blur-sm transition-all ${item.borderClass} ${item.glowClass}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <div
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-extrabold ${item.badgeClass}`}
                              >
                                {item.number}
                              </div>
                              <p className="text-[13px] font-semibold leading-5 text-foreground">
                                {item.number === 3
                                  ? `Scroll and see all ${instaCueChecklistTotal} Insta Que cards`
                                  : item.text}
                              </p>
                            </div>
                            {item.number === 1 ? (
                              <div className="shrink-0 flex items-center gap-1.5">
                                <span className="rounded-md border border-blue-400/40 bg-blue-500/10 px-2 py-1 text-[11px] font-bold text-blue-300 tabular-nums">
                                  {formatFocusTimer(focusTimerSeconds)}
                                </span>
                                {focusTimerSeconds === 0 ? (
                                  <span className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 text-[11px] font-bold text-emerald-300">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Done
                                  </span>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setFocusTimerRunning((prev) => !prev)}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-400/40 bg-background/70 text-blue-300 hover:bg-blue-500/10"
                                      aria-label={
                                        focusTimerRunning ? "Pause 10 minute timer" : "Resume 10 minute timer"
                                      }
                                    >
                                      {focusTimerRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFocusTimerSeconds(FOCUS_TIMER_INITIAL_SECONDS);
                                        setFocusTimerRunning(true);
                                      }}
                                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-blue-400/40 bg-background/70 text-blue-300 hover:bg-blue-500/10"
                                      aria-label="Reset 10 minute timer"
                                    >
                                      <RotateCcw className="h-3.5 w-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            ) : item.number === 2 ? (
                              <div className="shrink-0 flex flex-wrap items-center justify-end gap-1.5">
                                <span className="rounded-md border border-cyan-400/40 bg-cyan-500/10 px-2 py-1 text-[11px] font-bold text-cyan-300 tabular-nums">
                                  {bitsChecklistProgress}/{bitsChecklistTotal}
                                </span>
                                {bitsAttempt ? (
                                  <span className="inline-flex items-center gap-0.5 rounded-md border border-emerald-400/50 bg-emerald-500/15 px-2 py-1 text-[11px] font-bold text-emerald-300 tabular-nums">
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden />
                                    {bitsAttempt.correctCount}
                                  </span>
                                ) : null}
                              </div>
                            ) : item.number === 3 ? (
                              <span className="shrink-0 rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-bold text-emerald-300 tabular-nums">
                                {instaCueChecklistProgress}/{instaCueChecklistTotal}
                              </span>
                            ) : item.number === 4 ? (
                              <span className="shrink-0 rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-[11px] font-bold text-amber-300 tabular-nums">
                                {formulaChecklistProgress}/{formulaChecklistTotal}
                              </span>
                            ) : item.number === 5 ? (
                              <span className="shrink-0 rounded-md border border-rose-400/40 bg-rose-500/10 px-2 py-1 text-[11px] font-bold text-rose-200 tabular-nums">
                                {conceptsChecklistProgress}/{conceptsChecklistTotal}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-xl font-bold"
                        title={
                          allChecklistComplete
                            ? undefined
                            : "Complete every checklist item above first — then you can mark as complete."
                        }
                        onClick={() => {
                          if (!allChecklistComplete) {
                            toast({
                              title: "Complete all progress first",
                              description:
                                "Finish every checklist step above (timer, quiz, Insta Que, numerals, concepts). Then mark as complete.",
                              className:
                                "border-2 border-primary shadow-xl shadow-primary/25 ring-2 ring-primary/50 ring-offset-2 ring-offset-background",
                              duration: 5500,
                              hideCloseButton: true,
                            });
                            return;
                          }
                          toast({ title: "Topic marked as complete!" });
                        }}
                      >
                        Mark as complete
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl font-bold"
                        onClick={() => {
                          setFocusTimerSeconds(FOCUS_TIMER_INITIAL_SECONDS);
                          setFocusTimerRunning(false);
                          setBitsVisitedIndices(new Set());
                          setInstaCueValidatedIndices(new Set());
                          setInstaCueNavIndices(new Set());
                          setFormulaBitsSelectedAnswers({});
                          setFormulaByIdx({});
                          setViewedConceptPages(new Set([0]));
                          setConceptsPage(0);
                          setBitsAttempt(null);
                          engagementHydratedRef.current = null;
                          if (engagementScope && session?.access_token && bitsSignature) {
                            void saveSubtopicEngagement(engagementScope, {
                              v: 1,
                              bitsSignature,
                              updatedAt: new Date().toISOString(),
                              bits: null,
                              formulaByIdx: {},
                              instaCue: null,
                              conceptsPages: [0],
                            }).catch(() => {});
                          }
                        }}
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </>

      <div className="max-w-6xl mx-auto w-full min-w-0 px-4 -mt-6 pt-2 pb-6">
        <div className="mb-6 flex flex-wrap items-center gap-2 sm:gap-3">
          <Button variant="ghost" size="sm" asChild className="rounded-full font-bold -ml-1 shrink-0">
            <Link href={topBackHref}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Link>
          </Button>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-sm font-bold text-primary shrink-0">
            <Zap className="w-4 h-4" />
            {topicNode.subject.charAt(0).toUpperCase() + topicNode.subject.slice(1)}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-muted text-sm font-bold text-muted-foreground shrink-0">
            Class {topicNode.classLevel}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-primary/10 text-sm font-bold text-primary shrink-0">
            {(params.board as string).toUpperCase()}
          </span>
          {topicNode.chapterTitle ? (
            <span
              className="inline-flex min-w-0 max-w-full items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-muted/80 text-sm font-bold text-foreground sm:max-w-[min(100%,20rem)]"
              title={topicNode.chapterTitle}
            >
              <span className="shrink-0 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
                Chapter
              </span>
              <span className="truncate">{topicNode.chapterTitle}</span>
            </span>
          ) : null}
          <span
            className="inline-flex min-w-0 max-w-full items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/80 bg-muted/80 text-sm font-bold text-foreground sm:max-w-[min(100%,22rem)]"
            title={topicNode.topic}
          >
            <span className="shrink-0 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
              Topic
            </span>
            <span className="truncate">{topicNode.topic}</span>
          </span>
          {!isOverview && (
            <Button
              variant={isSavedForRevision ? "secondary" : "outline"}
              size="sm"
              onClick={handleToggleRevisionUnit}
              className="rounded-full font-bold border-primary/30 text-primary hover:bg-primary/10 sm:ml-auto"
            >
              <Bookmark
                className={`w-4 h-4 mr-1.5 shrink-0 ${isSavedForRevision ? "fill-current" : ""}`}
              />
              {isSavedForRevision ? "Saved for revision" : "Save revision"}
            </Button>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-6 min-w-0 max-w-full">

          {/* ── LEFT SIDEBAR (desktop only, investor topic-hub override) ── */}
          {isInvestorTopicHubLayout && (
            <aside className="hidden lg:flex flex-col w-44 shrink-0">
              <div className="sticky top-24 space-y-5 text-sm">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Theory Overview
                  </h4>
                  <ul className="space-y-0.5">
                    <li
                      className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        activeSectionIdx === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {activeSectionIdx === 0 && <span className="text-green-600 shrink-0">✓</span>}
                      Topic Hub
                    </li>
                    {topicHubSections.map((title, i) => (
                      <li
                        key={title}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors truncate cursor-default ${
                          activeSectionIdx === i + 1 ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-muted/60"
                        }`}
                        title={title}
                      >
                        {title}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Topic Snapshot
                  </h4>
                  <ul className="space-y-2 px-1">
                    <li className="flex items-center justify-between gap-1">
                      <span className="text-xs text-muted-foreground">Subtopics</span>
                      <span className="text-xs font-bold text-foreground">{topicNode.subtopics.length}</span>
                    </li>
                    <li className="flex items-center justify-between gap-1">
                      <span className="text-xs text-muted-foreground">Subject</span>
                      <span className="text-xs font-bold text-primary capitalize">{topicNode.subject}</span>
                    </li>
                    <li className="flex items-center justify-between gap-1">
                      <span className="text-xs text-muted-foreground">Level</span>
                      <span className="text-xs font-bold text-primary capitalize">{difficultyLevel}</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-edu-yellow/10 border border-edu-yellow/30 rounded-xl p-3">
                  <p className="text-[10px] font-extrabold text-edu-orange uppercase mb-1 tracking-wide">
                    Learning Flow
                  </p>
                  <p className="text-[11px] text-foreground/80 leading-snug">
                    Open a subtopic below to access InstaCue cards, Quiz (Bits), Numerals, and Concepts.
                  </p>
                </div>
              </div>
            </aside>
          )}

          {/* ── LEFT SIDEBAR (desktop only, subtopic view) ── */}
          {isSubtopicDashboardLayout && (
            <aside className="hidden lg:flex flex-col w-44 shrink-0">
              <div className="sticky top-24 space-y-5 text-sm">

                {/* Theory sections list */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Theory Overview
                  </h4>
                  <ul className="space-y-0.5">
                    <li className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-bold transition-colors ${activeSectionIdx === 0 ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/60"}`}>
                      {activeSectionIdx === 0 && <span className="text-green-600 shrink-0">✓</span>}
                      Theory Overview
                    </li>
                    {dbTheorySections.map((title, i) => (
                      <li
                        key={title}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-colors truncate cursor-default ${activeSectionIdx === i + 1 ? "bg-primary/10 text-primary font-bold" : "text-muted-foreground hover:bg-muted/60"}`}
                        title={title}
                      >
                        {title}
                      </li>
                    ))}
                  </ul>
        </div>

                {/* Topic Snapshot */}
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                    Topic Snapshot
                  </h4>
                  <ul className="space-y-2 px-1">
                    <li className="flex items-center justify-between gap-1">
                      <span className="text-xs text-muted-foreground">Difficulty</span>
                      <span className="text-xs font-bold text-amber-600">★★★ Moderate</span>
                    </li>
                    <li className="flex items-center justify-between gap-1">
                      <span className="text-xs text-muted-foreground">Exam Weight</span>
                      <span className="text-xs font-bold text-red-600">High · JEE/NEET</span>
                    </li>
                    <li className="flex items-center justify-between gap-1">
                      <span className="text-xs text-muted-foreground">Level</span>
                      <span className="text-xs font-bold text-primary capitalize">{difficultyLevel}</span>
                    </li>
                  </ul>
                </div>

                {/* Quiz progress */}
                {bitsAttempt && (
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 px-1">
                      Your Progress
                    </h4>
                    <div className="px-1 space-y-2">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">Quiz score</span>
                          <span className="font-bold text-foreground">
                            {bitsAttempt.totalQuestions > 0
                              ? `${Math.round((bitsAttempt.correctCount / bitsAttempt.totalQuestions) * 100)}%`
                              : "0%"}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{
                              width: bitsAttempt.totalQuestions > 0
                                ? `${Math.round((bitsAttempt.correctCount / bitsAttempt.totalQuestions) * 100)}%`
                                : "0%",
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Did You Know */}
                {dbDidYouKnow && (
                  <div className="bg-edu-yellow/10 border border-edu-yellow/30 rounded-xl p-3">
                    <p className="text-[10px] font-extrabold text-edu-orange uppercase mb-1 tracking-wide">
                      Did You Know?
                    </p>
                    <p className="text-[11px] text-foreground/80 leading-snug">{dbDidYouKnow}</p>
                  </div>
                )}
              </div>
            </aside>
          )}

          <main className="flex-1 min-w-0">
            <div
              data-theory-card
              className={`edu-card p-6 rounded-2xl border-2 shadow-lg min-w-0 max-w-full ${mainCardBorderClass}`}
            >
              {isOverview ? (
                <>
                  <div className="flex justify-end mb-3">
                    <span className="text-sm font-extrabold text-muted-foreground">Topic hub</span>
                  </div>
                  <h1 className="font-black text-3xl tracking-tight text-foreground mb-4">{topicNode.topic}</h1>

                  {mode === "linear" && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {LEVELS.map(({ value, label }) => {
                        const href = appendQueryParams(
                          buildTopicOverviewPath(
                          board,
                          topicNode.subject,
                          topicNode.classLevel,
                          topicNode.topic,
                          value,
                          isRandomMode ? "random" : undefined
                          ),
                          isMagicWallSource ? { source: "magic-wall" } : {}
                        );
                        const isActive = difficultyLevel === value;
                        return (
                          <Link
                            key={value}
                            href={href}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                              isActive
                                ? "bg-primary text-primary-foreground shadow-md"
                                : "bg-muted text-muted-foreground hover:bg-muted/80"
                            }`}
                          >
                            {label}
                          </Link>
                        );
                      })}
                    </div>
                  )}

                  <section className="mb-8 pb-6 border-b border-border">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                      <h2 className="text-base font-extrabold text-primary uppercase tracking-wide">
                        Topic hub
                      </h2>
                      {canEditTopicContent ? (
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold px-2 py-1 rounded-full bg-muted text-muted-foreground">
                            Admin
                          </span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="rounded-xl gap-2 font-bold shrink-0"
                            disabled={generatingTopic || savingTopicContent}
                            onClick={() => {
                              if (topicEditorOpen) {
                                setTopicEditorOpen(false);
                              } else {
                                setDraftTopicWhyStudy(topicWhyStudy);
                                setDraftTopicSubtopicPreviews(buildTopicHubDraftPreviews());
                                setTopicEditorOpen(true);
                              }
                            }}
                            title="Edit topic intro and each subtopic preview card"
                          >
                            {topicEditorOpen ? "Close Edit" : "Edit"}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="rounded-xl gap-2 font-bold shrink-0"
                            disabled={generatingTopic || topicContentLoading || !topicNode}
                            title={
                              topicContentExists
                                ? "Regenerate only this topic’s hub (separate row from chapter overview in Supabase)"
                                : "Generate topic hub with AI"
                            }
                            onClick={async () => {
                              if (!topicNode) return;
                            if (topicContentExists) {
                              setFbLiked("");
                              setFbDisliked("");
                              setFbInstructions("");
                              setTopicRegenFeedbackOpen(true);
                              return;
                            }
                            const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
                            setGeneratingTopic(true);
                            try {
                              const out = await generateTopicContent({
                                board: boardName,
                                subject: topicNode.subject,
                                classLevel: topicNode.classLevel,
                                topic: topicNode.topic,
                                level: difficultyLevel,
                                unitLabel: topicNode.unitLabel,
                                unitTitle: topicNode.unitTitle,
                                chapterTitle: topicNode.chapterTitle,
                                subtopicNames: topicNode.subtopics.map((s) => s.name),
                                mode: "generate",
                                includeTrace: true,
                              });
                              setTopicWhyStudy(out.whyStudy);
                              setTopicSubtopicPreviews(out.subtopicPreviews ?? []);
                              setTopicContentExists(true);
                              setTopicAgentTrace(out.trace ?? null);
                              toast({
                                title: "Topic hub generated",
                                description:
                                  out.ragChunks != null
                                    ? `Saved to Supabase · RAG passages used: ${out.ragChunks}`
                                    : "Saved to Supabase",
                              });
                            } catch (e) {
                              const message = e instanceof Error ? e.message : "Generation failed";
                              toast({ title: message, variant: "destructive" });
                            } finally {
                              setGeneratingTopic(false);
                            }
                          }}
                        >
                          <Sparkles className="w-4 h-4" />
                          {generatingTopic
                            ? topicContentExists
                              ? "Regenerating…"
                              : "Generating…"
                            : topicContentExists
                              ? "Regenerate topic"
                              : "Generate topic hub"}
                        </Button>
                        </div>
                      ) : null}
                    </div>
                    <p className="text-xs text-muted-foreground mb-3">
                      Level-wise topic master guide in educator format. Subtopic cards below are focused previews before deep dive.
                    </p>
                    {canEditTopicContent ? (
                      <TopicAgentTracePanel trace={topicAgentTrace} onClear={() => setTopicAgentTrace(null)} />
                    ) : null}
                    
                    {topicContentLoading ? (
                      <TheoryPanelSkeleton />
                    ) : topicContentExists && topicWhyStudy.trim() ? (
                      <div
                        data-topic-hub-theory
                        className="theory-content text-[15px] leading-relaxed mb-6"
                      >
                        <TheoryContent theory={topicWhyStudy} />
                      </div>
                    ) : !topicContentExists && topicIntroMarkdown.trim() ? (
                      <div
                        data-topic-hub-theory
                        className="theory-content text-[15px] leading-relaxed mb-6"
                      >
                        <TheoryContent theory={topicIntroMarkdown} />
                      </div>
                    ) : null}

                    {topicEditorOpen && canEditTopicContent && (
                      <div className="mb-6 space-y-4 rounded-xl border border-border bg-background/80 p-4">
                        <p className="text-xs font-semibold text-muted-foreground">Topic intro (markdown)</p>
                        <textarea
                          value={draftTopicWhyStudy}
                          onChange={(e) => setDraftTopicWhyStudy(e.target.value)}
                          className="w-full min-h-[140px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                          placeholder="Write cohesive topic intro..."
                        />
                        {topicNode && draftTopicSubtopicPreviews.length > 0 ? (
                          <div className="space-y-3 border-t border-border pt-4">
                            <p className="text-xs font-semibold text-muted-foreground">
                              Subtopic previews (markdown, one card each)
                            </p>
                            <div className="space-y-4 max-h-[min(70vh,520px)] overflow-y-auto pr-1">
                              {draftTopicSubtopicPreviews.map((row, idx) => (
                                <div key={row.subtopicName} className="space-y-1.5">
                                  <p className="text-xs font-bold text-foreground">
                                    {idx + 1}.{" "}
                                    <MathText weight="bold">
                                      {prettifySubtopicTitle(humanReadableSubtopicTitle(row.subtopicName))}
                                    </MathText>
                                  </p>
                                  <textarea
                                    value={row.preview}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setDraftTopicSubtopicPreviews((prev) =>
                                        prev.map((r, i) => (i === idx ? { ...r, preview: v } : r))
                                      );
                                    }}
                                    className="w-full min-h-[100px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                                    placeholder="Preview text for this subtopic card…"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            className="rounded-lg"
                            disabled={savingTopicContent || !topicNode}
                            onClick={async () => {
                              if (!topicNode) return;
                              const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
                              setSavingTopicContent(true);
                              try {
                                await upsertTopicContent({
                                  board: boardName,
                                  subject: topicNode.subject,
                                  classLevel: topicNode.classLevel,
                                  topic: topicNode.topic,
                                  level: difficultyLevel,
                                  hubScope: "topic",
                                  whyStudy: draftTopicWhyStudy,
                                  whatLearn: "",
                                  realWorld: "",
                                  subtopicPreviews: draftTopicSubtopicPreviews,
                                });
                                setTopicWhyStudy(draftTopicWhyStudy);
                                setTopicSubtopicPreviews(draftTopicSubtopicPreviews);
                                setTopicContentExists(true);
                                setTopicEditorOpen(false);
                                toast({ title: "Topic hub updated" });
                              } catch (e) {
                                const message = e instanceof Error ? e.message : "Save failed";
                                toast({ title: message, variant: "destructive" });
                              } finally {
                                setSavingTopicContent(false);
                              }
                            }}
                          >
                            {savingTopicContent ? "Saving…" : "Save"}
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            disabled={savingTopicContent}
                            onClick={() => {
                              setDraftTopicWhyStudy(topicWhyStudy);
                              setDraftTopicSubtopicPreviews(buildTopicHubDraftPreviews());
                              setTopicEditorOpen(false);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    <Dialog open={topicRegenFeedbackOpen} onOpenChange={setTopicRegenFeedbackOpen}>
                      <DialogContent className="rounded-2xl max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Regenerate topic hub</DialogTitle>
                          <DialogDescription>
                            Updates only <span className="font-semibold text-foreground">{topicNode.topic}</span> for
                            this level. A full-chapter overview from Explore is saved separately and is not changed
                            when you regenerate here.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3">
                          <div>
                            <p className="text-xs font-bold text-muted-foreground mb-1">What did you like? (keep)</p>
                            <textarea
                              value={fbLiked}
                              onChange={(e) => setFbLiked(e.target.value)}
                              className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                              placeholder="Sections or tone to preserve…"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-muted-foreground mb-1">What should improve?</p>
                            <textarea
                              value={fbDisliked}
                              onChange={(e) => setFbDisliked(e.target.value)}
                              className="w-full min-h-[80px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                              placeholder="What felt weak, too long, or off-syllabus…"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-bold text-muted-foreground mb-1">Any extra instruction?</p>
                            <textarea
                              value={fbInstructions}
                              onChange={(e) => setFbInstructions(e.target.value)}
                              className="w-full min-h-[72px] rounded-lg border border-border bg-background px-3 py-2 text-sm"
                              placeholder="Tone, depth, language, exam focus…"
                            />
                          </div>
                        </div>
                        <DialogFooter className="gap-2 sm:gap-0">
                          <Button
                            type="button"
                            variant="outline"
                            className="rounded-lg"
                            onClick={() => setTopicRegenFeedbackOpen(false)}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="button"
                            className="rounded-lg"
                            disabled={generatingTopic || !topicNode || !canEditTopicContent}
                            onClick={async () => {
                              if (!topicNode || !canEditTopicContent) return;
                              const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
                              setTopicRegenFeedbackOpen(false);
                              setGeneratingTopic(true);
                              try {
                                const out = await generateTopicContent({
                                  board: boardName,
                                  subject: topicNode.subject,
                                  classLevel: topicNode.classLevel,
                                  topic: topicNode.topic,
                                  level: difficultyLevel,
                                  unitLabel: topicNode.unitLabel,
                                  unitTitle: topicNode.unitTitle,
                                  chapterTitle: topicNode.chapterTitle,
                                  subtopicNames: topicNode.subtopics.map((s) => s.name),
                                  mode: "regenerate",
                                  feedback: {
                                    liked: fbLiked,
                                    disliked: fbDisliked,
                                    instructions: fbInstructions,
                                  },
                                  includeTrace: true,
                                });
                                setTopicWhyStudy(out.whyStudy);
                                setTopicSubtopicPreviews(out.subtopicPreviews ?? []);
                                setTopicContentExists(true);
                                setTopicAgentTrace(out.trace ?? null);
                                toast({
                            title: "Topic hub regenerated",
                            description:
                              out.ragChunks != null
                                ? `Saved to Supabase · RAG passages used: ${out.ragChunks}`
                                : "Saved to Supabase",
                          });
                        } catch (e) {
                          const message = e instanceof Error ? e.message : "Regeneration failed";
                          toast({ title: message, variant: "destructive" });
                        } finally {
                          setGeneratingTopic(false);
                        }
                      }}
                    >
                      {generatingTopic ? "Regenerating…" : "Submit & regenerate"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

              <h2 className="text-sm font-bold text-primary uppercase tracking-wide mb-4 mt-2">
                Subtopics ({difficultyLevel === "intermediate" ? "Intermediate" : difficultyLevel === "advanced" ? "Advanced" : "Basic"} preview cards)
              </h2>
              <div className="space-y-6">
                    {subtopicStackRows.map((row, idx) => {
                      const generatedPreview = topicPreviewByName.get(row.name) ?? "";
                      const displayText = formatSubtopicPreviewText(
                        generatedPreview || truncateForStack(row.theoryFull, SUBTOPIC_STACK_PREVIEW_CHARS)
                      );
                      return (
                        <section
                          key={row.name}
                          className="rounded-2xl border-2 border-border bg-muted/20 p-4 sm:p-5 transition-shadow min-w-0 max-w-full overflow-x-clip"
                        >
                          <h3 className="font-extrabold text-base flex min-w-0 max-w-full items-start gap-2 mb-3">
                            <span className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-extrabold text-black dark:text-white shrink-0">
                              {idx + 1}
                            </span>
                            <span className="subtopic-title-text min-w-0 flex-1 max-w-full">
                            <MathText
                              weight="extrabold"
                                className="[&_.katex]:!text-[0.88em] sm:[&_.katex]:!text-[0.92em]"
                                title={subtopicNavPreviewLine(row.name)}
                            >
                                {subtopicMathTextLabel(row.name)}
                            </MathText>
                            </span>
                          </h3>
                          {!generatedPreview && row.isPh ? (
                            <div
                              className={`min-h-[100px] rounded-xl border-2 border-dashed flex items-center justify-center p-5 text-center ${["border-primary/40", "border-emerald-500/40", "border-amber-500/40", "border-violet-500/40"][idx % 4]}`}
                            >
                              <p className="text-muted-foreground text-sm">
                                Content coming soon. Refer to your textbook for this subtopic.
                              </p>
                            </div>
                          ) : (
                            <div className="theory-content text-[15px] leading-relaxed text-muted-foreground min-w-0 max-w-full [overflow-wrap:anywhere] break-words">
                              <TheoryContent theory={displayText} />
                            </div>
                          )}
                        </section>
                      );
                    })}
                  </div>
                </section>

                {!isRandomMode && (topicLevelSiblings.prev || topicLevelSiblings.next) && (
                  <nav
                    className="mt-10 pt-8 border-t border-border"
                    aria-label="Previous and next syllabus topic in this chapter"
                  >
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
                      {isMagicWallSource ? "Magic Wall Reading Basket" : "More in this chapter"}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {topicLevelSiblings.prev ? (
                        <Button
                          asChild
                          variant="outline"
                          className="h-auto min-h-[3.25rem] w-full justify-start rounded-xl border-2 px-4 py-3 font-semibold shadow-sm hover:bg-muted/50"
                        >
                          <Link
                            href={appendQueryParams(
                              buildTopicOverviewPath(
                              board,
                              topicLevelSiblings.prev.subject,
                              topicLevelSiblings.prev.classLevel,
                              topicLevelSiblings.prev.topic,
                              difficultyLevel,
                              isRandomMode ? "random" : undefined
                              ),
                              isMagicWallSource ? { source: "magic-wall" } : {}
                            )}
                            className="flex w-full items-center gap-3 text-left"
                          >
                            <ChevronLeft className="size-5 shrink-0 text-primary" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                                Previous topic
                              </span>
                              <span className="block truncate text-sm font-bold text-foreground">
                                {topicLevelSiblings.prev.topic}
                              </span>
                            </span>
                          </Link>
                        </Button>
                      ) : (
                        <div className="hidden sm:block" aria-hidden />
                      )}
                      {topicLevelSiblings.next ? (
                        <Button
                          asChild
                          className="edu-btn-primary h-auto min-h-[3.25rem] w-full justify-start rounded-xl px-4 py-3 font-semibold shadow-sm sm:justify-end"
                        >
                          <Link
                            href={appendQueryParams(
                              buildTopicOverviewPath(
                              board,
                              topicLevelSiblings.next.subject,
                              topicLevelSiblings.next.classLevel,
                              topicLevelSiblings.next.topic,
                              difficultyLevel,
                              isRandomMode ? "random" : undefined
                              ),
                              isMagicWallSource ? { source: "magic-wall" } : {}
                            )}
                            className="flex w-full items-center gap-3 text-left sm:flex-row-reverse sm:text-right"
                          >
                            <ChevronRight className="size-5 shrink-0" aria-hidden />
                            <span className="min-w-0 flex-1 sm:text-right">
                              <span className="block text-[11px] font-bold uppercase tracking-wide opacity-90">
                                Next topic
                              </span>
                              <span className="block truncate text-sm font-bold">
                                {topicLevelSiblings.next.topic}
                              </span>
                            </span>
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </nav>
                )}
                </>
              ) : (
                <>
                  <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <p className="min-w-0 flex-1 text-xl sm:text-2xl font-black tracking-tight text-foreground break-words">
                      <span className="text-muted-foreground font-extrabold text-base sm:text-lg">Topic · </span>
                      <span>{topicNode.topic}</span>
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setReferencesDialogOpen(true)}
                      className="shrink-0 gap-2 rounded-full border-primary/50 bg-primary/5 font-semibold text-foreground hover:bg-primary/10"
                    >
                      <BookOpen className="h-4 w-4" />
                      References
                    </Button>
                  </div>
                  <div className="mb-5 rounded-2xl border-2 border-primary/40 bg-primary/5 px-4 py-4 sm:px-5 sm:py-5 shadow-sm ring-1 ring-primary/10">
                    <div className="mb-2 inline-flex items-center rounded-full bg-primary/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-primary">
                      Subtopic
                    </div>
                    <h1 className="font-black text-xl sm:text-2xl tracking-tight text-foreground min-w-0 break-words">
                    <MathText
                      weight="extrabold"
                      className="subtopic-title-text break-words [&_.katex]:!text-[0.8em] sm:[&_.katex]:!text-[0.88em]"
                    >
                        {subtopicDeepDiveHeadingMarkdown(subtopicName)}
                    </MathText>
                  </h1>
                  </div>

                  <section className="mb-2">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <h2 className="shrink-0 text-base font-extrabold text-primary uppercase tracking-wide">
                        Theory
                      </h2>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
                        {canEditTheory && topicNode && subtopicName && (
                          <>
                            {loadingDbTheory && (
                          <Button
                            variant="outline"
                            size="sm"
                                className="shrink-0 whitespace-nowrap rounded-lg"
                                disabled
                              >
                                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                                Loading…
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 whitespace-nowrap rounded-lg"
                              disabled={loadingDbTheory}
                              title="Edit theory content"
                            onClick={() => {
                              if (!editorOpen) {
                                setDraftTheory(activeTheory);
                                setDraftDidYouKnow(dbDidYouKnow);
                                setDraftReferencesJson(JSON.stringify(dbReferences, null, 2));
                              }
                              setEditorOpen((prev) => !prev);
                            }}
                          >
                            {editorOpen ? "Close editor" : "Edit"}
                          </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 whitespace-nowrap rounded-lg gap-2 font-bold"
                              disabled={
                                generatingDeepDive ||
                                generatingInstacue ||
                                generatingBits ||
                                generatingFormulas ||
                                loadingDbTheory ||
                                completingSubtopicAll
                              }
                              title="Generate this subtopic Deep Dive, then InstaCue, Bits, and practice formulas."
                              onClick={() => void runSubtopicAiGeneration()}
                            >
                              {generatingInstacue || generatingBits || generatingFormulas ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Sparkles className="w-4 h-4" />
                              )}
                              {generatingDeepDive || generatingInstacue || generatingBits || generatingFormulas
                                ? "Generating Subtopic AI…"
                                : "Generate Subtopic AI"}
                            </Button>
                          <Button
                            variant="secondary"
                            size="sm"
                              className="shrink-0 whitespace-nowrap rounded-lg gap-2 font-bold"
                              disabled={generatingDeepDive || loadingDbTheory || completingSubtopicAll}
                            title={
                              dbTheoryExists
                                ? `Regenerate deep dive for ${subtopicName} (${difficultyLevel})`
                                : `Generate deep dive for ${subtopicName} (${difficultyLevel})`
                            }
                              onClick={() => void runDeepDiveGeneration()}
                          >
                            <Sparkles className="w-4 h-4" />
                            {generatingDeepDive
                              ? dbTheoryExists
                                ? "Regenerating…"
                                : "Generating…"
                              : dbTheoryExists
                                ? "Regenerate Deep Dive"
                                : "Generate Deep Dive"}
                          </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="shrink-0 whitespace-nowrap rounded-lg gap-2 font-bold"
                              disabled={
                                subtopicAiBlockedByTopicHub ||
                                completingSubtopicAll ||
                                generatingDeepDive ||
                                generatingInstacue ||
                                generatingBits ||
                                generatingFormulas
                              }
                              title="Server fallback: fill missing Deep Dive, InstaCue, Bits, and formulas for this subtopic on Basics, Intermediate, and Advanced (topic hub must exist for all three)."
                              onClick={() => void runCompleteSubtopicAll()}
                            >
                              {completingSubtopicAll ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                              Complete all levels
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="shrink-0 whitespace-nowrap rounded-lg text-xs font-bold"
                              disabled={
                                completingSubtopicAll ||
                                generatingDeepDive ||
                                generatingInstacue ||
                                generatingBits ||
                                generatingFormulas
                              }
                              title="No AI: audit all subtopics level-by-level (Basics → Intermediate → Advanced) and print pending items into the Behind the scenes log."
                              onClick={() => void runAuditAllSubtopicsAllLevels()}
                            >
                              Audit all levels
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    {canEditTheory && subtopicAiBlockedByTopicHub && (
                      <p className="text-[10px] text-amber-900 dark:text-amber-200 mb-2 leading-snug">
                        Complete all levels requires topic hub coverage for Basics, Intermediate, and Advanced
                        (generate on topic overview / Explore).
                        {topicHubGateLoading ? (
                          <span className="font-semibold"> Checking hub…</span>
                        ) : topicHubGateMissing.length > 0 ? (
                          <span className="font-semibold"> Missing: {topicHubGateMissing.join(", ")}.</span>
                        ) : null}
                      </p>
                    )}
                    {canEditTheory ? (
                      <TopicAgentTracePanel
                        trace={subtopicAgentTrace}
                        onClear={() => setSubtopicAgentTrace(null)}
                      />
                    ) : null}
                    {editorOpen && canEditTheory && (
                      <div className="mb-4 space-y-3">
                        <p className="text-xs font-semibold text-muted-foreground">Theory (markdown)</p>
                        <textarea
                          value={draftTheory}
                          onChange={(e) => setDraftTheory(e.target.value)}
                          className="w-full min-h-[180px] rounded-xl border border-border bg-background px-3 py-2 text-sm"
                          placeholder="Write theory markdown..."
                        />
                        <p className="text-xs font-semibold text-muted-foreground">Did you know?</p>
                        <textarea
                          value={draftDidYouKnow}
                          onChange={(e) => setDraftDidYouKnow(e.target.value)}
                          className="w-full min-h-[72px] rounded-xl border border-border bg-background px-3 py-2 text-sm"
                          placeholder="Optional short fact for learners..."
                        />
                        <p className="text-xs font-semibold text-muted-foreground">
                          Video &amp; reading references (JSON array)
                        </p>
                        <textarea
                          value={draftReferencesJson}
                          onChange={(e) => setDraftReferencesJson(e.target.value)}
                          className="w-full min-h-[120px] font-mono text-xs rounded-xl border border-border bg-background px-3 py-2"
                          placeholder={`[{"type":"video","title":"...","url":"https://..."},{"type":"reading","title":"...","url":"https://..."}]`}
                        />
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="rounded-lg"
                            disabled={savingTheory || !topicNode}
                            onClick={async () => {
                              if (!topicNode) return;
                              const parsedRefs: DeepDiveReference[] = [];
                              try {
                                const raw = JSON.parse(draftReferencesJson.trim() || "[]") as unknown;
                                if (!Array.isArray(raw)) {
                                  throw new Error("References must be a JSON array");
                                }
                                for (const item of raw) {
                                  if (!item || typeof item !== "object") continue;
                                  const o = item as Record<string, unknown>;
                                  if (o.type !== "video" && o.type !== "reading") continue;
                                  const title = typeof o.title === "string" ? o.title.trim() : "";
                                  const url = typeof o.url === "string" ? o.url.trim() : "";
                                  if (!title || !url) continue;
                                  const description =
                                    typeof o.description === "string" ? o.description.trim() : undefined;
                                  parsedRefs.push({
                                    type: o.type,
                                    title,
                                    url,
                                    ...(description ? { description } : {}),
                                  });
                                }
                              } catch {
                                toast({
                                  title: "Invalid references JSON",
                                  description: "Use a JSON array of objects with type, title, and url.",
                                  variant: "destructive",
                                });
                                return;
                              }
                              const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
                              setSavingTheory(true);
                              try {
                                await upsertSubtopicContent({
                                  board: boardName,
                                  subject: topicNode.subject,
                                  classLevel: topicNode.classLevel,
                                  topic: topicNode.topic,
                                  subtopicName,
                                  level: difficultyLevel,
                                  theory: draftTheory,
                                  references: parsedRefs,
                                  didYouKnow: draftDidYouKnow,
                                });
                                setDbTheory(draftTheory);
                                setDbReferences(parsedRefs);
                                setDbDidYouKnow(draftDidYouKnow);
                                setDbTheoryExists(true);
                                setEditorOpen(false);
                                toast({ title: "Subtopic content updated" });
                              } catch (error) {
                                const message =
                                  error instanceof Error ? error.message : "Could not save content";
                                toast({ title: message, variant: "destructive" });
                              } finally {
                                setSavingTheory(false);
                              }
                            }}
                          >
                            {savingTheory ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="rounded-lg"
                            disabled={savingTheory}
                            onClick={() => {
                              setDraftTheory(activeTheory);
                              setDraftDidYouKnow(dbDidYouKnow);
                              setDraftReferencesJson(JSON.stringify(dbReferences, null, 2));
                              setEditorOpen(false);
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                    {loadingDbTheory ? (
                      <TheoryPanelSkeleton />
                    ) : focusedTheoryIsPh ? (
                      <TheoryPanelSkeleton />
                    ) : (
                      <div className="theory-content text-[15px] leading-relaxed">
                        <TheoryContent theory={activeTheory} />
                      </div>
                    )}
                  </section>
                  {!isRandomMode && (
                    <div className="mt-5 pt-3 border-t border-border grid min-w-0 w-full grid-cols-1 gap-2 sm:grid-cols-2">
                      {prevSubtopicHref && prevSubtopic && (
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-auto min-h-0 w-full min-w-0 max-w-full shrink justify-start gap-0 overflow-hidden rounded-lg py-2 px-2.5 text-left font-semibold"
                        >
                          <Link
                            href={prevSubtopicHref}
                            className="flex w-full min-w-0 max-w-full flex-nowrap items-center gap-1.5 overflow-hidden text-left"
                            title={subtopicNavPreviewLine(prevSubtopic.name)}
                          >
                            <ArrowLeft className="size-4 shrink-0 opacity-80" aria-hidden />
                            <span className="shrink-0 text-xs text-muted-foreground sm:text-sm">
                              Previous subtopic:
                            </span>
                            <span className="min-w-0 flex-1 truncate text-xs text-foreground sm:text-sm">
                              {subtopicNavPreviewLine(prevSubtopic.name)}
                            </span>
                          </Link>
                        </Button>
                      )}
                      {nextSubtopicHref && nextSubtopic && (
                        <Button
                          asChild
                          size="sm"
                          className="edu-btn-primary h-auto min-h-0 w-full min-w-0 max-w-full shrink justify-start gap-0 overflow-hidden rounded-lg py-2 px-2.5 text-left font-semibold"
                        >
                          <Link
                            href={nextSubtopicHref}
                            className="flex w-full min-w-0 max-w-full flex-nowrap items-center gap-1.5 overflow-hidden text-left text-primary-foreground"
                            title={subtopicNavPreviewLine(nextSubtopic.name)}
                          >
                            <span className="shrink-0 text-xs opacity-90 sm:text-sm">Next subtopic:</span>
                            <span className="min-w-0 flex-1 truncate text-xs sm:text-sm">
                              {subtopicNavPreviewLine(nextSubtopic.name)}
                            </span>
                            <ChevronRight className="size-4 shrink-0 opacity-90" aria-hidden />
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </>
              )}

              {mode === "random" && (
                <div className="mt-6 pt-4 border-t border-border flex flex-col sm:flex-row gap-4 sm:gap-6 sm:items-center min-w-0 flex-wrap">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setWheelOpen(true)}
                    className="rounded-xl gap-2 font-bold edu-btn-primary w-fit"
                    disabled={!topicNode?.subtopics?.length}
                  >
                    <Shuffle className="w-4 h-4" /> Spin Subtopic Wheel
                  </Button>
                  <Button asChild size="sm" variant="outline" className="rounded-xl gap-2 font-bold w-fit">
                    <Link href={spinAgainHref}>Spin topic wheel</Link>
                  </Button>
                </div>
              )}
            </div>

            {!isOverview && (
              <div
                className="mt-5 flex flex-wrap items-center gap-2"
                aria-label="Video, reading references, and did you know"
              >
                    <Button
                  type="button"
                      variant="outline"
                  onClick={() => setReferencesDialogOpen(true)}
                      className="rounded-full gap-2 font-semibold border-primary text-foreground bg-primary/5 hover:bg-primary/10"
                    >
                      <BookOpen className="w-4 h-4 text-foreground" />
                      Video &amp; Reading References
                    </Button>
                <Dialog open={referencesDialogOpen} onOpenChange={setReferencesDialogOpen}>
                  <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <BookOpen className="w-5 h-5 text-primary" />
                        Recommended References
                      </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 pt-2">
                      {loadingDbTheory ? (
                        <p className="text-sm text-muted-foreground">Loading references…</p>
                      ) : dbReferences.length === 0 ? (
                        <div className="space-y-2">
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            No video or reading links are set for this subtopic yet.
                          </p>
                          {canEditTheory && (
                            <p className="text-xs text-muted-foreground">
                              Open <span className="font-semibold text-foreground">Edit</span> under Theory to add a
                              JSON list of references (videos and readings).
                            </p>
                          )}
                        </div>
                      ) : (
                        <>
                          <div>
                            <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                              <Video className="w-4 h-4 text-primary" />
                              Video References
                            </h4>
                            {dbReferences.filter((r) => r.type === "video").length === 0 ? (
                              <p className="text-sm text-muted-foreground">No video links listed.</p>
                            ) : (
                              <ul className="space-y-3">
                                {dbReferences
                                  .filter((r) => r.type === "video")
                                  .map((ref, i) => (
                                    <li key={i} className="border-l-2 border-primary/30 pl-3 py-1">
                                      <a
                                        href={ref.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                                      >
                                        {ref.title}
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                      {ref.description && (
                                        <p className="text-sm text-muted-foreground mt-0.5">{ref.description}</p>
                                      )}
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                              <FileText className="w-4 h-4 text-primary" />
                              PDF &amp; Reading Materials
                            </h4>
                            {dbReferences.filter((r) => r.type === "reading").length === 0 ? (
                              <p className="text-sm text-muted-foreground">No reading or PDF links listed.</p>
                            ) : (
                              <ul className="space-y-3">
                                {dbReferences
                                  .filter((r) => r.type === "reading")
                                  .map((ref, i) => (
                                    <li key={i} className="border-l-2 border-primary/30 pl-3 py-1">
                                      <a
                                        href={ref.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                                      >
                                        {ref.title}
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </a>
                                      {ref.description && (
                                        <p className="text-sm text-muted-foreground mt-0.5">{ref.description}</p>
                                      )}
                                    </li>
                                  ))}
                              </ul>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="rounded-full gap-2 font-semibold border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/15"
                    >
                      <Lightbulb className="w-4 h-4" />
                      Did you know?
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Lightbulb className="w-5 h-5 text-amber-500" />
                        Did you know?
                      </DialogTitle>
                    </DialogHeader>
                    {loadingDbTheory ? (
                      <p className="text-sm text-muted-foreground">Loading…</p>
                    ) : dbDidYouKnow.trim().length === 0 ? (
                      <div className="space-y-2">
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          No “did you know?” fact is saved for this subtopic yet.
                        </p>
                        {canEditTheory && (
                          <p className="text-xs text-muted-foreground">
                            Use <span className="font-semibold text-foreground">Edit</span> under Theory to add one.
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-amber-200/50 dark:border-amber-800/40 bg-amber-50/40 dark:bg-amber-900/10 p-4">
                        <TheoryContent
                          theory={
                            dbDidYouKnow
                              // Convert escaped braces from model output for cleaner display.
                              .replace(/\\\{/g, "{")
                              .replace(/\\\}/g, "}")
                          }
                          className="[&>p]:text-foreground/90 [&>p]:leading-relaxed [&>p]:text-base"
                        />
                      </div>
                    )}
                  </DialogContent>
                </Dialog>
              </div>
            )}
          </main>

          {isInvestorTopicHubLayout && (
          <aside className="w-full lg:w-72 xl:w-80 shrink-0 min-w-0 lg:min-w-[18rem]">
            <div className="lg:sticky lg:top-24 space-y-4">
              <Tabs defaultValue="instacue" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-3">
                  <TabsTrigger value="instacue" className="text-xs">+ InstaCue</TabsTrigger>
                  <TabsTrigger value="quiz" className="text-xs">Quiz (0)</TabsTrigger>
                  <TabsTrigger value="numerals" className="text-xs">Numerals</TabsTrigger>
                  <TabsTrigger value="concepts" className="text-xs">Concepts</TabsTrigger>
                </TabsList>

                <TabsContent value="instacue" className="mt-0">
                  <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Go through the subtopic level to see InstaCue cards.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="quiz" className="mt-0">
                  <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Go through the subtopic level to see Quiz (Bits).
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="numerals" className="mt-0">
                  <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Go through the subtopic level to see Numerals.
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="concepts" className="mt-0">
                  <div className="rounded-xl border border-border bg-muted/20 px-3 py-2">
                    <p className="text-xs text-muted-foreground">
                      Go through the subtopic level to see Concepts.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {!isRandomMode && (
                <section className="rounded-2xl border border-border bg-muted/20 p-4 sm:p-5">
                  <p className="text-sm font-bold text-foreground mb-1">Continue to subtopics</p>
                  <p className="text-xs text-muted-foreground mb-3">
                    Open each subtopic to view InstaCue cards, Quiz (Bits), Numerals, and Concepts.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {topicNode.subtopics.map((st, idx) => {
                      const href = appendQueryParams(
                        buildTopicPath(
                          board,
                          topicNode.subject,
                          topicNode.classLevel,
                          topicNode.topic,
                          st.name,
                          difficultyLevel,
                          undefined
                        ),
                        isMagicWallSource ? { source: "magic-wall" } : {}
                      );
                      return (
                        <Link
                          key={st.name}
                          href={href}
                          className="inline-flex items-center rounded-lg px-3 py-2 text-xs font-semibold transition-colors bg-muted hover:bg-muted/80 text-foreground/90"
                          title={subtopicNavPreviewLine(st.name)}
                        >
                          <span className="mr-1.5 text-[10px] font-bold text-muted-foreground">{idx + 1}.</span>
                          <MathText className="[&_.katex]:!text-[0.85em]">
                            {subtopicMathTextLabel(st.name)}
                          </MathText>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </aside>
          )}

          {!isInvestorTopicHubLayout && (
          <aside className="w-full lg:w-72 xl:w-80 shrink-0 min-w-0 lg:min-w-[18rem]">
            <div className="lg:sticky lg:top-24 space-y-4">
              {isOverview && !isMagicWallSource && (
              <div className="edu-card p-5 rounded-2xl border border-border">
                <h4 className="font-extrabold text-foreground text-base mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Subtopics in {topicNode.topic}
                </h4>
                <p className="text-xs text-muted-foreground mb-3">
                  Preview list for this chapter. Use the numbered buttons below to open each subtopic page.
                </p>
                <ul className="space-y-2 text-sm">
                  {topicNode.subtopics.map((st, idx) => {
                    return (
                      <li
                        key={st.name}
                        className="subtopic-title-text flex gap-3 min-w-0 rounded-xl border border-border/70 bg-background/70 px-3 py-2"
                      >
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-muted text-[11px] font-extrabold text-foreground shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-semibold text-foreground min-w-0 break-words leading-snug"
                            title={subtopicNavPreviewLine(st.name)}
                          >
                            <MathText weight="semibold" className="[&_.katex]:!text-[0.9em]">
                              {subtopicMathTextLabel(st.name)}
                            </MathText>
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
              )}
              {isOverview && (
                <div className="edu-card p-5 rounded-2xl border border-border">
                  <h4 className="font-extrabold text-foreground text-base mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-primary" />
                    Exam weightage
                  </h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Main column = level-wise topic master guide; cards provide focused previews before subtopic deep dive.
                  </p>
                  <p className="text-sm text-muted-foreground mb-3">
                    {topicNode.totalPeriods != null
                      ? `~${Math.round((topicNode.totalPeriods / 200) * 100)}% of syllabus`
                      : "~5–8% of exam"}
                    {topicNode.totalPeriods != null && (
                      <span className="block mt-1 text-xs">{topicNode.totalPeriods} periods</span>
                    )}
                  </p>
                  {isRandomMode ? (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setWheelOpen(true)}
                      className="rounded-xl gap-2 font-bold edu-btn-primary w-full mt-1"
                      disabled={!topicNode?.subtopics?.length}
                    >
                      <Shuffle className="w-4 h-4" /> Spin Subtopic Wheel
                    </Button>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground font-medium mb-2">
                        {topicNode.subtopics.length} subtopic{topicNode.subtopics.length !== 1 ? "s" : ""} — open on its own page:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {topicNode.subtopics.map((st, idx) => {
                          const href = appendQueryParams(
                            buildTopicPath(
                            board,
                            topicNode.subject,
                            topicNode.classLevel,
                            topicNode.topic,
                            st.name,
                            difficultyLevel,
                            undefined
                            ),
                            isMagicWallSource ? { source: "magic-wall" } : {}
                          );
                          return (
                            <Link
                              key={st.name}
                              href={href}
                              className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold transition-colors bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                              title={subtopicNavPreviewLine(st.name)}
                            >
                              {idx + 1}
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Right column: InstaCue / Quiz / Numerals / Concepts */}
              {isSubtopicDashboardLayout && (
                <Tabs defaultValue="instacue" className="w-full">
                  <TabsList className="grid w-full grid-cols-4 mb-3">
                    <TabsTrigger value="instacue" className="text-xs">
                      {canEditTheory ? "+ InstaCue" : "InstaCue"}
                    </TabsTrigger>
                    <TabsTrigger value="quiz" className="text-xs">
                      Quiz{dbBitsQuestions.length > 0 ? ` (${dbBitsQuestions.length})` : ""}
                    </TabsTrigger>
                    <TabsTrigger value="numerals" className="text-xs">Numerals</TabsTrigger>
                    <TabsTrigger value="concepts" className="text-xs">Concepts</TabsTrigger>
                  </TabsList>

                  {/* Tab 1: InstaCue */}
                  <TabsContent value="instacue" className="space-y-3 mt-0">
                  <InstaCue
                    cards={sidebarInstaCueCards}
                    topicName={topicNode.topic}
                    subtopicName={subtopicName}
                    level={difficultyLevel as "basics" | "intermediate" | "advanced"}
                    subject={topicNode.subject}
                    classLevel={topicNode.classLevel}
                    onCardIndexChange={handleInstaCueNav}
                      onCardValidated={handleInstaCueValidated}
                    onAddCard={
                        user && canEditTheory
                        ? (card) => {
                            const id = `user-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                            saveRevisionCard({
                              ...card,
                              id,
                              board: (board === "icse" ? "ICSE" : "CBSE") as Board,
                            } as Parameters<typeof saveRevisionCard>[0]);
                            syncAllSavedContent().catch(() => {});
                          }
                        : undefined
                    }
                  />
                  {canEditTheory && (
                    <div className="flex flex-col items-end gap-1 -mt-2 mb-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-lg gap-1.5 text-xs font-bold text-primary disabled:opacity-50"
                        title={
                          hasDeepDiveForAiArtifacts
                              ? "Runs the full pack: InstaCue cards, then Bits (MCQs), then practice formulas — same pipeline as Generate Subtopic AI step 2."
                              : "Generate Deep Dive first, then run AI cards."
                        }
                        disabled={
                            artifactActionsTopicHubBlocked ||
                          !hasDeepDiveForAiArtifacts ||
                          generatingDeepDive ||
                          generatingInstacue ||
                          generatingBits ||
                            generatingFormulas ||
                            completingSubtopicAll
                          }
                          onClick={() => void runAiArtifactPipeline()}
                        >
                          {generatingInstacue || generatingBits || generatingFormulas ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          {generatingFormulas
                            ? "Generating formulas…"
                            : generatingBits
                              ? "Generating Bits…"
                              : generatingInstacue
                                ? "Generating InstaCue…"
                                : dbInstacueCards.length > 0 || dbBitsQuestions.length > 0 || dbPracticeFormulas.length > 0
                                  ? "Regenerate AI pack"
                                  : "Generate InstaCue + Bits + Formulas"}
                      </Button>
                      {!hasDeepDiveForAiArtifacts && !generatingDeepDive && (
                        <p className="text-[10px] text-muted-foreground text-right max-w-[14rem] leading-snug">
                            Generate Deep Dive above, then use the AI pack button or Generate Subtopic AI.
                        </p>
                      )}
                      {generatingDeepDive && (
                        <p className="text-[10px] text-muted-foreground text-right max-w-[14rem] leading-snug">
                            Deep Dive running — AI cards can be generated after it finishes.
                        </p>
                      )}
                    </div>
                  )}
                  {canEditTheory && artifactRunLog.length > 0 && (
                    <div className="mb-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-3">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-[11px] font-extrabold uppercase tracking-wide text-primary">
                            Behind the scenes · AI artifacts (manual run)
                        </p>
                        <span
                          className={`text-[11px] font-bold ${
                            artifactRunStatus === "running"
                              ? "text-blue-700 dark:text-blue-300"
                              : artifactRunStatus === "success"
                                ? "text-green-700 dark:text-green-300"
                                  : artifactRunStatus === "partial"
                                    ? "text-amber-700 dark:text-amber-300"
                                : artifactRunStatus === "failed"
                                  ? "text-red-700 dark:text-red-300"
                                  : "text-muted-foreground"
                          }`}
                        >
                          {artifactRunStatus === "running"
                            ? "Running"
                            : artifactRunStatus === "success"
                              ? "Completed"
                                : artifactRunStatus === "partial"
                                  ? "Partial"
                              : artifactRunStatus === "failed"
                                ? "Failed"
                                : "Idle"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-2">
                        Last run: {artifactLastRunAt ?? "—"} · Current data: InstaCue {dbInstacueCards.length}, Bits{" "}
                        {dbBitsQuestions.length}, Practice Formulas {dbPracticeFormulas.length}
                      </p>
                      <p className="text-[10px] text-muted-foreground mb-2 leading-snug">
                          Manual run: <span className="font-semibold text-foreground">Generate InstaCue + Bits + Formulas</span>{" "}
                          or <span className="font-semibold text-foreground">Generate Subtopic AI</span> (or section buttons). Step
                          delay:{" "}
                        <span className="font-mono text-foreground/80">ARTIFACT_PIPELINE_BETWEEN_STEPS_MS</span>.
                      </p>
                      <div className="rounded-lg border border-border bg-background/80 p-2 max-h-44 overflow-y-auto">
                        <ul className="space-y-1">
                          {artifactRunLog.map((line, idx) => (
                            <li key={`${line}-${idx}`} className="text-[11px] text-foreground/90 font-mono break-words">
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                  </TabsContent>

                  {/* Tab 2: Quiz — intro card + Dialog popup */}
                  <TabsContent value="quiz" className="space-y-3 mt-0">
                    {canEditTheory && (
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg gap-1.5 text-xs font-bold text-primary disabled:opacity-50"
                          disabled={
                            artifactActionsTopicHubBlocked ||
                            !hasDeepDiveForAiArtifacts ||
                            generatingDeepDive ||
                            generatingInstacue ||
                            generatingBits ||
                            generatingFormulas ||
                            completingSubtopicAll
                          }
                          onClick={() => void runBitsOnly()}
                        >
                          {generatingBits ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                          {generatingBits ? "Generating Bits..." : dbBitsQuestions.length > 0 ? "Regenerate Bits" : "Generate Bits"}
                        </Button>
                      </div>
                    )}

                    {dbBitsQuestions.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-sm text-muted-foreground mb-3">No quiz questions yet for this subtopic.</p>
                        {canEditTheory ? (
                          <p className="text-xs text-muted-foreground">
                            First run <span className="font-semibold text-foreground">Generate Deep Dive</span> so theory is
                            saved to Supabase, then generate quiz questions.
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Check back later — practice questions may be added for this lesson.</p>
                        )}
                      </div>
                    ) : (
                      <div className="edu-card p-4 rounded-xl border border-border space-y-3">
                    <div>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Topic Quiz</p>
                          <p className="font-bold text-sm text-foreground leading-snug">
                            <MathText>{displaySubtopicTitle}</MathText>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300">
                            {topicNode?.subject ?? "Subject"}
                          </span>
                          <span className="text-xs text-muted-foreground">{topicNode?.topic ?? "Topic"}</span>
                        </div>
                        <ul className="space-y-1.5 text-xs divide-y divide-border/40">
                          <li className="flex justify-between py-1">
                            <span className="text-muted-foreground">Questions</span>
                            <span className="font-bold text-foreground">{dbBitsQuestions.length} MCQs</span>
                          </li>
                          <li className="flex justify-between py-1">
                            <span className="text-muted-foreground">Level</span>
                            <span className="font-bold text-foreground capitalize">{difficultyLevel}</span>
                          </li>
                          {bitsAttempt && (
                            <li className="flex justify-between py-1">
                              <span className="text-muted-foreground">Last score</span>
                              <span className="font-bold text-green-700 dark:text-green-300">
                                {Math.round((bitsAttempt.correctCount / bitsAttempt.totalQuestions) * 100)}% · {bitsAttempt.correctCount}/{bitsAttempt.totalQuestions}
                              </span>
                            </li>
                          )}
                        </ul>
                        <Button
                          className="w-full rounded-xl edu-btn-primary text-sm font-bold"
                          onClick={() => {
                            if (bitsAttempt) {
                              setBitsCurrentIdx(0);
                              setBitsSelectedAnswers({});
                              setBitsReviewMode(false);
                            } else {
                              setBitsReviewMode(false);
                            }
                            setBitsDialogOpen(true);
                          }}
                        >
                          {bitsAttempt
                            ? "Open quiz →"
                            : bitsCurrentIdx > 0 || bitsFilledQuestionCount > 0
                              ? "Continue quiz →"
                              : "Start Quiz →"}
                        </Button>
                        {bitsAttempt && (
                          <button
                            type="button"
                            className="w-full text-xs text-primary hover:underline text-center"
                            onClick={() => {
                              const selected: Record<number, number> = {};
                              for (const [k, v] of Object.entries(bitsAttempt.selectedAnswers)) {
                                const idx = Number(k);
                                if (Number.isInteger(idx)) selected[idx] = v;
                              }
                              setBitsSelectedAnswers(selected);
                              setBitsCurrentIdx(0);
                              setBitsReviewMode(true);
                              setBitsDialogOpen(true);
                            }}
                          >
                            Review previous answers
                          </button>
                        )}
                      </div>
                    )}

                    {/* Quiz Dialog */}
                      <Dialog
                        open={bitsDialogOpen}
                        onOpenChange={(open) => {
                          setBitsDialogOpen(open);
                          if (!open) {
                            flushSubtopicEngagementNow();
                            setBitsReviewMode(false);
                          }
                        }}
                      >
                        <DialogContent className="bits-quiz-dialog w-[min(42rem,calc(100vw-1.5rem))] max-w-2xl min-w-0 max-h-[min(88vh,52rem)] overflow-y-auto overflow-x-hidden p-4 sm:p-6 gap-3">
                          <DialogHeader className="min-w-0 shrink-0 space-y-1 text-left">
                            <DialogTitle className="min-w-0 max-w-full break-words text-[1.05rem] font-bold tracking-tight leading-snug text-foreground pr-10 text-left">
                            Topic Quiz —{" "}
                              <MathText as="span" weight="semibold" className="font-semibold [overflow-wrap:anywhere]">
                                {displaySubtopicTitle}
                              </MathText>
                            </DialogTitle>
                            <DialogDescription className="text-xs">Test your understanding</DialogDescription>
                          </DialogHeader>
                            <div className="min-w-0 max-w-full space-y-3">
                              {!bitsReviewMode && bitsAttempt ? (
                                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                                  <p className="text-lg font-bold text-foreground">Previous submission found</p>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3">
                                      <p className="text-xs text-muted-foreground">Correct</p>
                                      <p className="text-xl font-bold text-green-700 dark:text-green-300">{bitsAttempt.correctCount}</p>
                                    </div>
                                    <div className="rounded-xl bg-destructive/10 border border-destructive/30 p-3">
                                      <p className="text-xs text-muted-foreground">Wrong</p>
                                      <p className="text-xl font-bold text-destructive">{bitsAttempt.wrongCount}</p>
                                    </div>
                                    <div className="rounded-xl bg-muted border border-border p-3">
                                      <p className="text-xs text-muted-foreground">Score</p>
                                      <p className="text-xl font-bold text-foreground">
                                        {bitsAttempt.totalQuestions > 0
                                          ? `${Math.round((bitsAttempt.correctCount / bitsAttempt.totalQuestions) * 100)}%`
                                          : "0%"}
                                      </p>
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Submitted on {new Date(bitsAttempt.submittedAt).toLocaleString()}
                                  </p>
                                  <div className="flex items-center justify-between gap-2 pt-1">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="rounded-xl h-8 px-3 text-xs"
                                      onClick={() => {
                                        const selected: Record<number, number> = {};
                                        for (const [k, v] of Object.entries(bitsAttempt.selectedAnswers)) {
                                          const idx = Number(k);
                                          if (Number.isInteger(idx)) selected[idx] = v;
                                        }
                                        setBitsSelectedAnswers(selected);
                                        setBitsCurrentIdx(0);
                                        setBitsReviewMode(true);
                                      }}
                                    >
                                      Review submitted answers
                                    </Button>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      className="rounded-xl h-8 px-3 text-xs"
                                      onClick={() => {
                                        setBitsSelectedAnswers({});
                                        setBitsCurrentIdx(0);
                                        setBitsReviewMode(true);
                                      }}
                                    >
                                      Take test another time
                                    </Button>
                                  </div>
                                </div>
                              ) : (() => {
                                const q = dbBitsQuestions[bitsCurrentIdx];
                                if (!q) return null;
                                const selected = bitsSelectedAnswers[bitsCurrentIdx];
                                const answered = typeof selected === "number";
                                const isCorrectSelection = answered && q.options[selected] === q.correctAnswer;
                                const isCurrentQuizBitSaved = isBitSaved(q, savedBits);
                                const currentQuizSavedBitId = getSavedBitId(q, savedBits);
                                const useTwoColumns = shouldUseTwoColumnOptions(q.options);
                                return (
                                  <>
                                    <div className="flex items-center justify-center">
                                  <span className="text-xs font-semibold text-muted-foreground" aria-live="polite">
                                        Question {bitsCurrentIdx + 1} of {dbBitsQuestions.length}
                                      </span>
                                    </div>
                                    <div className="flex min-w-0 max-w-full flex-wrap items-center gap-1.5">
                                      <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300">
                                        {topicNode?.subject ?? "Subject"}
                                      </span>
                                      <span className="min-w-0 break-words text-xs font-medium text-foreground/80">
                                        {topicNode?.topic ?? "Topic"}
                                      </span>
                                    </div>
                                    <div className="min-w-0 max-w-full rounded-2xl border border-border p-4 space-y-3 bg-card">
                                      <div className="flex items-start justify-between gap-3">
                                        <h3 className="min-w-0 max-w-full flex-1 text-[1.05rem] font-bold leading-snug text-foreground [overflow-wrap:anywhere] break-words">
                                          <MathText>{q.question}</MathText>
                                        </h3>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className={`shrink-0 rounded-xl h-8 px-2.5 gap-1.5 text-xs font-semibold ${
                                            isCurrentQuizBitSaved
                                              ? "border-primary/40 bg-primary/10 text-primary"
                                              : "border-border text-muted-foreground hover:text-primary hover:border-primary/40 hover:bg-primary/10"
                                          }`}
                                          onClick={() => {
                                            if (!topicNode || !subtopicName) return;
                                            if (isCurrentQuizBitSaved) {
                                              if (currentQuizSavedBitId) {
                                                unsaveBit(currentQuizSavedBitId);
                                                persistSavedContent();
                                                toast({ title: "Removed from Saved Bits" });
                                              }
                                              return;
                                            }
                                            const bit: SavedBit = {
                                              id: `bit-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                              question: q.question,
                                              options: q.options,
                                              correctAnswer: getCorrectOptionIndex(q),
                                              solution: q.solution,
                                              subject: topicNode.subject,
                                              topic: topicNode.topic,
                                              subtopicName,
                                              classLevel: topicNode.classLevel,
                                              unitName: topicNode.topic,
                                              level: difficultyLevel,
                                              board: (board === "icse" ? "ICSE" : "CBSE") as Board,
                                              sectionIndex: subtopicIndex,
                                            };
                                            saveBit(bit);
                                            persistSavedContent();
                                            toast({ title: "Saved to Saved Bits" });
                                          }}
                                          title={isCurrentQuizBitSaved ? "Remove saved Bit" : "Save this Bit"}
                                        >
                                          <Bookmark className={`w-3.5 h-3.5 ${isCurrentQuizBitSaved ? "fill-current" : ""}`} />
                                          {isCurrentQuizBitSaved ? "Saved bit" : "Save this bit"}
                                        </Button>
                                      </div>
                                      <div
                                        className={useTwoColumns ? "grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2" : "min-w-0 space-y-2"}
                                        role="radiogroup"
                                        aria-label={`Answers for question ${bitsCurrentIdx + 1}`}
                                      >
                                        {q.options.map((opt, oi) => {
                                          const isCorrect = opt === q.correctAnswer;
                                          let cls = "bg-muted/70 hover:bg-muted text-foreground border-border";
                                          if (answered) {
                                            if (isCorrect) cls = "bg-green-500/12 border-green-500 text-foreground";
                                        else if (selected === oi && !isCorrectSelection) cls = "bg-destructive/10 border-destructive text-foreground";
                                        else cls = "bg-muted/60 text-muted-foreground border-border";
                                          }
                                          return (
                                            <button
                                              key={oi}
                                              type="button"
                                              disabled={answered}
                                          onClick={() => setBitsSelectedAnswers((prev) => ({ ...prev, [bitsCurrentIdx]: oi }))}
                                              role="radio"
                                              aria-checked={selected === oi}
                                              className={`flex min-w-0 w-full max-w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors ${cls}`}
                                            >
                                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-background/90 text-sm font-bold">
                                                {String.fromCharCode(65 + oi)}
                                              </span>
                                              <span className="min-w-0 flex-1 [overflow-wrap:anywhere] break-words">
                                                <MathText>{opt}</MathText>
                                              </span>
                                          {answered && isCorrect && <CheckCircle2 className="inline w-4 h-4 ml-auto text-green-600" />}
                                            </button>
                                          );
                                        })}
                                      </div>
                                      <div className="flex items-center justify-between gap-2 pt-1">
                                        <Button
                                      variant="outline" size="sm"
                                          className="rounded-xl h-8 px-3 text-xs min-w-24"
                                          onClick={() => setBitsCurrentIdx((i) => Math.max(0, i - 1))}
                                          disabled={bitsCurrentIdx === 0}
                                        >
                                          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                                        </Button>
                                        <Button
                                          variant={bitsCurrentIdx === dbBitsQuestions.length - 1 ? "default" : "outline"}
                                          size="sm"
                                          className="rounded-xl h-8 px-3 text-xs min-w-24"
                                          onClick={async () => {
                                            if (bitsCurrentIdx < dbBitsQuestions.length - 1) {
                                              setBitsCurrentIdx((i) => Math.min(dbBitsQuestions.length - 1, i + 1));
                                              return;
                                            }
                                            const total = dbBitsQuestions.length;
                                            let answeredCount = 0;
                                            for (let i = 0; i < total; i++) {
                                              if (typeof bitsSelectedAnswers[i] === "number") answeredCount++;
                                            }
                                            if (answeredCount < total) {
                                          toast({ title: "Answer all questions before submit", description: `${answeredCount}/${total} answered` });
                                              return;
                                            }
                                            const correctCount = dbBitsQuestions.reduce((acc, item, idx) => {
                                          const si = bitsSelectedAnswers[idx];
                                          if (typeof si !== "number") return acc;
                                          return item.options[si] === item.correctAnswer ? acc + 1 : acc;
                                            }, 0);
                                            const wrongCount = total - correctCount;
                                            if (!topicNode || !subtopicName) return;
                                            const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
                                            const payload: BitsAttemptRecord = {
                                          board: boardName, subject: topicNode.subject, classLevel: topicNode.classLevel,
                                          topic: topicNode.topic, subtopicName, level: difficultyLevel, bitsSignature,
                                          totalQuestions: total, correctCount, wrongCount,
                                          selectedAnswers: Object.fromEntries(Object.entries(bitsSelectedAnswers).map(([k, v]) => [String(k), v])),
                                              submittedAt: new Date().toISOString(),
                                            };
                                            setSubmittingBits(true);
                                            try {
                                              const persisted = await saveBitsAttempt(payload);
                                              setBitsAttempt(persisted);
                                              setBitsReviewMode(false);
                                              setBitsCurrentIdx(0);
                                              setBitsSelectedAnswers({});
                                              window.setTimeout(() => flushSubtopicEngagementNow(), 0);
                                          toast({ title: "Quiz submitted", description: `Correct: ${correctCount}, Wrong: ${wrongCount}` });
                                            } catch {
                                          toast({ title: "Failed to save result", description: "Please retry submit.", variant: "destructive" });
                                            } finally {
                                              setSubmittingBits(false);
                                            }
                                          }}
                                      disabled={
                                        submittingBits ||
                                        (bitsCurrentIdx < dbBitsQuestions.length - 1 &&
                                          typeof bitsSelectedAnswers[bitsCurrentIdx] !== "number") ||
                                        (bitsCurrentIdx === dbBitsQuestions.length - 1 &&
                                          bitsFilledQuestionCount < dbBitsQuestions.length)
                                      }
                                    >
                                      {bitsCurrentIdx === dbBitsQuestions.length - 1
                                        ? submittingBits ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Submitting</> : "Submit"
                                        : <>Next <ChevronRight className="w-4 h-4 ml-1" /></>}
                                        </Button>
                                      </div>
                                      {bitsCurrentIdx === dbBitsQuestions.length - 1 &&
                                        bitsFilledQuestionCount < dbBitsQuestions.length &&
                                        dbBitsQuestions.length > 0 && (
                                          <p className="text-center text-xs text-amber-600 dark:text-amber-500">
                                            {bitsFilledQuestionCount}/{dbBitsQuestions.length} questions have an answer. Use{" "}
                                            <span className="font-semibold">Previous</span> to find any you skipped.
                                          </p>
                                        )}
                                      {answered && q.solution && (
                                        <div className="bits-quiz-explanation mt-2 rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
                                          <p className="mb-1 font-bold text-foreground">Explanation</p>
                                          <div className="min-w-0 max-w-full text-foreground/90">
                                            <MathText as="div">{q.solution}</MathText>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                        </DialogContent>
                      </Dialog>
                  </TabsContent>

                  {/* Tab 3: Numerals */}
                  <TabsContent value="numerals" className="space-y-3 mt-0">
                    {canEditTheory && (
                      <div className="flex justify-end mb-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="rounded-lg gap-1.5 text-xs font-bold text-primary disabled:opacity-50"
                          disabled={
                            artifactActionsTopicHubBlocked ||
                            !hasDeepDiveForAiArtifacts ||
                            generatingDeepDive ||
                            generatingInstacue ||
                            generatingBits ||
                            generatingFormulas ||
                            completingSubtopicAll
                          }
                          onClick={() => void runFormulasOnly()}
                        >
                          {generatingFormulas ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5" />
                          )}
                          {generatingFormulas
                            ? "Generating Formulas..."
                            : dbPracticeFormulas.length > 0
                              ? "Regenerate Practice Formulas"
                              : "Generate Practice Formulas"}
                        </Button>
                    </div>
                    )}
                    {dbPracticeFormulas.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-sm text-muted-foreground">No numerals yet for this subtopic.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dbPracticeFormulas.map((formula, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              // #region agent log
                              fetch('http://127.0.0.1:7826/ingest/70e4f01b-2a33-46c4-8228-3ea27639475c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'548b33'},body:JSON.stringify({sessionId:'548b33',runId:'pre-fix',hypothesisId:'H1',location:'page.tsx:4460',message:'numeral card clicked',data:{formulaIdx:i,formulaName:formula.name,formulasDialogOpenBefore:formulasDialogOpen,selectedFormulaIdxBefore:selectedFormulaIdx},timestamp:Date.now()})}).catch(()=>{});
                              // #endregion
                              setSelectedFormulaIdx(i);
                              setFormulasDialogOpen(true);
                            }}
                            className="edu-card w-full p-3 rounded-xl border border-border/60 text-left transition-colors hover:border-primary/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                            aria-label={`Open numeral ${i + 1}: ${formula.name}`}
                          >
                            <p className="text-[10px] font-extrabold text-primary uppercase mb-1">
                              Numeral {i + 1}
                            </p>
                            <p className="font-bold text-sm mb-1">{formula.name}</p>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{formula.description}</p>
                            <span className="text-primary text-xs font-bold hover:underline">
                              Try this →
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  {/* Tab 4: Concepts */}
                  <TabsContent value="concepts" className="mt-0">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                      Key Concepts
                    </p>
                    {conceptCards.length === 0 ? (
                      <div className="py-6 text-center">
                        <p className="text-sm text-muted-foreground">No concept cards yet for this subtopic.</p>
                      </div>
                    ) : (
                      <div
                        ref={conceptsScrollRef}
                        className="space-y-2 overflow-y-auto no-scrollbar pb-2"
                        style={{ maxHeight: "calc(100vh - 220px)" }}
                        onMouseEnter={() => { conceptsHoveredRef.current = true; }}
                        onMouseLeave={() => { conceptsHoveredRef.current = false; }}
                      >
                        {displayedConcepts.map((card) => (
                          <div key={card.id} className="edu-card p-3 rounded-xl border border-border/60">
                            <p className="text-xs font-bold text-primary mb-1">
                              <MathText>{card.frontContent}</MathText>
                            </p>
                            <p className="text-xs text-foreground/80">
                              <MathText>{card.backContent}</MathText>
                            </p>
                          </div>
                        ))}
                        
                        {totalConceptPages > 1 && (
                          <div className="flex items-center justify-between pt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setConceptsPage((p) => {
                                  const np = Math.max(0, p - 1);
                                  setViewedConceptPages((prev) => new Set(prev).add(np));
                                  return np;
                                });
                              }}
                              disabled={conceptsPage === 0}
                              className="text-xs h-8 px-3 rounded-lg"
                            >
                              Previous
                            </Button>
                            <span className="text-xs text-muted-foreground font-medium">
                              Page {conceptsPage + 1} of {totalConceptPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setConceptsPage((p) => {
                                  const np = Math.min(totalConceptPages - 1, p + 1);
                                  setViewedConceptPages((prev) => new Set(prev).add(np));
                                  return np;
                                });
                              }}
                              disabled={conceptsPage >= totalConceptPages - 1}
                              className="text-xs h-8 px-3 rounded-lg"
                            >
                              Next
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              )}

              {/* Formulas Dialog — opened programmatically from Numerals tab */}
                      <Dialog
                        open={formulasDialogOpen}
                        onOpenChange={(open) => {
                          // #region agent log
                          fetch('http://127.0.0.1:7826/ingest/70e4f01b-2a33-46c4-8228-3ea27639475c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'548b33'},body:JSON.stringify({sessionId:'548b33',runId:'pre-fix',hypothesisId:'H2',location:'page.tsx:4555',message:'formula dialog onOpenChange',data:{open,selectedFormulaIdx,formulasDialogOpenBefore:formulasDialogOpen},timestamp:Date.now()})}).catch(()=>{});
                          // #endregion
                          setFormulasDialogOpen(open);
                          if (!open) {
                            if (selectedFormulaIdx !== null) {
                              setFormulaByIdx((prev) => ({
                                ...prev,
                                [selectedFormulaIdx]: {
                                  qIdx: formulaBitsCurrentIdx,
                                  answers: { ...formulaBitsSelectedAnswers },
                                },
                              }));
                            }
                            setSelectedFormulaIdx(null);
                            setFormulaBitsCurrentIdx(0);
                            setFormulaBitsSelectedAnswers({});
                            setFormulaQuestionsOverride({});
                          }
                        }}
                      >
                        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle>
                              {selectedFormulaIdx === null
                                ? "Which formula do you want to practice?"
                                : practiceFormulasForUi[selectedFormulaIdx]?.name ?? "Practice Formula"}
                            </DialogTitle>
                            <DialogDescription asChild>
                              <div className="text-sm text-muted-foreground">
                                {selectedFormulaIdx === null ? (
                                  <>
                                    <span className="text-muted-foreground">Formulas from </span>
                                    <MathText className="inline text-foreground [&_.katex]:text-[1em]">
                                      {displaySubtopicTitle}
                                    </MathText>
                                  </>
                                ) : (
                                  "Practice questions in the same Bits structure"
                                )}
                              </div>
                            </DialogDescription>
                          </DialogHeader>
                          {practiceFormulasForUi.length === 0 ? (
                            <div className="py-6 text-center">
                              <p className="text-sm text-muted-foreground mb-3">No formulas generated yet for this subtopic.</p>
                      {canEditTheory ? (
                              <p className="text-xs text-muted-foreground">
                                First run <span className="font-semibold text-foreground">Generate Deep Dive</span>, then{" "}
                          <span className="font-semibold text-foreground">Generate Practice Formulas</span> to generate
                          formula practice.
                              </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Formula practice for this lesson is not available yet.</p>
                      )}
                            </div>
                          ) : selectedFormulaIdx === null ? (
                            <div className="space-y-4">
                              {practiceFormulasForUi.map((f, fi) => (
                                <button
                                  key={fi}
                                  type="button"
                                  className="w-full text-left rounded-2xl border border-border p-4 space-y-2 hover:border-primary/50 hover:bg-muted/20 transition-colors"
                                  onClick={() => {
                                    // #region agent log
                                    fetch('http://127.0.0.1:7826/ingest/70e4f01b-2a33-46c4-8228-3ea27639475c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'548b33'},body:JSON.stringify({sessionId:'548b33',runId:'pre-fix',hypothesisId:'H4',location:'page.tsx:4616',message:'formula chooser option clicked',data:{formulaIdx:fi,formulaName:f.name},timestamp:Date.now()})}).catch(()=>{});
                                    // #endregion
                                    const merged: Record<number, { qIdx: number; answers: Record<number, number> }> = {
                                      ...formulaByIdx,
                                    };
                                    if (selectedFormulaIdx !== null) {
                                      merged[selectedFormulaIdx] = {
                                        qIdx: formulaBitsCurrentIdx,
                                        answers: { ...formulaBitsSelectedAnswers },
                                      };
                                    }
                                    const d = merged[fi];
                                    setFormulaByIdx(merged);
                                    setSelectedFormulaIdx(fi);
                                    setFormulaBitsCurrentIdx(d?.qIdx ?? 0);
                                    setFormulaBitsSelectedAnswers(d?.answers ? { ...d.answers } : {});
                                  }}
                                >
                                  <p className="text-lg font-bold text-foreground">{f.name}</p>
                                  <p className="text-sm text-muted-foreground [&_.katex]:text-[0.95em]">
                                    <MathText>{f.description}</MathText>
                                  </p>
                                  <div className="rounded-lg bg-muted/60 px-3 py-2 text-primary overflow-x-auto [&_.katex]:text-[1.05em]">
                                    <MathText>{`$$${stripFormulaDelimiters(f.formulaLatex)}$$`}</MathText>
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {f.bitsQuestions?.length ?? 0} question{(f.bitsQuestions?.length ?? 0) !== 1 ? "s" : ""}
                                  </p>
                                </button>
                              ))}
                            </div>
                          ) : (
                            (() => {
                              const formula = practiceFormulasForUi[selectedFormulaIdx];
                              if (!formula) return null;
                              const formulaQuestions = formulaQuestionsOverride[selectedFormulaIdx] ?? formula.bitsQuestions ?? [];
                              const q = formulaQuestions[formulaBitsCurrentIdx];
                              if (!q) {
                                return (
                                  <div className="py-6 text-center text-sm text-muted-foreground">
                                    No practice questions available for this formula.
                                  </div>
                                );
                              }
                              const selected = formulaBitsSelectedAnswers[formulaBitsCurrentIdx];
                              const answered = typeof selected === "number";
                              const isCorrectSelection = answered && q.options[selected] === q.correctAnswer;
                              const useTwoColumns = shouldUseTwoColumnOptions(q.options);

                              return (
                                <div className="space-y-4">
                                  <button
                                    type="button"
                                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                      if (selectedFormulaIdx !== null) {
                                        setFormulaByIdx((prev) => ({
                                          ...prev,
                                          [selectedFormulaIdx]: {
                                            qIdx: formulaBitsCurrentIdx,
                                            answers: { ...formulaBitsSelectedAnswers },
                                          },
                                        }));
                                      }
                                      setSelectedFormulaIdx(null);
                                      setFormulaBitsCurrentIdx(0);
                                      setFormulaBitsSelectedAnswers({});
                                    }}
                                  >
                                    <ArrowLeft className="w-4 h-4" />
                                    Back to Formulas
                                  </button>
                                  <p className="text-sm text-muted-foreground [&_.katex]:text-[0.95em]">
                                    <MathText>{formula.description}</MathText>
                                  </p>
                                  <div className="rounded-lg bg-muted/60 px-3 py-2 text-primary overflow-x-auto [&_.katex]:text-[1.05em]">
                                    <MathText>{`$$${stripFormulaDelimiters(formula.formulaLatex)}$$`}</MathText>
                                  </div>

                                  <div className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300">
                                      {topicNode?.subject ?? "Subject"}
                                    </span>
                                    <span className="text-xs font-medium text-foreground/80">
                                      {topicNode?.topic ?? "Topic"}
                                    </span>
                                  </div>

                                  <div className="rounded-2xl border border-border p-4 space-y-3 bg-card">
                                    <h3 className="text-[1.05rem] font-bold leading-snug text-foreground">
                                      <MathText>{q.question}</MathText>
                                    </h3>
                                    <div
                                      className={useTwoColumns ? "grid grid-cols-1 sm:grid-cols-2 gap-2" : "space-y-2"}
                                      role="radiogroup"
                                      aria-label={`Formula answers for question ${formulaBitsCurrentIdx + 1}`}
                                    >
                                      {q.options.map((opt, oi) => {
                                        const isCorrect = opt === q.correctAnswer;
                                        let cls = "bg-muted/70 hover:bg-muted text-foreground border-border";
                                        if (answered) {
                                          if (isCorrect) cls = "bg-green-500/12 border-green-500 text-foreground";
                                          else if (selected === oi && !isCorrectSelection) cls = "bg-destructive/10 border-destructive text-foreground";
                                          else cls = "bg-muted/60 text-muted-foreground border-border";
                                        }
                                        return (
                                          <button
                                            key={oi}
                                            type="button"
                                            disabled={answered}
                                            onClick={() =>
                                              setFormulaBitsSelectedAnswers((prev) => ({
                                                ...prev,
                                                [formulaBitsCurrentIdx]: oi,
                                              }))
                                            }
                                            className={`w-full text-left px-3 py-2 rounded-xl text-sm border transition-colors flex items-center gap-2.5 ${cls}`}
                                          >
                                            <span className="w-7 h-7 rounded-full bg-background/90 flex items-center justify-center text-sm shrink-0 font-bold">
                                              {String.fromCharCode(65 + oi)}
                                            </span>
                                            <MathText>{opt}</MathText>
                                            {answered && isCorrect && (
                                              <CheckCircle2 className="inline w-4 h-4 ml-auto text-green-600" />
                                            )}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    {answered && q.solution && (
                                      <div className="mt-2 p-3 rounded-xl bg-muted/50 text-sm text-muted-foreground">
                                        <p className="font-bold text-foreground mb-1">Explanation</p>
                                        <MathText>{q.solution}</MathText>
                                      </div>
                                    )}
                                    <div className="space-y-2 pt-1">
                                      <div className="flex items-center justify-between gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="rounded-full h-9 px-3 text-xs min-w-24"
                                          onClick={() => setFormulaBitsCurrentIdx((i) => Math.max(0, i - 1))}
                                          disabled={formulaBitsCurrentIdx === 0}
                                        >
                                          <ChevronLeft className="w-4 h-4 mr-1" /> Previous
                                        </Button>
                                        <span className="text-xs font-semibold text-muted-foreground">
                                          Question {formulaBitsCurrentIdx + 1} of {formulaQuestions.length}
                                        </span>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="rounded-full h-9 px-3 text-xs min-w-24"
                                          onClick={() => setFormulaBitsCurrentIdx((i) => Math.min(formulaQuestions.length - 1, i + 1))}
                                          disabled={formulaBitsCurrentIdx === formulaQuestions.length - 1}
                                        >
                                          Next <ChevronRight className="w-4 h-4 ml-1" />
                                        </Button>
                                      </div>
                                      <div className="mx-auto grid w-full max-w-[620px] grid-cols-1 gap-2 sm:grid-cols-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="rounded-full h-10 gap-2 font-semibold border-primary/40 text-primary hover:bg-primary/10"
                                          onClick={() => {
                                            if (!topicNode || !subtopicName || !currentFormulaQuestion) return;
                                            if (savedFormulaIdForCurrentQuestion) {
                                              unsaveFormula(savedFormulaIdForCurrentQuestion);
                                              persistSavedContent();
                                              toast({ title: "Removed from Saved Formulas" });
                                              return;
                                            }
                                            const { formula: activeFormula, question: activeQuestion } = currentFormulaQuestion;
                                            const payload: SavedFormula = {
                                              id: `formula-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                                              name: activeFormula.name,
                                              formulaLatex: activeFormula.formulaLatex,
                                              description: activeFormula.description,
                                              bitsQuestions: [{
                                                question: activeQuestion.question,
                                                options: activeQuestion.options,
                                                correctAnswer: getCorrectOptionIndex(activeQuestion),
                                                solution: activeQuestion.solution,
                                              }],
                                              subject: topicNode.subject,
                                              topic: topicNode.topic,
                                              subtopicName,
                                              classLevel: topicNode.classLevel,
                                              unitName: topicNode.topic,
                                              level: difficultyLevel,
                                              board: (board === "icse" ? "ICSE" : "CBSE") as Board,
                                              sectionIndex: subtopicIndex,
                                            };
                                            saveFormula(payload);
                                            persistSavedContent();
                                            toast({ title: "Saved to Saved Formulas" });
                                          }}
                                        >
                                          <Bookmark className={`w-4 h-4 ${savedFormulaIdForCurrentQuestion ? "fill-current" : ""}`} />
                                          {savedFormulaIdForCurrentQuestion ? "Saved" : "Save"}
                                        </Button>
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="rounded-full h-10 gap-2 font-semibold border-primary/40 text-primary hover:bg-primary/10"
                                          onClick={async () => {
                                            const next = regenerateFormulaBitsAlgorithmic(
                                              formula.name,
                                              formula.bitsQuestions ?? []
                                            );
                                            if (next.length > 0) {
                                              const updatedFormulas = practiceFormulasForUi.map((f, i) =>
                                                i === selectedFormulaIdx ? { ...f, bitsQuestions: next } : f
                                              );
                                              setFormulaQuestionsOverride((prev) => ({
                                                ...prev,
                                                [selectedFormulaIdx]: next,
                                              }));
                                              setDbPracticeFormulas(updatedFormulas);
                                              setFormulaBitsCurrentIdx(0);
                                              setFormulaBitsSelectedAnswers({});
                                              try {
                                                if (topicNode && subtopicName) {
                                                  await saveFormulaPractice({
                                                    board: (board === "icse" ? "ICSE" : "CBSE") as Board,
                                                    subject: topicNode.subject as Subject,
                                                    classLevel: topicNode.classLevel as 11 | 12,
                                                    topic: topicNode.topic,
                                                    subtopicName,
                                                    level: difficultyLevel,
                                                    practiceFormulas: updatedFormulas,
                                                  });
                                                }
                                                toast({
                                                  title: "Regenerated and saved",
                                                  description: "Stored in Supabase. Reopening will show this updated set.",
                                                });
                                              } catch (e) {
                                                toast({
                                                  title: e instanceof Error ? e.message : "Save failed",
                                                  description: "Regenerated locally, but Supabase save failed.",
                                                  variant: "destructive",
                                                });
                                              }
                                            }
                                          }}
                                        >
                                          <RefreshCw className="w-4 h-4" />
                                          Regenerate
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })()
                          )}
                        </DialogContent>
                      </Dialog>
                    </div>
          </aside>
              )}
        </div>
      </div>
      <SubjectChatbot
        subject={topicNode.subject}
        topic={topicNode.topic}
        subtopic={!isOverview ? subtopicName : undefined}
        gradeLevel={topicNode.classLevel}
      />
      <SubtopicWheelDialog
        open={wheelOpen}
        onOpenChange={setWheelOpen}
        subtopics={topicNode.subtopics.map((s) => s.name)}
        onSelect={handleWheelSelect}
      />
    </AppLayout>
  );
}
