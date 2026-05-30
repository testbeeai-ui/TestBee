"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ClipboardList,
  ExternalLink,
  Flame,
  Loader2,
  Plus,
  Settings,
  Star,
  Users,
  UserPlus,
  WandSparkles,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import InviteStudents from "@/components/InviteStudents";
import { useToast } from "@/hooks/use-toast";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import { supabase } from "@/integrations/supabase/client";
import { safeGetSession } from "@/lib/auth/safeSession";
import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import GeneratedMcqReview from "@/components/classroom/GeneratedMcqReview";
import { getAdvancedSetBounds } from "@/lib/play/quiz/advancedQuizSets";
import { fetchSubtopicContent } from "@/lib/curriculum/subtopicContentService";
import MeetSessionsStack from "@/components/teacher-portal/live/MeetSessionsStack";
import { redirectToGoogleCalendarConsent } from "@/lib/integrations/googleCalendarOAuthClient";
import {
  buildDefaultTasksForAssignmentType,
  normalizeTaskPositions,
  type AssignmentTaskStored,
} from "@/lib/classroom/assignmentTasks";
import ChapterQuizAssignmentFields from "@/components/teacher-portal/assignment/fields/ChapterQuizAssignmentFields";
import ConceptFocusAssignmentFields, {
  type ConceptFocusSelectionState,
  initialConceptFocusSelection,
  conceptFocusSelectionComplete,
} from "@/components/teacher-portal/assignment/fields/ConceptFocusAssignmentFields";
import ConceptFocusSubtopicPreview from "@/components/teacher-portal/assignment/fields/ConceptFocusSubtopicPreview";
import DailyDoseStreakAssignmentFields from "@/components/teacher-portal/assignment/fields/DailyDoseStreakAssignmentFields";
import GyanEngagementAssignmentFields from "@/components/teacher-portal/assignment/fields/GyanEngagementAssignmentFields";
import CreateAssignmentWizard from "@/components/teacher-portal/assignment/CreateAssignmentWizard";
import ScheduleLiveSessionPanel from "@/components/teacher-portal/live/ScheduleLiveSessionPanel";
import type { ScheduleLiveSessionPayload } from "@/components/teacher-portal/live/ScheduleLiveSessionPanel";
import CreateTestsView from "@/components/teacher-portal/views/tests/CreateTestsView";
import {
  fetchMockPapersFromSupabase,
  fetchMockQuestionsForPaper,
} from "@/lib/mock/mockPapersFromSupabase";
import { fetchPastPapersFromSupabase } from "@/lib/mock/pastPapersFromSupabase";
import {
  chapterQuizSelectionComplete,
  chapterQuizToRef,
  initialChapterQuizSelection,
  topicOptionLabel,
  topicsForChapter,
  type ChapterQuizSelectionState,
} from "@/lib/teacherPortal/chapterQuizUtils";
import type { MotivationNudgeGoal, MotivationRecommendActionId } from "@/lib/teacherPortal/queries";
import {
  DAILYDOSE_STREAK_TRACK_IDS,
  trackLabelById,
  type DailyDoseStreakTrackId,
} from "@/lib/teacherPortal/dailyDoseStreakTracks";
import WallTimeSelects from "@/components/teacher-portal/live/WallTimeSelects";
import type {
  TeacherPortalAssignmentItem,
  TeacherPortalClassroomCard,
  TeacherPortalClassroomDetail,
  TeacherPortalClassroomSection,
  TeacherPortalClassroomStudent,
  TeacherPortalChapterQuizRef,
  TeacherPortalDailyDoseStreakRef,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMockNudgeLowScorer,
  TeacherPortalMockNudgeSubmittedAttempt,
  TeacherPortalMockPaperRef,
  TeacherPortalSummary,
} from "@/lib/teacherPortal/types";
import type { MockPaper, PastPaper } from "@/types";
import { assignmentPostDueStillActive } from "@/lib/teacherPortal/assignmentDueActive";
import { assignmentItemIsNudgeMcqTarget } from "@/lib/teacherPortal/nudgeMcqPosts";

