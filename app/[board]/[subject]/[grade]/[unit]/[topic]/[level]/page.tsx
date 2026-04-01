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
import { ArrowLeft, BookOpen, Zap, ChevronLeft, ChevronRight, Shuffle, Video, FileText, ExternalLink, Lightbulb, Sparkles, Calculator, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import type { DeepDiveReference } from "@/data/deepDiveContent";
import MathText from "@/components/MathText";
import { stripFormulaDelimiters } from "@/lib/stripFormulaDelimiters";
import SubjectChatbot from "@/components/SubjectChatbot";
import InstaCue from "@/components/InstaCue";
import { getInstaCueCards, type InstaCueCard } from "@/data/instaCueCards";
import { useUserStore } from "@/store/useUserStore";
import type { Board, Subject } from "@/types";
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
import { subtopicTheoryIsPlaceholder } from "@/lib/subtopicCompleteness";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { fuzzySubtopicKey } from "@/lib/utils";
import { fetchBitsAttempt, saveBitsAttempt, type BitsAttemptRecord } from "@/lib/bitsAttemptService";
import SubtopicWheelDialog from "@/components/SubtopicWheelDialog";

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

export default function TopicPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const isRandomMode = searchParams.get("mode") === "random";
  const mode = isRandomMode ? "random" : "linear";

  const board = params.board as string;
  const subject = params.subject as string;
  const grade = params.grade as string;
  const unitSlug = params.unit as string;
  const topicSlug = params.topic as string;
  const level = params.level as string;

  const { taxonomy, loading: taxonomyLoading, error: taxonomyError } = useTopicTaxonomy();

  const resolved = useMemo(
    () =>
      resolveTopicFromParams(board, subject, grade, unitSlug, topicSlug, level, taxonomy),
    [board, subject, grade, unitSlug, topicSlug, level, taxonomy]
  );

  const topicNode = resolved?.topicNode ?? null;
  const topicLevelSiblings = useMemo(() => {
    if (!topicNode) return { prev: null, next: null } as const;
    return getSiblingTopics(taxonomy, topicNode);
  }, [taxonomy, topicNode]);
  const isOverview = resolved?.isOverview === true;
  const subtopicIndex = resolved?.subtopicIndex ?? 0;
  const subtopicName = resolved?.subtopicName ?? "";
  const difficultyLevel = (resolved?.level ?? "basics") as DifficultyLevel;
  const user = useUserStore((s) => s.user);
  const saveRevisionCard = useUserStore((s) => s.saveRevisionCard);
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

  // Artifact state (InstaCue AI, Bits, Formulas)
  const [dbInstacueCards, setDbInstacueCards] = useState<ArtifactInstaCueCard[]>([]);
  const [dbBitsQuestions, setDbBitsQuestions] = useState<ArtifactBitsQuestion[]>([]);
  const [dbPracticeFormulas, setDbPracticeFormulas] = useState<ArtifactFormula[]>([]);
  const [generatingInstacue, setGeneratingInstacue] = useState(false);
  const [generatingBits, setGeneratingBits] = useState(false);
  const [generatingFormulas, setGeneratingFormulas] = useState(false);
  const [bitsDialogOpen, setBitsDialogOpen] = useState(false);
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

  const subtopicAiBlockedByTopicHub = useMemo(() => {
    if (isOverview) return false;
    if (!canEditTheory) return false;
    if (topicHubGateLoading) return true;
    return !topicHubGateOk;
  }, [isOverview, canEditTheory, topicHubGateLoading, topicHubGateOk]);

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

  /** InstaCue / Bits / Formulas APIs read theory from `subtopic_content` — enable only after real deep dive is saved. */
  const hasDeepDiveForAiArtifacts = useMemo(() => {
    if (!dbTheoryExists) return false;
    const t = dbTheory.trim();
    if (!t) return false;
    return !subtopicTheoryIsPlaceholder(t);
  }, [dbTheoryExists, dbTheory]);

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
      if (subtopicAiBlockedByTopicHub) {
        toast({
          title: "Topic hub incomplete",
          description: `Generate the topic hub for Basics, Intermediate, and Advanced first (Explore). Missing: ${
            topicHubGateMissing.length ? topicHubGateMissing.join(", ") : "one or more levels"
          }.`,
          variant: "destructive",
        });
        return;
      }
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
      subtopicAiBlockedByTopicHub,
      topicHubGateMissing,
      topicNode,
    ]
  );

  const runDeepDiveGeneration = useCallback(
    async (opts?: { fromSubtopicAi?: boolean }) => {
      if (!topicNode || !subtopicName) return false;
      if (subtopicAiBlockedByTopicHub) {
        toast({
          title: "Topic hub incomplete",
          description: `Generate the topic hub for Basics, Intermediate, and Advanced first. Missing: ${
            topicHubGateMissing.length ? topicHubGateMissing.join(", ") : "one or more levels"
          }.`,
          variant: "destructive",
        });
        return false;
      }
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
      subtopicAiBlockedByTopicHub,
      topicHubGateMissing,
      topicSubtopicPreviews,
    ]
  );

  const runSubtopicAiGeneration = useCallback(async () => {
    if (!topicNode || !subtopicName) return;
    if (subtopicAiBlockedByTopicHub) return;
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
    subtopicAiBlockedByTopicHub,
    subtopicName,
    topicNode,
  ]);

  const runBitsOnly = useCallback(async () => {
    if (!topicNode || !subtopicName || !hasDeepDiveForAiArtifacts) return;
    if (subtopicAiBlockedByTopicHub) return;
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
    hasDeepDiveForAiArtifacts,
    subtopicAiBlockedByTopicHub,
    subtopicName,
    toast,
    topicNode,
  ]);

  const runFormulasOnly = useCallback(async () => {
    if (!topicNode || !subtopicName || !hasDeepDiveForAiArtifacts) return;
    if (subtopicAiBlockedByTopicHub) return;
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
    hasDeepDiveForAiArtifacts,
    subtopicAiBlockedByTopicHub,
    subtopicName,
    toast,
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
      .then((attempt) => {
        if (cancelled) return;
        if (attempt && attempt.bitsSignature === bitsSignature) setBitsAttempt(attempt);
        else setBitsAttempt(null);
      })
      .catch(() => {
        if (!cancelled) setBitsAttempt(null);
      });
    return () => {
      cancelled = true;
    };
  }, [topicNode, isOverview, subtopicName, difficultyLevel, board, bitsSignature, dbBitsQuestions.length]);

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

  if (taxonomyLoading) {
    return (
      <AppLayout>
        <div className="max-w-6xl mx-auto py-6 px-4">
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
          <div className="flex flex-col lg:flex-row gap-8">
            <div className="flex-1 min-w-0 rounded-2xl border-2 border-border p-6 space-y-4">
              <div className="h-4 w-28 rounded bg-muted animate-pulse ml-auto" />
              <div className="h-10 w-3/4 max-w-md rounded-lg bg-muted animate-pulse" />
              <div className="flex gap-2">
                <div className="h-10 w-24 rounded-xl bg-muted animate-pulse" />
                <div className="h-10 w-36 rounded-xl bg-muted/70 animate-pulse" />
                <div className="h-10 w-32 rounded-xl bg-muted/70 animate-pulse" />
              </div>
              <TheoryPanelSkeleton />
              <div className="h-10 w-40 rounded-xl bg-muted animate-pulse" />
            </div>
            <aside className="w-full lg:w-80 shrink-0">
              <TheoryPanelSkeleton />
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

  const backHref = `/explore-1?subject=${topicNode.subject}&class=${topicNode.classLevel}&unit=${unitSlug}`;
  const spinAgainHref = `/explore-1?subject=${topicNode.subject}&class=${topicNode.classLevel}&unit=${unitSlug}&spin=1`;

  const allStackPlaceholders =
    subtopicStackRows.length > 0 && subtopicStackRows.every((r) => r.isPh);
  const activeTheory = dbTheoryExists ? dbTheory : focusedSubtopicTheoryData?.theory ?? "";
  const focusedTheoryIsPh =
    !focusedSubtopicTheoryData ||
    (!dbTheoryExists && subtopicTheoryIsPlaceholder(focusedSubtopicTheoryData.theory));
  const overviewHref = buildTopicOverviewPath(
    board,
    topicNode.subject,
    topicNode.classLevel,
    topicNode.topic,
    difficultyLevel,
    isRandomMode ? "random" : undefined
  );
  const prevSubtopic = !isOverview && subtopicIndex > 0 ? topicNode.subtopics[subtopicIndex - 1] : null;
  const nextSubtopic =
    !isOverview && subtopicIndex < topicNode.subtopics.length - 1 ? topicNode.subtopics[subtopicIndex + 1] : null;
  const prevSubtopicHref = prevSubtopic
    ? buildTopicPath(
        board,
        topicNode.subject,
        topicNode.classLevel,
        topicNode.topic,
        prevSubtopic.name,
        difficultyLevel,
        isRandomMode ? "random" : undefined
      )
    : null;
  const nextSubtopicHref = nextSubtopic
    ? buildTopicPath(
        board,
        topicNode.subject,
        topicNode.classLevel,
        topicNode.topic,
        nextSubtopic.name,
        difficultyLevel,
        isRandomMode ? "random" : undefined
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
      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild className="rounded-full font-bold -ml-1">
            <Link href={backHref}>
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Link>
          </Button>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-sm font-bold text-primary">
            <Zap className="w-4 h-4" />
            {topicNode.subject.charAt(0).toUpperCase() + topicNode.subject.slice(1)}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-muted text-sm font-bold text-muted-foreground">
            Class {topicNode.classLevel}
          </span>
          <span className="px-3 py-1.5 rounded-full bg-primary/10 text-sm font-bold text-primary">
            {(params.board as string).toUpperCase()}
          </span>
        </div>

        <div className="mb-4">
          <p className="text-sm text-foreground font-bold flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            {topicNode.unitLabel ?? "Unit"}: {topicNode.unitTitle ?? topicNode.topic}
            {topicNode.totalPeriods != null && (
              <span className="font-semibold text-muted-foreground"> · {topicNode.totalPeriods} periods</span>
            )}
          </p>
          {topicNode.chapterTitle && (
            <p className="text-xs text-foreground font-semibold mt-1.5">
              Chapter: {topicNode.chapterTitle} · Topic: {topicNode.topic}
            </p>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <main className="flex-1 min-w-0">
            <div className={`edu-card p-6 rounded-2xl border-2 shadow-lg ${mainCardBorderClass}`}>
              {isOverview ? (
                <>
                  <div className="flex justify-end mb-3">
                    <span className="text-sm font-extrabold text-muted-foreground">Topic hub</span>
                  </div>
                  <h1 className="font-black text-3xl tracking-tight text-foreground mb-4">{topicNode.topic}</h1>

                  {mode === "linear" && (
                    <div className="flex flex-wrap gap-2 mb-6">
                      {LEVELS.map(({ value, label }) => {
                        const href = buildTopicOverviewPath(
                          board,
                          topicNode.subject,
                          topicNode.classLevel,
                          topicNode.topic,
                          value,
                          isRandomMode ? "random" : undefined
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
                      <div className="theory-content text-[15px] leading-relaxed mb-6">
                        <TheoryContent theory={topicWhyStudy} />
                      </div>
                    ) : !topicContentExists && topicIntroMarkdown.trim() ? (
                      <div className="theory-content text-[15px] leading-relaxed mb-6">
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
                          className="rounded-2xl border-2 border-border bg-muted/20 p-4 sm:p-5 transition-shadow"
                        >
                          <h3 className="font-extrabold text-base flex min-w-0 items-center gap-2 mb-3">
                            <span className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm font-extrabold text-black dark:text-white shrink-0">
                              {idx + 1}
                            </span>
                            <span className="subtopic-title-text break-words min-w-0 flex-1">
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
                            <div className="theory-content text-[15px] leading-relaxed text-muted-foreground">
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
                      More in this chapter
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {topicLevelSiblings.prev ? (
                        <Button
                          asChild
                          variant="outline"
                          className="h-auto min-h-[3.25rem] w-full justify-start rounded-xl border-2 px-4 py-3 font-semibold shadow-sm hover:bg-muted/50"
                        >
                          <Link
                            href={buildTopicOverviewPath(
                              board,
                              topicLevelSiblings.prev.subject,
                              topicLevelSiblings.prev.classLevel,
                              topicLevelSiblings.prev.topic,
                              difficultyLevel,
                              isRandomMode ? "random" : undefined
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
                            href={buildTopicOverviewPath(
                              board,
                              topicLevelSiblings.next.subject,
                              topicLevelSiblings.next.classLevel,
                              topicLevelSiblings.next.topic,
                              difficultyLevel,
                              isRandomMode ? "random" : undefined
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
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                    <Button asChild variant="outline" size="sm" className="rounded-xl font-bold w-fit">
                      <Link href={overviewHref}>
                        <ArrowLeft className="w-4 h-4 mr-1" /> Topic overview
                      </Link>
                    </Button>
                    <span className="text-sm font-extrabold text-muted-foreground">Subtopic deep dive</span>
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    <span className="shrink-0">Topic: </span>
                    <span className="text-foreground">{topicNode.topic}</span>
                  </p>
                  <h1 className="font-black text-xl sm:text-2xl tracking-tight text-foreground mb-4 min-w-0 break-words">
                    <MathText
                      weight="extrabold"
                      className="subtopic-title-text break-words [&_.katex]:!text-[0.8em] sm:[&_.katex]:!text-[0.88em]"
                    >
                      {subtopicDeepDiveHeadingMarkdown(subtopicName)}
                    </MathText>
                  </h1>

                  <section className="mb-2">
                    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                      <h2 className="shrink-0 text-base font-extrabold text-primary uppercase tracking-wide">
                        Theory
                      </h2>
                      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
                        {canEditTheory && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 whitespace-nowrap rounded-lg"
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
                        )}
                        {canEditTheory && topicNode && subtopicName && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0 whitespace-nowrap rounded-lg gap-2 font-bold"
                            disabled={
                              subtopicAiBlockedByTopicHub ||
                              generatingDeepDive ||
                              generatingInstacue ||
                              generatingBits ||
                              generatingFormulas ||
                              loadingDbTheory ||
                              completingSubtopicAll
                            }
                            title={
                              "Generate this subtopic Deep Dive, then InstaCue, Bits, and practice formulas."
                            }
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
                        )}
                        {canEditTheory && topicNode && subtopicName && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="shrink-0 whitespace-nowrap rounded-lg gap-2 font-bold"
                            disabled={
                              subtopicAiBlockedByTopicHub ||
                              generatingDeepDive ||
                              loadingDbTheory ||
                              completingSubtopicAll
                            }
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
                        )}
                        {canEditTheory && topicNode && subtopicName && (
                          <>
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
                        Subtopic AI is locked until the topic hub exists for Basics, Intermediate, and Advanced
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
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="rounded-full gap-2 font-semibold border-primary text-foreground bg-primary/5 hover:bg-primary/10"
                    >
                      <BookOpen className="w-4 h-4 text-foreground" />
                      Video &amp; Reading References
                    </Button>
                  </DialogTrigger>
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

          <aside className="w-full lg:w-80 xl:w-96 shrink-0">
            <div className="lg:sticky lg:top-24 space-y-4">
              {isOverview && (
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
                          const href = buildTopicPath(
                            board,
                            topicNode.subject,
                            topicNode.classLevel,
                            topicNode.topic,
                            st.name,
                            difficultyLevel,
                            undefined
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

              {!isOverview && (
                <>
                  {/* InstaCue Section */}
                  <InstaCue
                    cards={sidebarInstaCueCards}
                    topicName={topicNode.topic}
                    subtopicName={subtopicName}
                    level={difficultyLevel as "basics" | "intermediate" | "advanced"}
                    subject={topicNode.subject}
                    classLevel={topicNode.classLevel}
                    onAddCard={
                      user
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

                  {/* AI Generate InstaCue Cards (admin only): visible always; enabled after Deep Dive is saved to Supabase */}
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
                          subtopicAiBlockedByTopicHub ||
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

                  {/* Bits & Formulas Section */}
                  <section className="edu-card rounded-2xl p-4 border border-border space-y-4">
                    {/* --- Bits (MCQs) --- */}
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">
                        Want to recall what you&apos;ve read?
                      </p>
                      {canEditTheory && (
                        <div className="flex justify-end mb-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg gap-1.5 text-xs font-bold text-primary disabled:opacity-50"
                            disabled={
                              subtopicAiBlockedByTopicHub ||
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
                      <Dialog
                        open={bitsDialogOpen}
                        onOpenChange={(open) => {
                          setBitsDialogOpen(open);
                          if (!open) {
                            setBitsCurrentIdx(0);
                            setBitsSelectedAnswers({});
                            setBitsReviewMode(false);
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full rounded-xl gap-2 font-bold border-primary/40 text-primary"
                          >
                            <Zap className="w-4 h-4" />
                            Bits{dbBitsQuestions.length > 0 ? ` (${dbBitsQuestions.length})` : ""}
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl max-h-[82vh] overflow-y-auto">
                          <DialogHeader className="space-y-1">
                            <DialogTitle className="text-[1.05rem] font-bold tracking-tight leading-snug text-foreground pr-8">
                              <span>Bits — </span>
                              <span className="font-bold">Subtopic {subtopicIndex + 1}</span>
                              <span>: </span>
                              <MathText as="span" weight="semibold" className="font-semibold">
                                {displaySubtopicTitle}
                              </MathText>
                              <span className="text-foreground/70"> (Level: {LEVELS.find((l) => l.value === difficultyLevel)?.label ?? difficultyLevel})</span>
                            </DialogTitle>
                            <DialogDescription className="text-xs">Test your understanding</DialogDescription>
                          </DialogHeader>
                          {dbBitsQuestions.length === 0 ? (
                            <div className="py-6 text-center">
                              <p className="text-sm text-muted-foreground mb-3">No Bits generated yet for this subtopic.</p>
                              <p className="text-xs text-muted-foreground">
                                First run <span className="font-semibold text-foreground">Generate Deep Dive</span> so theory is
                                saved to Supabase, then click{" "}
                                <span className="font-semibold text-foreground">Generate Bits</span> to create questions.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-3">
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
                                const isCorrectSelection =
                                  answered && q.options[selected] === q.correctAnswer;
                                const useTwoColumns = shouldUseTwoColumnOptions(q.options);
                                return (
                                  <>
                                    <div className="flex items-center justify-center">
                                      <span
                                        className="text-xs font-semibold text-muted-foreground"
                                        aria-live="polite"
                                      >
                                        Question {bitsCurrentIdx + 1} of {dbBitsQuestions.length}
                                      </span>
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
                                        aria-label={`Answers for question ${bitsCurrentIdx + 1}`}
                                      >
                                        {q.options.map((opt, oi) => {
                                          const isCorrect = opt === q.correctAnswer;
                                          let cls = "bg-muted/70 hover:bg-muted text-foreground border-border";
                                          if (answered) {
                                            if (isCorrect) cls = "bg-green-500/12 border-green-500 text-foreground";
                                            else if (selected === oi && !isCorrectSelection) {
                                              cls = "bg-destructive/10 border-destructive text-foreground";
                                            } else cls = "bg-muted/60 text-muted-foreground border-border";
                                          }
                                          return (
                                            <button
                                              key={oi}
                                              type="button"
                                              disabled={answered}
                                              onClick={() =>
                                                setBitsSelectedAnswers((prev) => ({ ...prev, [bitsCurrentIdx]: oi }))
                                              }
                                              role="radio"
                                              aria-checked={selected === oi}
                                              aria-label={`Option ${String.fromCharCode(65 + oi)}`}
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
                                      <div className="flex items-center justify-between gap-2 pt-1">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="rounded-xl h-8 px-3 text-xs min-w-24"
                                          onClick={() => setBitsCurrentIdx((i) => Math.max(0, i - 1))}
                                          disabled={bitsCurrentIdx === 0}
                                          aria-label="Go to previous question"
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
                                            const answeredCount = Object.keys(bitsSelectedAnswers).length;
                                            if (answeredCount < total) {
                                              toast({
                                                title: "Answer all questions before submit",
                                                description: `${answeredCount}/${total} answered`,
                                              });
                                              return;
                                            }
                                            const correctCount = dbBitsQuestions.reduce((acc, item, idx) => {
                                              const selectedIdx = bitsSelectedAnswers[idx];
                                              if (typeof selectedIdx !== "number") return acc;
                                              return item.options[selectedIdx] === item.correctAnswer ? acc + 1 : acc;
                                            }, 0);
                                            const wrongCount = total - correctCount;
                                            if (!topicNode || !subtopicName) return;
                                            const boardName = (board === "icse" ? "ICSE" : "CBSE") as Board;
                                            const payload: BitsAttemptRecord = {
                                              board: boardName,
                                              subject: topicNode.subject,
                                              classLevel: topicNode.classLevel,
                                              topic: topicNode.topic,
                                              subtopicName,
                                              level: difficultyLevel,
                                              bitsSignature,
                                              totalQuestions: total,
                                              correctCount,
                                              wrongCount,
                                              selectedAnswers: Object.fromEntries(
                                                Object.entries(bitsSelectedAnswers).map(([k, v]) => [String(k), v])
                                              ),
                                              submittedAt: new Date().toISOString(),
                                            };
                                            setSubmittingBits(true);
                                            try {
                                              const persisted = await saveBitsAttempt(payload);
                                              setBitsAttempt(persisted);
                                              setBitsReviewMode(false);
                                              toast({
                                                title: "Bits submitted",
                                                description: `Correct: ${correctCount}, Wrong: ${wrongCount}`,
                                              });
                                            } catch {
                                              toast({
                                                title: "Failed to save result",
                                                description: "Please retry submit.",
                                                variant: "destructive",
                                              });
                                            } finally {
                                              setSubmittingBits(false);
                                            }
                                          }}
                                          disabled={
                                            submittingBits ||
                                            (bitsCurrentIdx === dbBitsQuestions.length - 1 &&
                                              Object.keys(bitsSelectedAnswers).length < dbBitsQuestions.length)
                                          }
                                          aria-label={bitsCurrentIdx === dbBitsQuestions.length - 1 ? "Submit bits test" : "Go to next question"}
                                        >
                                          {bitsCurrentIdx === dbBitsQuestions.length - 1 ? (
                                            submittingBits ? (
                                              <>
                                                <Loader2 className="w-4 h-4 mr-1 animate-spin" /> Submitting
                                              </>
                                            ) : (
                                              "Submit"
                                            )
                                          ) : (
                                            <>
                                              Next <ChevronRight className="w-4 h-4 ml-1" />
                                            </>
                                          )}
                                        </Button>
                                      </div>
                                      {answered && q.solution && (
                                        <div className="mt-2 p-3 rounded-xl bg-muted/50 text-sm text-muted-foreground">
                                          <p className="font-bold text-foreground mb-1">Explanation</p>
                                          <MathText>{q.solution}</MathText>
                                        </div>
                                      )}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      {dbBitsQuestions.length === 0 && !canEditTheory && (
                        <p className="text-xs text-muted-foreground mt-2">
                          No bits data yet for this subtopic and level.
                        </p>
                      )}
                    </div>

                    {/* --- Practice Formulas --- */}
                    <div>
                      <p className="text-sm font-medium text-foreground mb-2">
                        Want to practice formulas?
                      </p>
                      {canEditTheory && (
                        <div className="flex justify-end mb-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg gap-1.5 text-xs font-bold text-primary disabled:opacity-50"
                            disabled={
                              subtopicAiBlockedByTopicHub ||
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
                      <Dialog
                        open={formulasDialogOpen}
                        onOpenChange={(open) => {
                          setFormulasDialogOpen(open);
                          if (!open) {
                            setSelectedFormulaIdx(null);
                            setFormulaBitsCurrentIdx(0);
                            setFormulaBitsSelectedAnswers({});
                            setFormulaQuestionsOverride({});
                          }
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full rounded-xl gap-2 font-bold border-primary/40 text-primary"
                          >
                            <Calculator className="w-4 h-4" />
                            Practice Formulas{practiceFormulasForUi.length > 0 ? ` (${practiceFormulasForUi.length})` : ""}
                          </Button>
                        </DialogTrigger>
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
                              <p className="text-xs text-muted-foreground">
                                First run <span className="font-semibold text-foreground">Generate Deep Dive</span>, then{" "}
                                <span className="font-semibold text-foreground">Generate Practice Formulas</span> to generate
                                formula practice.
                              </p>
                            </div>
                          ) : selectedFormulaIdx === null ? (
                            <div className="space-y-4">
                              {practiceFormulasForUi.map((f, fi) => (
                                <button
                                  key={fi}
                                  type="button"
                                  className="w-full text-left rounded-2xl border border-border p-4 space-y-2 hover:border-primary/50 hover:bg-muted/20 transition-colors"
                                  onClick={() => {
                                    setSelectedFormulaIdx(fi);
                                    setFormulaBitsCurrentIdx(0);
                                    setFormulaBitsSelectedAnswers({});
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
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full max-w-[620px] mx-auto rounded-full h-10 gap-2 font-semibold border-primary/40 text-primary hover:bg-primary/10"
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
                              );
                            })()
                          )}
                        </DialogContent>
                      </Dialog>
                      {practiceFormulasForUi.length === 0 && !canEditTheory && (
                        <p className="text-xs text-muted-foreground mt-2">
                          No formulas data yet for this subtopic and level.
                        </p>
                      )}
                    </div>
                  </section>
                </>
              )}
            </div>
          </aside>
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
