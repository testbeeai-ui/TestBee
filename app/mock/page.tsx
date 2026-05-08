"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import AppLayout from "@/components/AppLayout";
import { useUserStore } from "@/store/useUserStore";
import { useAuth } from "@/hooks/useAuth";
import { getMockQuestions, questions as questionBank } from "@/data/questions";
import { useTheme } from "next-themes";
import { NtaMockTokens, type NtaSkin } from "@/components/prep-mock/nta/NtaMockTokens";
import { NtaGeneralInstructions } from "@/components/prep-mock/nta/NtaGeneralInstructions";
import { NtaProceedWarningDialog } from "@/components/prep-mock/nta/NtaProceedWarningDialog";
import { NtaExamShell } from "@/components/prep-mock/nta/NtaExamShell";
import { NtaSubmitModal } from "@/components/prep-mock/nta/NtaSubmitModal";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ToastAction } from "@/components/ui/toast";
import {
  ClipboardList,
  Clock,
  BookOpen,
  Target,
  Lightbulb,
  CheckCircle2,
  XCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  ArrowLeft,
  Search,
  FileQuestion,
  Award,
  GraduationCap,
  ShieldCheck,
  ListOrdered,
  Loader2,
  MessageCircle,
  Shuffle,
  Users,
} from "lucide-react";
import type { MockPaper, Question, Subject } from "@/types";
import {
  filterMockPapers,
  mockPaperTypeLabel,
  type LibraryCategoryFilter,
} from "@/lib/mockPapersCatalog";
import {
  fetchMockPapersFromSupabase,
  fetchMockQuestionsForPaper,
} from "@/lib/mockPapersFromSupabase";
import { useToast } from "@/hooks/use-toast";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

import PrepMockSidebar from "@/components/prep-mock/PrepMockSidebar";
import PrepMockStatCards from "@/components/prep-mock/PrepMockStatCards";
import ClassesSection from "@/components/prep-mock/ClassesSection";
import MockTestsSection from "@/components/prep-mock/MockTestsSection";
import StreakCalendar from "@/components/prep-mock/StreakCalendar";
import RevisionInstaCueSection from "@/components/prep-mock/RevisionInstaCueSection";
import { fetchSavedContent } from "@/lib/savedContentService";
import { mergeAllSavedContent } from "@/lib/mergeSavedContent";
import { incrementPrepCalendarDay, localDayISO } from "@/lib/prepCalendarClient";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import katex from "katex";
import { fireAssignmentTaskSync } from "@/lib/classroom/syncAssignmentTaskProgress";
import { buildWhatsAppShareUrl } from "@/lib/referChallengeShareUrls";
import {
  buildMockShareTemplates,
  getMockShareOutcome,
  pickNextMockShareTemplate,
} from "@/lib/mockTestShareTemplates";

const QUICK_DURATIONS = [60, 90, 180] as const;

/** Dashboard “Investor” spotlight — matches `scripts/import-jee-main-mock-csv.ts` slug. */
const FEATURED_DASHBOARD_PYQ_SLUG = "jee-main-2019-01-10-shift-1";

type View = "landing" | "setup" | "nta_instructions" | "test" | "results";

type NtaExamKind = "paper" | "quick";

type NtaPendingExamMeta = {
  kind: NtaExamKind;
  paper: MockPaper | null;
  durationMin: number;
  questionCount: number;
  titleLine: string;
  subjectLine: string;
  markingScheme: string;
  /** Quick mock only: subjects used after proceed */
  quickSubjects?: Subject[];
};

function estimateQuickQuestionCount(
  subjects: Subject[],
  classLevel: number,
  durationMin: number
): number {
  const eligible = questionBank.filter(
    (q) => subjects.includes(q.subject) && q.classLevel <= classLevel
  ).length;
  return Math.max(1, Math.min(Math.ceil(durationMin / 2.5), eligible || 1));
}

/** Library category tabs + dedicated Quick Mock tab */
type SetupLibraryTab = LibraryCategoryFilter | "quick";

const subjectEmojis: Record<Subject, string> = {
  physics: "⚡",
  chemistry: "🧪",
  math: "📐",
};

/** Decode common HTML entities found in mock question/solution text. */
function decodeMockEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&minus;/gi, "\u2212")
    .replace(/&times;/gi, "\u00D7")
    .replace(/&middot;/gi, "\u00B7")
    .replace(/&#92;/g, "\\")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&")
    .replace(/&[a-zA-Z0-9]+;/g, " ");
}

/**
 * Render text that may contain \(...\) \[...\] $$...$$ math into an HTML string.
 * Calls katex.renderToString directly — no MathText heuristics involved.
 */