export function restoreLatexEscapes(input: string): string {
  // If LaTeX was stored in JSON with single backslashes, sequences like "\text" become "\t" (TAB) + "ext".
  // This restores the common ones we see in quiz questions.
  return input
    .replace(/\t(?=ext\{)/g, "\\\\t") // \text{...}
    .replace(/\u000c(?=rac\{)/g, "\\\\f") // \frac{...}{...}
    .replace(/\r(?=ightarrow|Rightarrow)/g, "\\\\r") // \rightarrow / \Rightarrow
    .replace(/\u0008(?=eta\b)/g, "\\\\b") // \beta
    .replace(/\u000b(?=ec\b)/g, "\\\\v"); // \vec
}

export function TaskPreviewBody(props: {
  href: string;
  mode:
    | "assignment-test"
    | "mock-paper"
    | "chapter-quiz-preview"
    | "concept-focus-preview"
    | "iframe";
  title: string;
  chapterQuizRef?: {
    board: string;
    subject: string;
    classLevel: number;
    topic: string;
    subtopicName: string;
    level: string;
    advancedSet?: 1 | 2 | 3;
  };
}) {
  const [loading, setLoading] = useState(props.mode !== "iframe");
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<{
    testTitle: string;
    questions: Array<{
      id: string;
      question: string;
      questionHtml?: string;
      options: string[];
      correctAnswerIndex?: number | null;
    }>;
  } | null>(null);

  const conceptPreviewProps = useMemo(() => {
    if (props.mode !== "concept-focus-preview") return null;
    const ref = props.chapterQuizRef ?? null;
    const subject = (ref?.subject ?? "").trim().toLowerCase();
    const topic = (ref?.topic ?? "").trim();
    const subtopicName = (ref?.subtopicName ?? "").trim();
    const classLevelRaw = Number(ref?.classLevel);
    const boardUpper =
      (ref?.board ?? "cbse").trim().toLowerCase() === "icse"
        ? ("ICSE" as const)
        : ("CBSE" as const);
    if (!subject || !topic || !subtopicName) return null;
    return {
      board: boardUpper,
      subject:
        subject === "physics" || subject === "chemistry" || subject === "math"
          ? (subject as "physics" | "chemistry" | "math")
          : ("physics" as const),
      classLevel: (classLevelRaw === 11 ? 11 : 12) as 11 | 12,
      topic,
      subtopicName,
    };
  }, [props.mode, props.chapterQuizRef]);

  useEffect(() => {
    if (props.mode === "iframe" || props.mode === "concept-focus-preview") return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      setPayload(null);
      try {
        const href = props.href;
        const url =
          href.startsWith("http://") || href.startsWith("https://")
            ? new URL(href)
            : new URL(href, "https://edublast.local");

        if (props.mode === "assignment-test") {
          const m = url.pathname.match(/\/classroom\/([^/]+)\/assignment-test\/([^/?#]+)/i);
          const classroomId = (m?.[1] ?? url.searchParams.get("classroomId") ?? "").trim();
          const postId = (m?.[2] ?? url.searchParams.get("postId") ?? "").trim();
          if (!classroomId || !postId)
            throw new Error("Unsupported task link (missing classroomId/postId).");
          const { session } = await safeGetSession();
          const headers: HeadersInit = {};
          if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
          const res = await fetch(
            `/api/classroom/${classroomId}/posts/${postId}/generated-test-attempt`,
            {
              headers,
              credentials: "include",
            }
          );
          const data = (await res.json().catch(() => ({}))) as {
            error?: string;
            testTitle?: string;
            questions?: Array<{
              id: string;
              question: string;
              options: string[];
              correctAnswerIndex?: number | null;
            }>;
          };
          if (!res.ok) throw new Error(data.error || `Failed to load (${res.status})`);
          const questions = Array.isArray(data.questions) ? data.questions : [];
          if (!cancelled) setPayload({ testTitle: data.testTitle ?? props.title, questions });
        } else if (props.mode === "chapter-quiz-preview") {
          // Questions-only preview (no attempts). Use the same subtopic-content fetch + set slicing
          // logic as `ChapterQuizAssignmentFields` (the quiz preview modal).
          const ref = props.chapterQuizRef ?? null;
          const subject = (ref?.subject ?? "").trim().toLowerCase();
          const classLevelRaw = Number(ref?.classLevel);
          const topic = (ref?.topic ?? "").trim();
          const subtopicName = (ref?.subtopicName ?? "").trim();
          const quizSet = Number(ref?.advancedSet ?? 1) || 1;
          const boardUpper =
            (ref?.board ?? "cbse").trim().toLowerCase() === "icse"
              ? ("ICSE" as const)
              : ("CBSE" as const);

          if (!subject || Number.isNaN(classLevelRaw) || !topic || !subtopicName) {
            throw new Error("Preview unavailable (missing chapter quiz metadata).");
          }

          const row = await fetchSubtopicContent({
            board: boardUpper,
            subject:
              subject === "physics" || subject === "chemistry" || subject === "math"
                ? (subject as "physics" | "chemistry" | "math")
                : "physics",
            classLevel: classLevelRaw === 11 ? 11 : 12,
            topic,
            subtopicName,
            level: "advanced",
          });

          const all = Array.isArray(row.bitsQuestions) ? row.bitsQuestions : [];
          let slice = all;
          if (all.length > 10) {
            const bounds = getAdvancedSetBounds(
              all.length,
              Math.max(1, Math.min(3, quizSet)) as 1 | 2 | 3
            );
            slice = all.slice(bounds.start, bounds.end);
          }

          const questions = slice.map((q, idx) => ({
            id: `bits-${idx + 1}`,
            question: restoreLatexEscapes(
              typeof q.question === "string" ? q.question : String(q.question ?? "")
            ),
            options: Array.isArray(q.options)
              ? q.options
                  .map((o) => restoreLatexEscapes(typeof o === "string" ? o : String(o ?? "")))
                  .filter((o) => o.trim().length > 0)
              : [],
            correctAnswerIndex: null,
          }));

          if (!cancelled) setPayload({ testTitle: props.title, questions });
        } else if (props.mode === "mock-paper") {
          const slug = url.searchParams.get("paper")?.trim() ?? "";
          if (!slug) throw new Error("Mock paper not specified.");
          // Use untyped client access here because the generated Supabase types in this repo
          // don't include `mock_papers`/`mock_questions` in the strict union.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const mockClient = supabase as any;
          const { data: paperRow, error: paperErr } = await mockClient
            .from("mock_papers")
            .select("id, title")
            .eq("slug", slug)
            .maybeSingle();
          if (paperErr) throw paperErr;
          if (!paperRow?.id) throw new Error("Mock paper not found.");
          const questionsFull = await fetchMockQuestionsForPaper(String(paperRow.id));
          const questions = questionsFull.map((q) => ({
            id: q.id,
            question: q.question,
            questionHtml: q.questionHtml ?? undefined,
            options: q.options,
          }));
          if (!cancelled)
            setPayload({ testTitle: String(paperRow.title ?? props.title), questions });
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load task.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [props.href, props.mode, props.title, props.chapterQuizRef]);

  if (props.mode === "concept-focus-preview") {
    return conceptPreviewProps ? (
      <div className="h-[86vh] w-full overflow-hidden sm:h-[90vh]">
        <ConceptFocusSubtopicPreview {...conceptPreviewProps} />
      </div>
    ) : (
      <div className="p-6 text-sm text-slate-400">Preview unavailable.</div>
    );
  }

  return (
    <div className="flex max-h-[86vh] flex-col sm:max-h-[90vh]">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2.5 sm:px-5 sm:py-4">
        <div className="min-w-0">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-500">
            Task preview
          </div>
          <div className="mt-1 truncate font-serif text-base text-slate-50 sm:text-xl">
            {payload?.testTitle ?? props.title}
          </div>
        </div>
      </div>

      {props.mode === "iframe" ? (
        <div className="flex-1">
          <iframe
            src={props.href}
            title={props.title}
            className="h-[74vh] w-full bg-[#07070f] sm:h-[82vh]"
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          />
        </div>
      ) : (
        <div className="min-h-[40vh] px-3 py-3 sm:px-5 sm:py-5">
          {loading ? (
            <div className="flex min-h-[34vh] items-center justify-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading questions…
            </div>
          ) : error ? (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-200">
              {error}
            </div>
          ) : payload && payload.questions.length ? (
            <div className="max-h-[60vh] overflow-y-auto pr-1 sm:max-h-[65vh]">
              <GeneratedMcqReview
                questions={payload.questions.map((q) => ({
                  id: q.id,
                  question: restoreLatexEscapes(
                    q.questionHtml?.trim() ? q.questionHtml : q.question
                  ),
                  options: q.options.map((o) => restoreLatexEscapes(o)),
                  correctAnswerIndex: q.correctAnswerIndex ?? null,
                }))}
                answers={new Array(payload.questions.length).fill(-1)}
                total={payload.questions.length}
                submitted={false}
                showCorrectAnswers={false}
                density="compact"
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center text-sm text-slate-400">
              No questions found for this task.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