function renderMockLatexToHtml(raw: string): string {
  if (!raw.trim()) return "";

  // 1. Decode HTML entities
  let s = decodeMockEntities(raw.trim());

  // 2. Normalize over-escaped backslashes before delimiters and commands
  s = s.replace(/\\{2,}([()[\]{}])/g, "\\$1");
  s = s.replace(/\\{2,}([A-Za-z])/g, "\\$1");

  const hasMathDelimiters =
    /\\\[[\s\S]+?\\\]/.test(s) ||
    /\\\([\s\S]+?\\\)/.test(s) ||
    /\$\$[\s\S]+?\$\$/.test(s) ||
    /\$[^\n$]+?\$/.test(s);

  const looksLikeLatexBlock =
    !hasMathDelimiters &&
    (/[\\][A-Za-z]+/.test(s) || /\\frac\s*\{/.test(s) || /\\sum\b|\\int\b|\\lim\b/.test(s));

  const repairLatex = (inner: string) =>
    inner
      // Fix known corrupt tokens seen in some mock exports.
      .replace(/\\lim_limits\b/g, "\\lim\\limits")
      .replace(/\\(leftarrow|rightarrow)row\b/g, "\\$1")
      // Normalize malformed command spacing: \text t -> \text{t}
      .replace(/\\text\s+([^\\{}]+?)(?=\\[A-Za-z]|$)/g, (_m, g1: string) => `\\text{${g1.trim()}}`)
      .replace(/\\(mathrm|mathbf|mathit|operatorname)\s+([A-Za-z0-9]+)/g, "\\$1{$2}")
      // Common payload issues: bare greek words/commands with broken braces
      .replace(/\\(theta|alpha|beta|gamma|delta|lambda|mu|pi|rho|sigma|phi|omega)\b/g, "\\$1")
      // Normalize escaped delimiters that leak into inner math
      .replace(/\\\(/g, "")
      .replace(/\\\)/g, "")
      .replace(/\\\[/g, "")
      .replace(/\\\]/g, "")
      // Basic corrupted command recovery
      .replace(/\\{2,}(?=[A-Za-z])/g, "\\")
      .replace(/\\uparrowrac\b/g, "\\frac")
      .replace(/\\[A-Za-z^]*rac(?=\s*\{)/g, "\\frac")
      // Normalize Unicode operators to TeX-friendly forms
      .replace(/\u2212/g, "-")
      .replace(/\u00D7/g, "\\times ")
      .replace(/\u00B7/g, "\\cdot ")
      // Keep matrix row separators and avoid collapsing meaningful spaces
      .replace(/[ \t]+/g, " ")
      .trim();

  // If there's no explicit delimiters but it looks like a LaTeX block,
  // render the entire payload as display math.
  if (looksLikeLatexBlock) {
    const repaired = repairLatex(s);
    try {
      const html = katex.renderToString(repaired, {
        displayMode: true,
        throwOnError: false,
        output: "html",
        strict: false,
      });
      if (!html.includes("katex-error")) {
        return `<span class="block overflow-x-auto my-1 text-center">${html}</span>`;
      }
    } catch {
      // fall through to delimiter-based rendering
    }
  }

  // 3. Split on math delimiters, render each math block with KaTeX
  const result: string[] = [];
  const pattern = /(\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\$\$[\s\S]+?\$\$|\$[^\n$]+?\$)/g;
  let last = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(s)) !== null) {
    // plain text before this math block
    if (match.index > last) {
      const txt = s.slice(last, match.index);
      result.push(
        txt
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br>")
      );
    }

    const full = match[0];
    const isDisplay = full.startsWith("\\[") || full.startsWith("$$");
    // strip outer delimiters to get inner LaTeX
    const inner = full
      .replace(/^\\\(/, "")
      .replace(/\\\)$/, "")
      .replace(/^\\\[/, "")
      .replace(/\\\]$/, "")
      .replace(/^\$\$/, "")
      .replace(/\$\$$/, "")
      .replace(/^\$/, "")
      .replace(/\$$/, "")
      .trim();

    try {
      const firstPass = katex.renderToString(inner, {
        displayMode: isDisplay,
        throwOnError: false,
        output: "html",
        strict: false,
      });

      if (!firstPass.includes("katex-error")) {
        result.push(
          isDisplay
            ? `<span class="block overflow-x-auto my-1 text-center">${firstPass}</span>`
            : firstPass
        );
      } else {
        // Retry with progressively repaired latex (UI-only fix; no DB mutation)
        const repaired = repairLatex(inner);

        const secondPass = katex.renderToString(repaired, {
          displayMode: isDisplay,
          throwOnError: false,
          output: "html",
          strict: false,
        });

        if (!secondPass.includes("katex-error")) {
          result.push(
            isDisplay
              ? `<span class="block overflow-x-auto my-1 text-center">${secondPass}</span>`
              : secondPass
          );
        } else {
          // Final fallback: preserve readable raw text instead of broken HTML
          result.push(full.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
        }
      }
    } catch {
      result.push(full.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"));
    }

    last = match.index + full.length;
  }

  // remaining plain text
  if (last < s.length) {
    result.push(
      s
        .slice(last)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\n/g, "<br>")
    );
  }

  return result.join("");
}

/**
 * Renders mock question / option / solution text that may contain LaTeX or HTML.
 * Uses direct KaTeX rendering for reliable math output.
 */
function ReviewInlineHtml({ text, block = false }: { text: string; block?: boolean }) {
  const rawTrimmed = text.trim();
  if (!rawTrimmed) return null;

  // Strip HTML tags (preserve line breaks) then render through KaTeX
  let src = rawTrimmed;
  if (src.includes("<") && /<[a-zA-Z][\s\S]*?>/.test(src)) {
    src = src
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ");
  }

  const html = renderMockLatexToHtml(src);

  return (
    <span
      className={cn(
        "[&_.katex]:text-[0.97em] [&_.katex-display]:my-1",
        block ? "block leading-relaxed" : "inline align-middle"
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MockPage() {
  const { toast } = useToast();
  const { user: authUser, session, profile, refreshProfile } = useAuth();
  const setRdmFromProfile = useUserStore((s) => s.setRdmFromProfile);
  const { resolvedTheme } = useTheme();
  const searchParams = useMemo(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.search);
  }, []);
  const ntaSkin: NtaSkin = resolvedTheme === "dark" ? "dark" : "light";
  const user = useUserStore((s) => s.user);
  const allResults = useUserStore((s) => s.allResults);

  const [nextClassInfo, setNextClassInfo] = useState<{ name: string; time: string } | null>(null);
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);
  const mockCalendarLoggedRef = useRef(false);
  /** Dedupes bonus claim effect (e.g. React Strict Mode) per finished attempt. */
  const mockRdmBonusClaimEndTimeRef = useRef<number | null>(null);

  const subjects: Subject[] = useMemo(() => ["physics", "chemistry", "math"], []);

  const [view, setView] = useState<View>("landing");
  const [duration, setDuration] = useState<number>(90);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [libraryTab, setLibraryTab] = useState<SetupLibraryTab>("all");
  const [librarySearch, setLibrarySearch] = useState("");
  const [librarySubjectFilter, setLibrarySubjectFilter] = useState<Subject | "all">("all");
  const [catalogPapers, setCatalogPapers] = useState<MockPaper[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [ntaProceedBusy, setNtaProceedBusy] = useState(false);
  const [ntaPendingMeta, setNtaPendingMeta] = useState<NtaPendingExamMeta | null>(null);
  const [ntaInstructionBackView, setNtaInstructionBackView] = useState<"landing" | "setup">(
    "setup"
  );
  const [featuredCatalogLoading, setFeaturedCatalogLoading] = useState(false);
  const [ntaWarningOpen, setNtaWarningOpen] = useState(false);
  const [visitedQuestionIds, setVisitedQuestionIds] = useState<Set<string>>(() => new Set());
  const [activeExamTitle, setActiveExamTitle] = useState<string | null>(null);
  /** Set for catalog papers only; used for server-verified +50 RDM bonus (>=60% score). */
  const [activePaperId, setActivePaperId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  const [reviewSubjectFilter, setReviewSubjectFilter] = useState<Subject | "all">("all");
  const [mockShareTemplateIndex, setMockShareTemplateIndex] = useState(0);
  const [mockPostPreviewOpen, setMockPostPreviewOpen] = useState(false);
  const [mockPostingToFeed, setMockPostingToFeed] = useState(false);
  const [mockShareRewardRdm, setMockShareRewardRdm] = useState(40);
  const [mockScoreBonusRdm, setMockScoreBonusRdm] = useState(50);

  const deepLinkPaperSlug = (searchParams.get("paper") ?? "").trim();
  const trackingClassroomId = (searchParams.get("classroomId") ?? "").trim();
  const trackingPostId = (searchParams.get("postId") ?? "").trim();
  const initialViewParam = (searchParams.get("view") ?? "").trim().toLowerCase();
  const isReviewMode = false;

  const totalSeconds = duration * 60;
  const effectiveSubject = selectedSubject ?? subjects[0] ?? null;

  const handleFinishTest = useCallback(async () => {
    const finishedAt = Date.now();
    setEndTime(finishedAt);
    setView("results");
    setSubmitDialogOpen(false);

    // If the mock was opened from a classroom assignment, persist the attempt so
    // the classroom feed can show "Done" and teachers can review.
    if (authUser?.id && trackingClassroomId && trackingPostId && questions.length > 0) {
      const computedCorrectCount = questions.filter((q) => answers[q.id] === q.correctAnswer).length;
      const orderedAnswers = questions.map((q) => {
        const v = answers[q.id];
        return typeof v === "number" ? v : -1;
      });
      try {
        const genericClient = supabase as unknown as {
          from: (table: string) => {
            upsert: (
              values: Record<string, unknown>,
              options: { onConflict: string }
            ) => Promise<{ error?: { message?: string } | null }>;
          };
        };
        await genericClient.from("classroom_generated_test_attempts").upsert(
          {
            classroom_id: trackingClassroomId,
            post_id: trackingPostId,
            user_id: authUser.id,
            answers_json: orderedAnswers,
            score: computedCorrectCount,
            total: questions.length,
            submitted_at: new Date(finishedAt).toISOString(),
          },
          { onConflict: "post_id,user_id" }
        );
        // Immediately sync assignment checklist completion for mock-paper tasks.
        // This keeps the student "Your tasks" state aligned with the submit action.
        fireAssignmentTaskSync(["mock_paper"]);
      } catch {
        // Non-fatal — student can still see results; tracking can be retried by reopening.
      }
    }

    if (!mockCalendarLoggedRef.current && authUser?.id) {
      mockCalendarLoggedRef.current = true;
      const day = localDayISO(new Date());
      void incrementPrepCalendarDay(session?.access_token, "mock", day).then((ok) => {
        if (ok) setCalendarRefreshKey((k) => k + 1);
      });
    }
  }, [
    answers,
    authUser?.id,
    questions,
    session?.access_token,
    trackingClassroomId,
    trackingPostId,
  ]);

  useEffect(() => {
    if (view !== "test" || startTime == null) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      const left = Math.max(0, totalSeconds - elapsed);
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(interval);
        handleFinishTest();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [view, startTime, totalSeconds, handleFinishTest]);

  useEffect(() => {
    if (view !== "test" || questions.length === 0) return;
    const id = questions[currentIndex]?.id;
    if (!id) return;
    setVisitedQuestionIds((prev) => new Set(prev).add(id));
  }, [view, currentIndex, questions]);

  const startQuickTest = useCallback(() => {
    if (!user) return;
    const chosenSubjects = effectiveSubject ? [effectiveSubject] : subjects;
    const qc = estimateQuickQuestionCount(chosenSubjects, user.classLevel ?? 11, duration);
    setNtaPendingMeta({
      kind: "quick",
      paper: null,
      durationMin: duration,
      questionCount: qc,
      titleLine: "Quick mock",
      subjectLine: `${chosenSubjects.map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(", ")} · ${duration} min timed practice`,
      markingScheme: "Adaptive question pool; scoring shown after submit.",
      quickSubjects: chosenSubjects,
    });
    setView("nta_instructions");
  }, [duration, effectiveSubject, subjects, user]);

  const handleNtaProceed = useCallback(
    async (declarationAccepted: boolean) => {
      if (!declarationAccepted) {
        setNtaWarningOpen(true);
        return;
      }
      if (!user) return;
      const meta = ntaPendingMeta;
      if (!meta) return;
      setNtaWarningOpen(false);
      setNtaProceedBusy(true);
      try {
        let qs: Question[];
        let examTitle: string | null;
        const durationMin = meta.durationMin;
        let subjectsForSession: Subject[];

        if (meta.kind === "paper" && meta.paper) {
          qs = await fetchMockQuestionsForPaper(meta.paper.id);
          if (qs.length === 0) {
            toast({
              title: "No questions for this paper",
              description: "Run the JEE CSV import or pick another paper.",
              variant: "destructive",
            });
            return;
          }
          subjectsForSession = meta.paper.subjectsCovered?.length
            ? meta.paper.subjectsCovered
            : [meta.paper.subject];
          examTitle = meta.paper.title;
        } else {
          subjectsForSession = meta.quickSubjects ?? subjects;
          qs = getMockQuestions(subjectsForSession, user.classLevel ?? 11, durationMin);
          examTitle = null;
        }

        mockCalendarLoggedRef.current = false;
        mockRdmBonusClaimEndTimeRef.current = null;
        setDuration(durationMin);
        if (subjectsForSession.length === 1) setSelectedSubject(subjectsForSession[0]!);
        setQuestions(qs);
        setCurrentIndex(0);
        setAnswers({});
        setFlagged(new Set());
        setVisitedQuestionIds(new Set());
        setStartTime(Date.now());
        setEndTime(null);
        setSecondsLeft(durationMin * 60);
        setActiveExamTitle(examTitle);
        if (meta.kind === "paper" && meta.paper) {
          setActivePaperId(meta.paper.id);
        } else {
          setActivePaperId(null);
        }
        setNtaPendingMeta(null);
        setView("test");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Could not load questions";
        toast({ title: "Could not start", description: message, variant: "destructive" });
      } finally {
        setNtaProceedBusy(false);
      }
    },
    [user, ntaPendingMeta, subjects, toast]
  );

  const openNtaInstructionsForPaper = useCallback(
    (paper: MockPaper, back: "landing" | "setup" = "setup") => {
      setNtaInstructionBackView(back);
      setNtaPendingMeta({
        kind: "paper",
        paper,
        durationMin: paper.durationMinutes,
        questionCount: paper.questionsCount,
        titleLine: paper.title,
        subjectLine: paper.title,
        markingScheme: paper.markingScheme,
      });
      setView("nta_instructions");
    },
    []
  );

  useEffect(() => {
    if (!deepLinkPaperSlug) return;
    if (isReviewMode) return;
    let cancelled = false;

    const ensureCatalogThenOpen = async () => {
      try {
        // Ensure papers are available (deep links bypass the landing/setup loaders).
        const papers = catalogPapers.length > 0 ? catalogPapers : await fetchMockPapersFromSupabase();
        if (cancelled) return;
        if (catalogPapers.length === 0) setCatalogPapers(papers);

        const paper = papers.find((p) => p.slug === deepLinkPaperSlug) ?? null;
        if (!paper) return;

        // Jump straight into the NTA instructions flow (not the Prep+Mock dashboard sections).
        openNtaInstructionsForPaper(paper, "landing");
      } catch {
        // Silent: deep link should not break the page
      }
    };

    void ensureCatalogThenOpen();
    return () => {
      cancelled = true;
    };
  }, [deepLinkPaperSlug, catalogPapers, isReviewMode, openNtaInstructionsForPaper]);

  // Intentionally disable cross-user review via query params (security).

  const handleQuickStartMock = useCallback((subject: Subject) => {
    setSelectedSubject(subject);
    setDuration(90);
    setLibraryTab("quick");
    setView("setup");
  }, []);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("rdm_config")
      .select("value")
      .eq("key", "mock_score_bonus_rdm")
      .maybeSingle()
      .then(
        ({ data }) => {
          if (cancelled) return;
          if (typeof data?.value === "number" && Number.isFinite(data.value)) {
            setMockScoreBonusRdm(Math.max(1, Math.trunc(data.value)));
          }
        },
        () => {}
      );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Allow deep-linking straight into the mock test library.
    if (initialViewParam === "setup") {
      setView("setup");
    }
    // Only run once on mount (searchParams is memoized).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const papersByClassLevel = useMemo(() => {
    const userLevel = user?.classLevel ?? 12;
    return catalogPapers.filter((p) => p.classLevel <= userLevel);
  }, [catalogPapers, user?.classLevel]);

  const featuredDashboardPaper = useMemo(() => {
    const bySlug = catalogPapers.find((p) => p.slug === FEATURED_DASHBOARD_PYQ_SLUG);
    if (bySlug) return bySlug;
    return catalogPapers.find(
      (p) =>
        p.type === "pyq" &&
        (/10\s*th?\s*January\s*2019/i.test(p.title) || /10\s+January\s*2019/i.test(p.title)) &&
        /shift\s*1/i.test(p.title)
    );
  }, [catalogPapers]);

  const filteredCatalogPapers = useMemo(() => {
    if (libraryTab === "quick") return [];
    return filterMockPapers(
      papersByClassLevel,
      libraryTab,
      librarySearch,
      librarySubjectFilter,
      subjects
    );
  }, [papersByClassLevel, libraryTab, librarySearch, librarySubjectFilter, subjects]);

  useEffect(() => {
    if (view !== "landing") return;
    if (catalogPapers.length > 0) {
      setFeaturedCatalogLoading(false);
      return;
    }
    let cancelled = false;
    setFeaturedCatalogLoading(true);
    void fetchMockPapersFromSupabase()
      .then((rows) => {
        if (!cancelled) setCatalogPapers(rows);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFeaturedCatalogLoading(false);
      });
    return () => {
      cancelled = true;
      setFeaturedCatalogLoading(false);
    };
  }, [view, catalogPapers.length]);

  useEffect(() => {
    if (view !== "setup" || libraryTab === "quick") return;
    let cancelled = false;
    setCatalogLoading(true);
    setCatalogError(null);
    void fetchMockPapersFromSupabase()
      .then((rows) => {
        if (!cancelled) {
          setCatalogPapers(rows);
          setCatalogLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setCatalogError(err instanceof Error ? err.message : "Failed to load mock papers");
          setCatalogLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [view, libraryTab]);

  const handleAnswerSelect = useCallback((questionId: string, idx: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: idx }));
  }, []);

  const candidateDisplayName = profile?.name ?? user?.name ?? "Candidate";
  const candidateAvatarUrl = profile?.avatar_url ?? null;

  const handleNtaSaveAndNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
  }, [questions.length]);

  const handleNtaClearResponse = useCallback(() => {
    const id = questions[currentIndex]?.id;
    if (!id) return;
    setAnswers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, [questions, currentIndex]);

  const handleNtaMarkReviewNext = useCallback(() => {
    const id = questions[currentIndex]?.id;
    if (!id) return;
    setFlagged((prev) => new Set(prev).add(id));
    setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
  }, [questions, currentIndex]);

  const handleNtaSaveMarkReviewNext = useCallback(() => {
    const id = questions[currentIndex]?.id;
    if (!id) return;
    setFlagged((prev) => new Set(prev).add(id));
    setCurrentIndex((i) => Math.min(questions.length - 1, i + 1));
  }, [questions, currentIndex]);

  const correctCount = useMemo(
    () => questions.filter((q) => answers[q.id] === q.correctAnswer).length,
    [questions, answers]
  );

  const sectionBreakdown = useMemo(() => {
    const bySubject: Record<string, { correct: number; total: number }> = {};
    questions.forEach((q) => {
      if (!bySubject[q.subject]) bySubject[q.subject] = { correct: 0, total: 0 };
      bySubject[q.subject].total++;
      if (answers[q.id] === q.correctAnswer) bySubject[q.subject].correct++;
    });
    return bySubject;
  }, [questions, answers]);

  const timeTakenSeconds =
    startTime != null && endTime != null ? Math.floor((endTime - startTime) / 1000) : 0;

  useEffect(() => {
    if (view !== "results") return;
    setMockShareTemplateIndex(0);
    setMockPostPreviewOpen(false);
    setMockPostingToFeed(false);
  }, [view, endTime]);

  useEffect(() => {
    let cancelled = false;
    void supabase
      .from("rdm_config")
      .select("value")
      .eq("key", "mock_community_share_rdm")
      .maybeSingle()
      .then(
        ({ data }) => {
          if (cancelled) return;
          if (typeof data?.value === "number" && Number.isFinite(data.value)) {
            setMockShareRewardRdm(Math.max(1, Math.trunc(data.value)));
          }
        },
        () => {}
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const mockShareOutcome = useMemo(
    () =>
      view === "results" && questions.length > 0
        ? getMockShareOutcome(correctCount, questions.length)
        : ("lose" as const),
    [view, questions.length, correctCount]
  );

  const mockShareTemplates = useMemo(() => {
    if (view !== "results" || questions.length === 0) return [];
    const total = questions.length;
    const accuracyPct = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const appUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/mock`
        : "https://edublast.in/mock";
    return buildMockShareTemplates({
      examName: activeExamTitle ?? "Quick mock",
      correct: correctCount,
      total,
      accuracyPct,
      timeTakenLabel: formatTime(timeTakenSeconds),
      appUrl,
      outcome: mockShareOutcome,
    });
  }, [view, questions, correctCount, timeTakenSeconds, activeExamTitle, mockShareOutcome]);

  const activeMockShareTemplate =
    mockShareTemplates.length > 0
      ? mockShareTemplates[mockShareTemplateIndex % mockShareTemplates.length]!
      : null;

  const handleMockPostToCommunity = useCallback(async () => {
    if (!authUser?.id) {
      toast({
        title: "Sign in required",
        description: "Log in to post your mock result to the community.",
        variant: "destructive",
      });
      return;
    }
    if (endTime == null) {
      toast({
        title: "Cannot post yet",
        description: "Finish the mock to enable community sharing and RDM tracking.",
        variant: "destructive",
      });
      return;
    }
    const tmpl =
      mockShareTemplates[mockShareTemplateIndex % Math.max(1, mockShareTemplates.length)];
    if (!tmpl) return;

    const attemptKey = `${String(endTime)}:${activePaperId ?? "quick"}`;

    setMockPostingToFeed(true);
    try {
      const { data, error } = await supabase
        .from("lessons_raw_posts")
        .insert({
          user_id: authUser.id,
          kind: "post",
          title: tmpl.title.length > 200 ? `${tmpl.title.slice(0, 197)}…` : tmpl.title,
          content: tmpl.text,
          tags: ["mock_test", "prep-mock"],
          subject: null,
          source_type: "mock_test",
          source_payload: {
            templateId: tmpl.id,
            paperId: activePaperId,
            correct: correctCount,
            total: questions.length,
            tone: tmpl.tone,
            outcome: mockShareOutcome,
            attemptKey,
          },
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (!data?.id) throw new Error("Post created but ID was not returned.");
      const postId = String(data.id);
      setMockPostPreviewOpen(false);

      const rewardLabel = `+${mockShareRewardRdm} RDM`;
      const communityRdmMessages: Record<string, string> = {
        already_claimed_session: `You already received ${rewardLabel} for sharing this mock run. Your new post is still live.`,
        missing_attempt_key: "This post could not be tied to a finished attempt for the bonus.",
        invalid_source: "This post did not qualify for the community share bonus. Contact support if that seems wrong.",
        wrong_owner: "Account mismatch while claiming RDM.",
        post_not_found: "Post was not found when claiming RDM.",
        unauthenticated: "Sign in to claim RDM.",
      };

      const { data: claimRaw, error: claimRpcError } = await supabase.rpc(
        "claim_mock_community_share_rdm",
        { p_post_id: postId }
      );

      let rdmLine = "";
      if (claimRpcError) {
        rdmLine =
          " Bonus RDM could not be verified right now—you can refresh or contact support if it should apply.";
      } else {
        const claim = claimRaw as Record<string, unknown> | null;
        if (claim?.ok === true) {
          const bal = claim.new_rdm_balance;
          const awarded =
            typeof claim.rdm_awarded === "number" && Number.isFinite(claim.rdm_awarded)
              ? Math.max(1, Math.trunc(claim.rdm_awarded))
              : mockShareRewardRdm;
          if (typeof bal === "number" && Number.isFinite(bal)) {
            setRdmFromProfile(bal);
          } else {
            void refreshProfile();
          }
          rdmLine = ` +${awarded} RDM added for sharing.`;
        } else {
          const reason =
            typeof claim?.denial_reason === "string" ? claim.denial_reason : "unknown";
          rdmLine = ` ${communityRdmMessages[reason] ?? `No bonus RDM (${reason}).`}`;
        }
      }

      toast({
        title: "Posted to community",
        description: `Your mock result is live on the feed.${rdmLine}`,
        action: (
          <ToastAction
            altText="View post"
            onClick={() => {
              window.location.href = `/home?focusPost=${encodeURIComponent(postId)}`;
            }}
          >
            View post
          </ToastAction>
        ),
      });
    } catch (err) {
      toast({
        title: "Community post failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setMockPostingToFeed(false);
    }
  }, [
    authUser?.id,
    endTime,
    mockShareTemplates,
    mockShareTemplateIndex,
    mockShareOutcome,
    activePaperId,
    correctCount,
    questions.length,
    mockShareRewardRdm,
    supabase,
    toast,
    setRdmFromProfile,
    refreshProfile,
  ]);

  const handleMockShareWhatsApp = useCallback(() => {
    const tmpl =
      mockShareTemplates[mockShareTemplateIndex % Math.max(1, mockShareTemplates.length)];
    if (!tmpl) return;
    if (typeof window === "undefined") return;
    const url = buildWhatsAppShareUrl(tmpl.whatsappText);
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      toast({
        title: "Popup blocked",
        description: "Allow popups to open WhatsApp, or copy the message manually.",
      });
    }
  }, [mockShareTemplates, mockShareTemplateIndex, toast]);

  const reviewQuestions = useMemo(() => {
    if (reviewSubjectFilter === "all") return questions;
    return questions.filter((q) => q.subject === reviewSubjectFilter);
  }, [questions, reviewSubjectFilter]);

  /** Catalog mock: optional +50 RDM when server confirms score >= 60% (IST day + per-paper rules). */
  useEffect(() => {
    if (view !== "results") return;
    if (!activePaperId || questions.length === 0 || endTime == null) return;
    if (!authUser?.id) return;
    if (100 * correctCount < 60 * questions.length) return;
    if (mockRdmBonusClaimEndTimeRef.current === endTime) return;
    mockRdmBonusClaimEndTimeRef.current = endTime;

    const orderedAnswers = questions.map((q) =>
      typeof answers[q.id] === "number" ? answers[q.id]! : -1
    );

    const headers: HeadersInit = { "Content-Type": "application/json" };
    const token = session?.access_token;
    if (token) headers.Authorization = `Bearer ${token}`;

    void fetch("/api/mock/claim-rdm-bonus", {
      method: "POST",
      credentials: "include",
      headers,
      body: JSON.stringify({ paperId: activePaperId, answers: orderedAnswers }),
    })
      .then(async (res) => {
        const data = (await res.json()) as Record<string, unknown>;
        if (!res.ok) {
          toast({
            title: "Mock bonus (RDM)",
            description: typeof data.error === "string" ? data.error : "Request failed",
            variant: "destructive",
          });
          return;
        }
        if (data.ok === true) {
          const bal = data.new_rdm_balance;
          const awarded =
            typeof data.rdm_awarded === "number" && Number.isFinite(data.rdm_awarded)
              ? Math.max(1, Math.trunc(data.rdm_awarded))
              : mockScoreBonusRdm;
          if (typeof bal === "number" && Number.isFinite(bal)) {
            setRdmFromProfile(bal);
          } else {
            void refreshProfile();
          }
          toast({
            title: `+${awarded} RDM`,
            description: `Score ${String(data.score_percent ?? "")}% on this paper — bonus applied. One +${awarded} mock bonus per IST day; one per paper lifetime.`,
          });
          return;
        }
        const reason = typeof data.denial_reason === "string" ? data.denial_reason : "unknown";
        const messages: Record<string, string> = {
          below_60: "Need at least 60% (correct ÷ total questions) for this bonus.",
          already_claimed_paper: `You already received the +${mockScoreBonusRdm} RDM bonus for this catalog paper.`,
          already_claimed_today:
            `You already claimed a catalog mock +${mockScoreBonusRdm} RDM bonus today (India time). Try another paper tomorrow.`,
          paper_not_found: "This paper is not eligible for the bonus.",
          invalid_payload: "Could not verify answers with the server.",
          no_questions: "This paper has no questions in the database.",
          unauthenticated: "Sign in to claim RDM bonuses.",
        };
        toast({ title: "Mock bonus (RDM)", description: messages[reason] ?? `No bonus: ${reason}` });
      })
      .catch(() => {
        toast({
          title: "Mock bonus (RDM)",
          description: "Network error. Refresh this page if your bonus should apply.",
          variant: "destructive",
        });
      });
  }, [
    view,
    activePaperId,
    questions,
    answers,
    correctCount,
    endTime,
    authUser?.id,
    session?.access_token,
    toast,
    setRdmFromProfile,
    refreshProfile,
    mockScoreBonusRdm,
  ]);

  // Dashboard derived data
  const overallAccuracy = useMemo(() => {
    if (allResults.length === 0) return 0;
    const correct = allResults.filter((r) => r.isCorrect).length;
    return Math.round((correct / allResults.length) * 100);
  }, [allResults]);

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
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  const revisionCards = user?.savedRevisionCards ?? [];

  const immersiveNta = view === "nta_instructions" || (view === "test" && questions.length > 0);
  const ntaExamNameLine = activeExamTitle ? "JEE-Main" : "Testbee Quick";
  const ntaSubjectPaperLine = activeExamTitle ?? "Quick mock — timed practice";

  return (
    <ProtectedRoute allowRoles={["student"]}>
      <AppLayout hideTopNav={immersiveNta} wideMain={immersiveNta}>
        <AnimatePresence mode="wait">
          {/* ── DASHBOARD (landing) ── */}
          {view === "landing" && (
            <motion.div
              key="landing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex gap-6"
            >
              {/* Sidebar — desktop */}
              <PrepMockSidebar />

              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-8">
                {/* Mobile sidebar strip */}
                <div className="lg:hidden">
                  <PrepMockSidebar />
                </div>

                {/* Page header */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 gradient-primary rounded-xl flex items-center justify-center shrink-0">
                    <ClipboardList className="w-5 h-5 text-primary-foreground" />
                  </div>
                  <div>
                    <h1 className="text-xl font-display font-extrabold text-foreground">
                      Prep + Mock
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      Classes, AI-powered scheduling, mock tests, and smart revision
                    </p>
                  </div>
                </div>

                {/* Stat cards */}
                <PrepMockStatCards
                  nextClassName={nextClassInfo?.name ?? ""}
                  nextClassTime={nextClassInfo?.time ?? ""}
                  mockPending={subjects.length}
                  revisionItems={revisionCards.length}
                  accuracy={overallAccuracy}
                />

                {/* 2-column grid: left = Classes + Calendar, right = Mock Tests + Revision */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left column */}
                  <div className="space-y-6">
                    <ClassesSection
                      userId={authUser?.id ?? ""}
                      onNextClass={setNextClassInfo}
                      accessToken={session?.access_token}
                      onClassCalendar={() => setCalendarRefreshKey((k) => k + 1)}
                    />
                    <div id="calendar" className="scroll-mt-24">
                      <StreakCalendar
                        userId={authUser?.id ?? null}
                        accessToken={session?.access_token}
                        refreshKey={calendarRefreshKey}
                      />
                    </div>
                  </div>

                  {/* Right column */}
                  <div className="space-y-6">
                    <MockTestsSection
                      subjects={subjects}
                      onStartMock={handleQuickStartMock}
                      onViewAll={() => {
                        setLibraryTab("all");
                        setView("setup");
                      }}
                      featuredPaper={featuredDashboardPaper ?? null}
                      featuredLoading={featuredCatalogLoading}
                      onStartFeaturedPaper={() => {
                        const p = featuredDashboardPaper;
                        if (p) openNtaInstructionsForPaper(p, "landing");
                      }}
                    />
                    <RevisionInstaCueSection
                      cards={revisionCards}
                      accessToken={session?.access_token}
                      userId={authUser?.id ?? null}
                      onCalendarActivity={() => setCalendarRefreshKey((k) => k + 1)}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── SETUP VIEW (mock test library + quick mock) ── */}
          {view === "setup" && (
            <motion.div
              key="setup"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mx-auto max-w-6xl space-y-6"
            >
              <button
                type="button"
                onClick={() => setView("landing")}
                className="flex items-center gap-2 text-sm font-bold text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" /> Back to dashboard
              </button>

              <div className="rounded-2xl border border-border bg-card/80 px-4 py-6 shadow-sm sm:px-8">
                <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
                  <div className="flex gap-4">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
                      <GraduationCap className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        Institute-style mock portal
                      </p>
                      <h1 className="edu-page-title mt-1 text-2xl md:text-3xl">
                        Mock test library
                      </h1>
                      <p className="edu-page-desc mt-1 max-w-2xl text-sm md:text-base">
                        Browse published papers from the institute bank (Supabase) or start a timed
                        quick mock from the adaptive pool.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <ShieldCheck className="h-4 w-4 shrink-0 text-primary" />
                    <span>Timer · flagged review · submit when ready</span>
                  </div>
                </div>

                <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
                  {(
                    [
                      { id: "all" as const, label: "All papers" },
                      { id: "pyq" as const, label: "Previous Year (PYQ)" },
                      { id: "ncert" as const, label: "NCERT Exemplar" },
                      { id: "chapter" as const, label: "Chapter-wise" },
                      { id: "full" as const, label: "Full syllabus" },
                      { id: "quick" as const, label: "Quick mock" },
                    ] satisfies { id: SetupLibraryTab; label: string }[]
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLibraryTab(tab.id)}
                      className={cn(
                        "shrink-0 rounded-full border px-4 py-2 text-xs font-bold transition-all sm:text-sm",
                        libraryTab === tab.id
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {libraryTab === "quick" ? (
                  <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_280px]">
                    <div className="edu-card space-y-6 rounded-2xl p-6">
                      <h2 className="font-display flex items-center gap-2 text-lg font-bold text-foreground">
                        <Clock className="h-5 w-5 text-primary" />
                        Quick mock (adaptive pool)
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Same engine as before: mixed questions from your syllabus level, timed like
                        exam day.
                      </p>
                      <div>
                        <h3 className="mb-3 text-sm font-bold text-foreground">Duration</h3>
                        <div className="flex flex-wrap gap-3">
                          {QUICK_DURATIONS.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setDuration(d)}
                              className={cn(
                                "min-w-25 flex-1 rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all",
                                duration === d
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                              )}
                            >
                              {d} min
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          ~{Math.ceil(duration / 2.5)} questions · ~2–3 min per question
                        </p>
                      </div>
                      <div>
                        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-foreground">
                          <BookOpen className="h-4 w-4 text-primary" />
                          Subject focus
                        </h3>
                        <div className="flex flex-wrap gap-3">
                          {subjects.map((subj) => (
                            <button
                              key={subj}
                              type="button"
                              onClick={() => setSelectedSubject(subj)}
                              className={cn(
                                "flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-bold transition-all",
                                effectiveSubject === subj
                                  ? "border-primary bg-primary/10 text-primary"
                                  : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50"
                              )}
                            >
                              <span>{subjectEmojis[subj]}</span>
                              <span className="capitalize">{subj}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="text-center sm:text-left">
                        <Button
                          size="lg"
                          className="edu-btn-primary rounded-xl px-10 py-6 text-lg font-bold"
                          onClick={startQuickTest}
                        >
                          <ClipboardList className="mr-2 h-5 w-5" />
                          Start mock test
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div className="edu-card rounded-2xl border border-primary/20 bg-primary/5 p-5">
                        <Target className="mb-2 h-8 w-8 text-primary" />
                        <h4 className="mb-1 font-bold text-foreground">Stamina</h4>
                        <p className="text-sm text-muted-foreground">
                          Long sits train focus for boards and entrances.
                        </p>
                      </div>
                      <div className="edu-card rounded-2xl border border-border p-5">
                        <Lightbulb className="mb-2 h-8 w-8 text-primary" />
                        <h4 className="mb-1 font-bold text-foreground">Strategy</h4>
                        <p className="text-sm text-muted-foreground">
                          Flag hard items; review after submit.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-8 space-y-6">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="relative max-w-md flex-1">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={librarySearch}
                          onChange={(e) => setLibrarySearch(e.target.value)}
                          placeholder="Search by paper name or tag…"
                          className="h-11 rounded-xl border-border pl-10"
                          aria-label="Search mock papers"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Subject
                        </span>
                        {(["all", ...subjects] as const).map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setLibrarySubjectFilter(s)}
                            className={cn(
                              "rounded-lg border px-3 py-1.5 text-xs font-bold transition-all",
                              librarySubjectFilter === s
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-muted/30 text-muted-foreground hover:border-primary/40"
                            )}
                          >
                            {s === "all" ? "All" : subjectEmojis[s]}
                            {s !== "all" ? <span className="ml-1 capitalize">{s}</span> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Showing{" "}
                      <span className="font-semibold text-foreground">
                        {filteredCatalogPapers.length}
                      </span>{" "}
                      paper{filteredCatalogPapers.length === 1 ? "" : "s"} in this view
                      {catalogLoading ? " · loading…" : ""}.
                    </p>

                    {catalogError ? (
                      <div className="edu-card rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center text-sm text-destructive">
                        {catalogError}
                      </div>
                    ) : catalogLoading ? (
                      <div className="edu-card rounded-2xl border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                        Loading mock papers…
                      </div>
                    ) : filteredCatalogPapers.length === 0 ? (
                      <div className="edu-card rounded-2xl border border-dashed border-border p-12 text-center">
                        <ListOrdered className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
                        <p className="font-semibold text-foreground">
                          {papersByClassLevel.length === 0
                            ? "No papers published for your class yet"
                            : "No papers match your filters"}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {papersByClassLevel.length === 0
                            ? "Ask your admin to publish mock papers or run the seed import."
                            : "Try another subject or clear the search."}
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {filteredCatalogPapers.map((paper) => (
                          <div
                            key={paper.id}
                            className="edu-card flex flex-col rounded-2xl border border-border p-5 transition-shadow hover:shadow-md"
                          >
                            <div className="mb-3 flex flex-wrap items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="text-[10px] font-semibold uppercase tracking-wide"
                              >
                                {mockPaperTypeLabel(paper.type)}
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                {paper.difficulty}
                              </Badge>
                              <span className="text-[10px] font-medium text-muted-foreground">
                                Class {paper.classLevel}
                              </span>
                            </div>
                            <h3 className="line-clamp-2 min-h-11 text-base font-bold leading-snug text-foreground">
                              {paper.title}
                            </h3>
                            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px]">
                              <div className="rounded-lg bg-muted/50 px-2 py-2">
                                <FileQuestion className="mx-auto mb-1 h-4 w-4 text-primary" />
                                <span className="font-bold tabular-nums text-foreground">
                                  {paper.questionsCount}
                                </span>
                                <span className="block text-muted-foreground">Qs</span>
                              </div>
                              <div className="rounded-lg bg-muted/50 px-2 py-2">
                                <Clock className="mx-auto mb-1 h-4 w-4 text-primary" />
                                <span className="font-bold tabular-nums text-foreground">
                                  {paper.durationMinutes}
                                </span>
                                <span className="block text-muted-foreground">Min</span>
                              </div>
                              <div className="rounded-lg bg-muted/50 px-2 py-2">
                                <Award className="mx-auto mb-1 h-4 w-4 text-primary" />
                                <span className="font-bold tabular-nums text-foreground">
                                  {paper.totalMarks}
                                </span>
                                <span className="block text-muted-foreground">Marks</span>
                              </div>
                            </div>
                            <p className="mt-3 line-clamp-1 text-xs text-muted-foreground">
                              {paper.tags.length > 0 ? `${paper.tags.join(" · ")} · ` : null}
                              <span className="capitalize text-foreground/80">
                                {(paper.subjectsCovered ?? [paper.subject]).join(", ")}
                              </span>
                            </p>
                            <div className="mt-4 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="flex-1 rounded-xl"
                                onClick={() => openNtaInstructionsForPaper(paper)}
                              >
                                Instructions
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                className="edu-btn-primary flex-1 rounded-xl font-bold"
                                onClick={() => openNtaInstructionsForPaper(paper)}
                              >
                                Start exam
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* ── NTA GENERAL INSTRUCTIONS (fullscreen) ── */}
          {view === "nta_instructions" && ntaPendingMeta ? (
            <div
              key="nta-instructions"
              className="fixed inset-0 z-100 flex flex-col"
              style={{ top: 0 }}
            >
              <NtaMockTokens skin={ntaSkin} className="flex min-h-0 flex-1 flex-col">
                <NtaGeneralInstructions
                  meta={{
                    durationMinutes: ntaPendingMeta.durationMin,
                    questionCount: ntaPendingMeta.questionCount,
                    markingScheme: ntaPendingMeta.markingScheme,
                    paperTitle: ntaPendingMeta.titleLine,
                  }}
                  proceedBusy={ntaProceedBusy}
                  onBack={() => {
                    setNtaPendingMeta(null);
                    setView(ntaInstructionBackView);
                  }}
                  onProceed={handleNtaProceed}
                />
                <NtaProceedWarningDialog
                  open={ntaWarningOpen}
                  onOk={() => setNtaWarningOpen(false)}
                />
              </NtaMockTokens>
            </div>
          ) : null}

          {/* ── NTA EXAM SHELL (fullscreen) ── */}
          {view === "test" && questions.length > 0 ? (
            <div key="nta-test" className="fixed inset-0 z-100 flex flex-col">
              <NtaMockTokens skin={ntaSkin} className="flex min-h-0 flex-1 flex-col">
                <NtaExamShell
                  candidateName={candidateDisplayName}
                  avatarUrl={candidateAvatarUrl}
                  examNameLine={ntaExamNameLine}
                  subjectPaperLine={ntaSubjectPaperLine}
                  secondsLeft={secondsLeft}
                  questions={questions}
                  currentIndex={currentIndex}
                  onSelectIndex={setCurrentIndex}
                  answers={answers}
                  flagged={flagged}
                  visitedIds={visitedQuestionIds}
                  onAnswerSelect={handleAnswerSelect}
                  onSaveAndNext={handleNtaSaveAndNext}
                  onClearResponse={handleNtaClearResponse}
                  onSaveMarkReviewNext={handleNtaSaveMarkReviewNext}
                  onMarkReviewNext={handleNtaMarkReviewNext}
                  onBackNav={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  onNextNav={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
                  onSubmitClick={() => setSubmitDialogOpen(true)}
                />
                <NtaSubmitModal
                  open={submitDialogOpen}
                  onCancel={() => setSubmitDialogOpen(false)}
                  onConfirm={handleFinishTest}
                />
              </NtaMockTokens>
            </div>
          ) : null}

          {/* ── RESULTS VIEW ── */}
          {view === "results" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="max-w-4xl mx-auto space-y-8"
            >
              <div className="edu-page-header text-center">
                <div className="text-6xl mb-4">
                  {correctCount >= questions.length * 0.8
                    ? "🏆"
                    : correctCount >= questions.length * 0.5
                      ? "👍"
                      : "💪"}
                </div>
                <h1 className="edu-page-title text-3xl">Mock test complete</h1>
                {activeExamTitle ? (
                  <p className="edu-page-desc mt-1 line-clamp-2 text-sm font-medium text-primary">
                    {activeExamTitle}
                  </p>
                ) : null}
                <p className="edu-page-desc">
                  {correctCount} / {questions.length} correct
                  {timeTakenSeconds > 0 && ` · ${formatTime(timeTakenSeconds)} taken`}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="edu-card p-4 rounded-2xl text-center">
                  <span className="text-2xl font-extrabold text-edu-green block">
                    {correctCount}
                  </span>
                  <span className="text-xs text-muted-foreground font-bold">Correct</span>
                </div>
                <div className="edu-card p-4 rounded-2xl text-center">
                  <span className="text-2xl font-extrabold text-destructive block">
                    {questions.length - correctCount}
                  </span>
                  <span className="text-xs text-muted-foreground font-bold">Wrong</span>
                </div>
                <div className="edu-card p-4 rounded-2xl text-center">
                  <span className="text-2xl font-extrabold text-primary block">
                    {questions.length ? Math.round((correctCount / questions.length) * 100) : 0}%
                  </span>
                  <span className="text-xs text-muted-foreground font-bold">Score</span>
                </div>
                <div className="edu-card p-4 rounded-2xl text-center">
                  <span className="text-2xl font-extrabold text-foreground block font-mono">
                    {formatTime(timeTakenSeconds)}
                  </span>
                  <span className="text-xs text-muted-foreground font-bold">Time</span>
                </div>
              </div>

              {activeMockShareTemplate && mockShareTemplates.length > 0 ? (
                <div className="edu-card rounded-2xl border border-border bg-muted/20 p-4 shadow-inner sm:p-5 dark:border-white/10 dark:bg-black/35">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:text-slate-400">
                        Share this result
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground dark:text-slate-500">
                        {mockShareOutcome === "win" ? "Win" : "Loss"} set · Community caption{" "}
                        {mockShareTemplateIndex + 1}/20 · {activeMockShareTemplate.tone}
                        <span className="text-foreground/70 dark:text-slate-400">
                          {" "}
                          · WhatsApp uses a different message for this slot.
                        </span>
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 shrink-0 text-[11px] dark:border-white/20 dark:bg-transparent dark:text-slate-100 dark:hover:bg-white/10"
                      disabled={mockPostingToFeed}
                      onClick={() => {
                        if (mockShareTemplates.length <= 1) return;
                        setMockShareTemplateIndex((prev) =>
                          pickNextMockShareTemplate(prev, mockShareTemplates.length)
                        );
                      }}
                    >
                      <Shuffle className="mr-1 h-3.5 w-3.5" />
                      Shuffle template
                    </Button>
                  </div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-foreground dark:text-slate-300">
                    {activeMockShareTemplate.text}
                  </p>
                  {!authUser?.id ? (
                    <p className="mt-3 text-[11px] text-muted-foreground dark:text-slate-500">
                      Sign in to post to the community. WhatsApp still works from this device.
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 border-amber-500/40 bg-amber-500/10 font-semibold text-amber-950 hover:bg-amber-500/20 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100 dark:hover:bg-amber-500/20"
                      disabled={mockPostingToFeed || !authUser?.id}
                      onClick={() => setMockPostPreviewOpen(true)}
                    >
                      <Users className="mr-1.5 h-4 w-4" />
                      Post to Community
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-9 dark:border-white/20 dark:bg-transparent dark:text-white dark:hover:bg-white/10"
                      onClick={() => handleMockShareWhatsApp()}
                    >
                      <MessageCircle className="mr-1.5 h-4 w-4" />
                      WhatsApp
                    </Button>
                  </div>
                  <p className="mt-2 text-sm font-semibold text-foreground dark:text-slate-200">
                    <strong>Share bonus today:</strong> up to <strong>{`+${mockShareRewardRdm} RDM`}</strong> on a
                    verified <strong>Post to Community</strong> share. <strong>WhatsApp</strong> is for
                    external sharing only.
                  </p>
                  <Dialog open={mockPostPreviewOpen} onOpenChange={setMockPostPreviewOpen}>
                    <DialogContent className="max-w-xl border-border bg-background dark:border-white/15 dark:bg-[#0d0f1d] dark:text-white">
                      <DialogHeader>
                        <DialogTitle>Preview community post</DialogTitle>
                        <DialogDescription className="text-muted-foreground dark:text-slate-400">
                          This template posts only after you click{" "}
                          <strong className="text-foreground dark:text-slate-200">Post now</strong>.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="rounded-xl border border-border bg-muted/30 p-3 dark:border-white/10 dark:bg-black/30">
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground dark:text-slate-400">
                          {activeMockShareTemplate.title}
                        </p>
                        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground dark:text-slate-200">
                          {activeMockShareTemplate.text}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setMockPostPreviewOpen(false)}
                          className="dark:border-white/20 dark:bg-transparent dark:text-white"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          className="bg-amber-500 font-semibold text-amber-950 hover:bg-amber-400"
                          disabled={mockPostingToFeed}
                          onClick={() => void handleMockPostToCommunity()}
                        >
                          {mockPostingToFeed ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                          ) : null}
                          Post now
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ) : null}

              {Object.keys(sectionBreakdown).length > 0 && (
                <div className="edu-card p-6 rounded-2xl">
                  <h3 className="font-display font-bold text-foreground mb-4">By subject</h3>
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => setReviewSubjectFilter("all")}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors",
                        reviewSubjectFilter === "all"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/40 text-foreground hover:bg-muted/60"
                      )}
                    >
                      <span>📚</span>
                      <span className="font-bold">All</span>
                      <span className="text-sm text-muted-foreground">{questions.length}</span>
                    </button>
                    {Object.entries(sectionBreakdown).map(([subj, { correct, total }]) => (
                      <button
                        key={subj}
                        type="button"
                        onClick={() => setReviewSubjectFilter(subj as Subject)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors",
                          reviewSubjectFilter === (subj as Subject)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-muted/40 text-foreground hover:bg-muted/60"
                        )}
                      >
                        <span>{subjectEmojis[subj as Subject]}</span>
                        <span className="font-bold capitalize">{subj}</span>
                        <span className="text-sm text-muted-foreground">
                          {correct}/{total}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="edu-card p-6 rounded-2xl">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <h3 className="font-display font-bold text-foreground">Review answers</h3>
                  <span className="text-xs text-muted-foreground">
                    Showing {reviewQuestions.length} of {questions.length}
                  </span>
                </div>
                <div className="space-y-3">
                  {reviewQuestions.map((q) => {
                    const selected = answers[q.id];
                    const correct = selected === q.correctAnswer;
                    const open = expandedReviewId === q.id;
                    return (
                      <div key={q.id} className="border border-border rounded-xl overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedReviewId(open ? null : q.id)}
                          className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                        >
                          <span className="shrink-0">
                            {correct ? (
                              <CheckCircle2 className="w-5 h-5 text-edu-green" />
                            ) : (
                              <XCircle className="w-5 h-5 text-destructive" />
                            )}
                          </span>
                          <span className="text-sm font-bold text-foreground line-clamp-2 flex-1">
                            <ReviewInlineHtml text={q.question} />
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {q.subject}
                            {q.topic && q.topic !== "NULL" ? ` · ${q.topic}` : ""}
                          </span>
                          {open ? (
                            <ChevronUp className="w-4 h-4 shrink-0" />
                          ) : (
                            <ChevronDown className="w-4 h-4 shrink-0" />
                          )}
                        </button>
                        {open && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            className="px-4 pb-4 space-y-2 text-sm"
                          >
                            <p className="text-muted-foreground">
                              Your answer:{" "}
                              {selected != null ? (
                                <ReviewInlineHtml text={q.options[selected] ?? ""} />
                              ) : (
                                "—"
                              )}
                            </p>
                            {!correct && (
                              <p className="text-edu-green font-medium">
                                Correct:{" "}
                                <ReviewInlineHtml text={q.options[q.correctAnswer] ?? ""} />
                              </p>
                            )}
                            <div className="text-foreground/90 [&_.katex]:text-[0.97em]">
                              <ReviewInlineHtml text={q.solutionHtml || q.solution || ""} block />
                            </div>
                          </motion.div>
                        )}
                      </div>
                    );
                  })}
                  {reviewQuestions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                      No questions found for this subject filter.
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="text-center">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-xl font-bold"
                  onClick={() => {
                    setView("landing");
                    setQuestions([]);
                    setAnswers({});
                    setActiveExamTitle(null);
                    setActivePaperId(null);
                    mockRdmBonusClaimEndTimeRef.current = null;
                    setVisitedQuestionIds(new Set());
                  }}
                >
                  <RotateCcw className="w-5 h-5 mr-2" />
                  Try another mock
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </AppLayout>
    </ProtectedRoute>
  );
}
