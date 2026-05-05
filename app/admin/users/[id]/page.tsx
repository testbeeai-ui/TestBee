"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { safeGetSession } from "@/lib/safeSession";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import PlayQuestionMarkdown from "@/components/PlayQuestionMarkdown";
import DoubtMarkdown from "@/components/doubts/DoubtMarkdown";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  formatMcqChoiceLabel,
  parsePlayQuestionOptions,
  playQuestionStemMarkdownSource,
} from "@/lib/adminPlayQuestionPreview";
import {
  buildPlaySessionsFromAttempts,
  PLAY_SESSION_INFERENCE_NOTE,
} from "@/lib/adminPlaySessions";
import { MAX_CHAT_MESSAGES } from "@/lib/adminStudentInsights";
import {
  getReferChallengeSpecs,
  referChallengeSpec,
  type ReferClaimKey,
} from "@/lib/referEarnChallenges";
import { DEFAULT_RDM_CONFIG, fetchRdmConfig, type RdmConfigParams } from "@/lib/rdmConfig";
import { cn } from "@/lib/utils";
import {
  ArrowBigDown,
  ArrowBigUp,
  ChevronDown,
  Copy,
  Loader2,
  MessageCircle,
  Search,
  Sparkles,
} from "lucide-react";

type AnalyticsResponse = {
  user: {
    id: string;
    email: string | null;
    role: string | null;
    name: string | null;
    createdAt: string | null;
    lastSignInAt: string | null;
    status: "active" | "suspended" | "banned" | "soft_deleted";
    bannedUntil: string | null;
    suspendedUntil: string | null;
    deletedAt: string | null;
  };
  metrics: {
    rdm: number;
    lifetimeRdm: number;
    savedBits: number;
    savedFormulas: number;
    savedRevisionCards: number;
    savedRevisionUnits: number;
    bitsAttempts: number;
    subtopicEngagement: number;
    doubtsCreated: number;
    doubtsResolved: number;
    doubtViews: number;
    aiCalls: number;
    aiTotalTokens: number;
  };
  series: {
    aiTokensByMonth: Array<{ month: string; tokens: number }>;
  };
};

type ActivityResponse = {
  activity: Array<{
    type: "governance" | "doubt" | "ai_call";
    timestamp: string;
    title: string;
    details: string;
  }>;
};

/** Play history row bundled into sessions (same shape as playArena.playHistoryRecent). */
type AdminPlayHistoryAttemptRow = {
  id: string;
  question_id: string;
  is_correct: boolean;
  time_taken_ms: number | null;
  selected_answer_index: number | null;
  pool_key: string | null;
  created_at: string;
  session_label: string | null;
  stem_preview: string;
  chosen_preview: string | null;
  correct_preview: string | null;
  question: {
    domain: string;
    category: string;
    content: unknown;
    options: string[];
    correct_answer_index: number;
    explanation: string | null;
  } | null;
};

/** Slim session row from API (attempt bodies live on playHistoryRecent only). */
type AdminPlaySessionApiRow = {
  id: string;
  startedAt: string;
  endedAt: string;
  attemptCount: number;
  correctCount: number;
  wrongCount: number;
  distinctPoolKeys: string[];
  attemptIds: string[];
};

/** Hydrated session for UI tables/sheets. */
type AdminPlaySessionRow = AdminPlaySessionApiRow & {
  attempts: AdminPlayHistoryAttemptRow[];
};

type StudentInsightsResponse = {
  schemaNote: string;
  generatedAt: string;
  userId: string;
  role: string | null;
  isStudent: boolean;
  profileLearning: {
    dailyChecklistState: unknown;
    bitsTestAttemptsKeys: number;
    savedBitsCount: number;
    savedFormulasCount: number;
    savedRevisionCardsCount: number;
    savedRevisionUnitsCount: number;
    savedCommunityPostsCount?: number;
  };
  dwellTotalsLast90DaysMs?: {
    theory: number;
    bits: number;
    numerals: number;
    instacue: number;
    all: number;
  };
  learningMap: {
    rows: Array<{
      storageKey: string;
      board: string;
      subject: string;
      classLevel: number | null;
      topic: string;
      subtopicName: string;
      level: string;
      keyWellFormed: boolean;
      dwellMsByPanel?: {
        theory: number;
        bits: number;
        numerals: number;
        instacue: number;
      };
      summary: {
        lessonChecklistMarkedCompleteAt: string | null;
        lessonFocusTimer: {
          secondsRemaining: number;
          running: boolean;
          everStarted?: boolean;
        } | null;
        bitsCurrentIdx: number | null;
        bitsVisitedCount: number;
        bitsGraded: {
          answered: number;
          correct: number;
          wrong: number;
          totalQuestions: number;
        } | null;
        instaCueNavVisitedCount: number;
        instaCueFlippedCount: number;
        numeralsFormulaSlots: number;
        conceptsPagesCount: number;
        updatedAt: string;
      };
    }>;
    totalKeysInStore: number;
    capped: boolean;
  };
  magicWall: {
    items: Array<{
      id: string;
      topic_key: string;
      board: string;
      subject: string;
      class_level: number;
      exam_type: string | null;
      unit_name: string | null;
      chapter_title: string | null;
      topic_name: string;
      /** Basket origin label from DB (default magic_wall). */
      source?: string | null;
      created_at: string;
      updated_at: string;
    }>;
    count: number;
  };
  classroomTasks: {
    rows: Array<{
      id: string;
      postId: string;
      taskId: string;
      completedAt: string;
      postTitle: string | null;
      postType: string | null;
      classroomId: string | null;
    }>;
    count: number;
  };
  gyanDoubts: {
    recent: Array<{
      id: string;
      title: string;
      body: string;
      listPreview: string;
      subject: string | null;
      isResolved: boolean;
      views: number;
      upvotes: number;
      downvotes: number;
      createdAt: string;
      curriculum: {
        chapter: string;
        topic: string;
        subtopic: string | null;
      } | null;
      answers: Array<{
        id: string;
        body: string;
        createdAt: string;
        authorName: string | null;
        authorRole: string | null;
        isAccepted: boolean;
        upvotes: number;
        downvotes: number;
        kind: "ai" | "teacher" | "student";
        kindLabel: string;
      }>;
    }>;
    recentCount: number;
    totals: { answersSubmitted: number };
  };
  community: {
    totals: {
      postsInDb: number;
      commentsInDb: number;
      postsLoaded: number;
      commentsLoaded: number;
      postsCapped: boolean;
      commentsCapped: boolean;
    };
    posts: Array<{
      id: string;
      kind: string;
      title: string;
      content: string;
      tags: string[];
      subject: string | null;
      sourceType: string | null;
      topicRef: string | null;
      subtopicRef: string | null;
      boardRef: string | null;
      gradeRef: string | null;
      unitRef: string | null;
      chapterRef: string | null;
      createdAt: string;
      updatedAt: string;
      upvoteCount: number;
      downvoteCount: number;
      commentCount: number;
      boostCount: number;
    }>;
    comments: Array<{
      id: string;
      postId: string;
      body: string;
      createdAt: string;
    }>;
  };
  subjectTopicChat: {
    messages: Array<{
      id: string;
      contextKey: string;
      role: string;
      body: string;
      createdAt: string;
    }>;
  };
  playArena: {
    playHistoryTotal: number;
    playHistoryRecent: AdminPlayHistoryAttemptRow[];
    /** Present on newer API builds; client falls back when missing. */
    playSessionsInferenceNote?: string;
    playSessions?: AdminPlaySessionApiRow[];
    userPlayStats: Array<{
      user_id: string;
      category: string;
      current_rating: number;
      questions_answered: number;
      win_streak: number;
      updated_at: string;
      question_pool_reset_at: string;
    }>;
    dailyGauntletAttempts: Array<{
      id: string;
      gauntlet_date: string;
      total_time_ms: number;
      correct_count: number;
      completed_at: string;
    }>;
    arenaStreakDays: number;
  };
  referEarn: {
    claims: Array<{
      user_id: string;
      claim_date: string;
      challenge_key: string;
      win_claimed: boolean;
      share_claimed: boolean;
      win_claimed_at: string | null;
      share_claimed_at: string | null;
      updated_at: string;
    }>;
  };
  /** UTC/reference calendar day used for streak summary (optional query override on API). */
  streakTodayKeyUsed?: string;
  studyDays?: {
    days: Array<{
      day: string;
      active_ms: number;
      presence_ms: number;
      updated_at: string | null;
    }>;
    summary: { streak: number; activeDaysThisMonth: number };
    streakActiveMsNote: string;
    presenceMsNote: string;
  };
  chapterAccuracy?: {
    rows: Array<{
      label: string;
      classLevel: 11 | 12;
      completionPct: number;
      completed: number;
      total: number;
      topicCountInChapter: number;
    }>;
    needsAttention: Array<{
      label: string;
      classLevel: 11 | 12;
      completionPct: number;
      completed: number;
      total: number;
      topicCountInChapter: number;
    }>;
    taxonomyNote: string | null;
    progressSourceNote: string;
  };
  bitsQuiz?: {
    submittedAttemptRowCount: number;
    draftGradedEngagementRows: number;
    subjectRollup: Array<{
      subject: string;
      quizCount: number;
      total: number;
      correct: number;
      wrong: number;
      skipped: number;
      accuracy: number;
      subtopicTags: string[];
    }>;
    attemptDetails: Array<{
      storageKey: string;
      groupingKey: string;
      subject: string;
      classLevel: number;
      topic: string;
      subtopicName: string;
      level: string;
      totalQuestions: number;
      correctCount: number;
      wrongCount: number;
      skippedCount: number;
      submittedAt: string | null;
    }>;
    rollupNote: string;
  };
  savedContent?: {
    savedBits: Array<{
      id: string;
      question: string;
      options: string[];
      correctAnswer: number;
      solution?: string;
      subject: string;
      topic: string;
      subtopicName: string;
      classLevel: number;
      unitName?: string;
      level?: string;
      board?: string;
      sectionIndex?: number;
      formulaName?: string;
      formulaLatex?: string;
    }>;
    savedFormulas: Array<{
      id: string;
      name: string;
      formulaLatex?: string;
      description?: string;
      bitsQuestions: Array<{
        question: string;
        options: string[];
        correctAnswer: number;
        solution?: string;
      }>;
      subject: string;
      topic: string;
      subtopicName: string;
      classLevel: number;
      unitName?: string;
      level?: string;
      board?: string;
      sectionIndex?: number;
    }>;
    savedRevisionCards: Array<{
      id: string;
      type: string;
      frontContent: string;
      backContent: string;
      savedAt?: string;
      subtopicName: string;
      topic: string;
      subject: string;
      classLevel: number;
      status?: string;
      level?: string;
      board?: string;
      sectionIndex?: number;
    }>;
    savedRevisionUnits: Array<{
      id: string;
      board: string;
      subject: string;
      classLevel: number;
      unitName: string;
      subtopicName: string;
      level: string;
      sectionIndex: number;
      sectionTitle: string;
    }>;
    savedCommunityPosts: Array<{
      id: string;
      postId: string;
      title: string;
      content: string;
      subject: string | null;
      chapterRef?: string | null;
      topicRef?: string | null;
      subtopicRef?: string | null;
      createdAt: string;
      savedAt: string;
    }>;
    capsNote: string;
  };
};

type MagicWallBasketInsightRow = StudentInsightsResponse["magicWall"]["items"][number];
type LearningMapInsightRow = StudentInsightsResponse["learningMap"]["rows"][number];
type SavedItemKind = "bit" | "formula" | "instacue_card" | "revision_unit" | "community_post";
type SavedItemRow = {
  kind: SavedItemKind;
  id: string;
  subjectLabel: string;
  classLevel: number | null;
  title: string;
  subtitle: string;
  savedAt: string | null;
  raw: unknown;
};

function normalizeMwSearchToken(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function doubtSubjectMatchesMagicWall(doubtSubject: string | null, mwSubject: string): boolean {
  const d = (doubtSubject ?? "").toLowerCase().trim();
  const m = mwSubject.toLowerCase().trim();
  if (!d) return true;
  if (d.includes(m) || m.includes(d)) return true;
  const aliases: Record<string, string[]> = {
    physics: ["physics", "phys"],
    chemistry: ["chemistry", "chem"],
    math: ["math", "mathematics"],
    biology: ["biology", "bio"],
  };
  return (aliases[m] ?? [m]).some((a) => d.includes(a));
}

/** Learning-map rows that likely correspond to this Magic Wall card (key overlap + text heuristic). */
function learningRowsMatchingMagicWallItem(
  mw: MagicWallBasketInsightRow,
  rows: LearningMapInsightRow[]
): LearningMapInsightRow[] {
  const out: LearningMapInsightRow[] = [];
  for (const row of rows) {
    if (!row.keyWellFormed || row.classLevel == null) continue;
    if (row.board.toLowerCase() !== mw.board.toLowerCase()) continue;
    if (row.subject.toLowerCase() !== mw.subject.toLowerCase()) continue;
    if (row.classLevel !== mw.class_level) continue;
    if (row.storageKey === mw.topic_key) {
      out.push(row);
      continue;
    }
    const tn = normalizeMwSearchToken(mw.topic_name);
    const ch = normalizeMwSearchToken(mw.chapter_title ?? "");
    const un = normalizeMwSearchToken(mw.unit_name ?? "");
    const blob = normalizeMwSearchToken(`${row.topic} ${row.subtopicName}`);
    const meaningful = (s: string) => s.replace(/\s/g, "").length >= 4;
    const hit =
      (meaningful(tn) && (blob.includes(tn) || tn.split(" ").some((w) => w.length > 4 && blob.includes(w)))) ||
      (meaningful(ch) && (blob.includes(ch) || ch.split(" ").some((w) => w.length > 4 && blob.includes(w)))) ||
      (meaningful(un) && blob.includes(un));
    if (hit) out.push(row);
  }
  return out;
}

function sumLearningDwellMs(rows: LearningMapInsightRow[]): {
  theory: number;
  bits: number;
  numerals: number;
  instacue: number;
  all: number;
} {
  const z = { theory: 0, bits: 0, numerals: 0, instacue: 0, all: 0 };
  for (const r of rows) {
    const d = r.dwellMsByPanel;
    if (!d) continue;
    z.theory += d.theory;
    z.bits += d.bits;
    z.numerals += d.numerals;
    z.instacue += d.instacue;
  }
  z.all = z.theory + z.bits + z.numerals + z.instacue;
  return z;
}

function chatMessagesMatchingMagicWallItem(
  mw: MagicWallBasketInsightRow,
  messages: StudentInsightsResponse["subjectTopicChat"]["messages"]
): StudentInsightsResponse["subjectTopicChat"]["messages"] {
  const needles = [
    normalizeMwSearchToken(mw.topic_name),
    normalizeMwSearchToken(mw.chapter_title ?? ""),
  ].filter((s) => s.replace(/\s/g, "").length >= 4);
  if (needles.length === 0) return [];
  return messages.filter((m) => {
    const k = m.contextKey.toLowerCase();
    const flat = k.replace(/[^a-z0-9]+/g, "");
    return needles.some((needle) => {
      const nf = needle.replace(/\s+/g, "");
      if (nf.length >= 5 && flat.includes(nf)) return true;
      return needle
        .split(" ")
        .filter((w) => w.length > 4)
        .some((w) => k.includes(w));
    });
  });
}

function doubtsMatchingMagicWallItem(
  mw: MagicWallBasketInsightRow,
  doubts: StudentInsightsResponse["gyanDoubts"]["recent"]
): StudentInsightsResponse["gyanDoubts"]["recent"] {
  return doubts.filter((d) => {
    if (!doubtSubjectMatchesMagicWall(d.subject, mw.subject)) return false;
    const tn = normalizeMwSearchToken(mw.topic_name);
    if (tn.replace(/\s/g, "").length < 5) return true;
    const title = normalizeMwSearchToken(d.title);
    const body = normalizeMwSearchToken(d.body);
    return (
      title.includes(tn) ||
      body.includes(tn) ||
      tn.split(" ").some((w) => w.length > 5 && (title.includes(w) || body.includes(w)))
    );
  });
}

function communityPostsMatchingMagicWallItem(
  mw: MagicWallBasketInsightRow,
  posts: StudentInsightsResponse["community"]["posts"]
): StudentInsightsResponse["community"]["posts"] {
  const tn = normalizeMwSearchToken(mw.topic_name);
  const ch = normalizeMwSearchToken(mw.chapter_title ?? "");
  return posts
    .filter((p) => {
      const ps = (p.subject ?? "").toLowerCase();
      const ms = mw.subject.toLowerCase();
      if (ps && !ps.includes(ms) && !ms.includes(ps)) return false;
      const blob = normalizeMwSearchToken(`${p.title} ${p.content}`);
      return (
        (tn.replace(/\s/g, "").length >= 5 && blob.includes(tn)) ||
        (ch.replace(/\s/g, "").length >= 5 && blob.includes(ch))
      );
    })
    .slice(0, 15);
}

function parseMagicWallTopicKeySegments(topicKey: string): string[] {
  return topicKey.split("||").map((s) => s.trim()).filter(Boolean);
}

function AdminMagicWallTopicSheetInner({
  item,
  learningMatches,
  chatMatches,
  doubtMatches,
  communityMatches,
}: {
  item: MagicWallBasketInsightRow;
  learningMatches: LearningMapInsightRow[];
  doubtMatches: StudentInsightsResponse["gyanDoubts"]["recent"];
  chatMatches: StudentInsightsResponse["subjectTopicChat"]["messages"];
  communityMatches: StudentInsightsResponse["community"]["posts"];
}) {
  const keySegments = parseMagicWallTopicKeySegments(item.topic_key);
  const dwell = sumLearningDwellMs(learningMatches);

  return (
    <>
      <SheetHeader className="space-y-3 border-b border-border/60 pb-5 text-left">
        <SheetTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
          Magic Wall topic
        </SheetTitle>
        <SheetDescription className="text-base font-medium leading-snug text-foreground">
          {item.topic_name}
        </SheetDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          <Badge variant="outline" className="capitalize">
            {item.board}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {item.subject}
          </Badge>
          <Badge variant="outline" className="tabular-nums">
            Class {item.class_level}
          </Badge>
          {item.exam_type ? (
            <Badge variant="secondary" className="text-[10px]">
              {item.exam_type}
            </Badge>
          ) : null}
          {item.source ? (
            <Badge variant="outline" className="font-mono text-[10px]">
              source:{item.source}
            </Badge>
          ) : null}
        </div>
      </SheetHeader>

      <div className="mt-6 space-y-8 text-sm">
        <section className="rounded-xl border border-border/70 bg-muted/[0.08] p-4 shadow-sm">
          <ReferSessionSectionTitle>Basket snapshot</ReferSessionSectionTitle>
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
                Added
              </dt>
              <dd className="mt-0.5 tabular-nums text-foreground">
                {new Date(item.created_at).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
                Last updated
              </dt>
              <dd className="mt-0.5 tabular-nums text-foreground">
                {new Date(item.updated_at).toLocaleString()}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
                Chapter / unit
              </dt>
              <dd className="mt-0.5 text-foreground">
                {item.chapter_title ?? "—"}
                {item.unit_name ? (
                  <span className="block text-muted-foreground">Unit: {item.unit_name}</span>
                ) : null}
              </dd>
            </div>
          </dl>
          <Separator className="my-4 opacity-60" />
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Topic key segments
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-[11px] text-muted-foreground">
              {keySegments.length === 0 ? (
                <li className="list-none pl-0 font-mono text-[10px] break-all">{item.topic_key}</li>
              ) : (
                keySegments.map((seg, i) => (
                  <li key={`${i}-${seg.slice(0, 24)}`} className="break-all font-mono">
                    {seg}
                  </li>
                ))
              )}
            </ol>
          </div>
          <div className="mt-3 rounded-lg border bg-muted/40 p-2 font-mono text-[10px] text-muted-foreground break-all">
            topic_key: {item.topic_key}
          </div>
        </section>

        <section className="rounded-xl border border-border/60 bg-muted/[0.06] p-4">
          <ReferSessionSectionTitle>How we correlate app data</ReferSessionSectionTitle>
          <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground marker:text-muted-foreground/70">
            <li>
              Magic Wall rows use the same <span className="font-mono text-[10px]">topic_key</span> shape as lesson
              taxonomy (board · subject · class · unit · chapter · topic label).
            </li>
            <li>
              Learning-map keys add a <strong className="font-medium text-foreground">difficulty level</strong> segment,
              so rows rarely match exactly—we surface subtopics whose labels overlap this card.
            </li>
            <li>
              Chat context keys and community copy are matched by normalized topic/chapter text—treat as advisory, not
              proof of navigation path.
            </li>
          </ul>
        </section>

        <section>
          <ReferSessionSectionTitle>Learning map &amp; dwell (matched rows)</ReferSessionSectionTitle>
          <div className="mb-3 flex flex-wrap gap-2 text-xs">
            <Badge variant="outline" className="tabular-nums">
              Matches {learningMatches.length}
            </Badge>
            <Badge variant="secondary" className="tabular-nums">
              Σ dwell {fmtDwellMs(dwell.all)} (90d heartbeat telemetry)
            </Badge>
          </div>
          {learningMatches.length === 0 ? (
            <p className="rounded-lg border border-dashed bg-muted/15 px-4 py-3 text-xs text-muted-foreground">
              No learning-map rows overlapped this topic_key/text heuristic. The student may not have opened lesson
              panels for this taxonomy scope yet, or engagement JSON uses different labels.
            </p>
          ) : (
            <div className="space-y-3">
              {learningMatches.map((row) => {
                const d = row.dwellMsByPanel ?? {
                  theory: 0,
                  bits: 0,
                  numerals: 0,
                  instacue: 0,
                };
                const parts = sumLearningDwellMs([row]);
                return (
                  <div
                    key={row.storageKey}
                    className="rounded-xl border border-border/65 bg-card/[0.35] p-3 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 space-y-1">
                        <p className="text-xs font-semibold capitalize text-foreground">
                          {row.level} · {row.subtopicName || row.topic}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Topic hub: {row.topic}
                          {row.subtopicName ? ` · Subtopic: ${row.subtopicName}` : ""}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px] capitalize">
                        dwell {fmtDwellMs(parts.all)}
                      </Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary" className="text-[10px] tabular-nums">
                        theory {fmtDwellMs(d.theory)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] tabular-nums">
                        quiz {fmtDwellMs(d.bits)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] tabular-nums">
                        numerals {fmtDwellMs(d.numerals)}
                      </Badge>
                      <Badge variant="secondary" className="text-[10px] tabular-nums">
                        instacue {fmtDwellMs(d.instacue)}
                      </Badge>
                    </div>
                    <p className="mt-2 text-[10px] font-mono text-muted-foreground break-all">
                      {row.storageKey}
                    </p>
                    <div className="mt-2 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
                      <span>
                        Quiz visits:{" "}
                        <span className="font-medium text-foreground">{row.summary.bitsVisitedCount}</span>
                      </span>
                      <span>
                        InstaCue flips:{" "}
                        <span className="font-medium text-foreground">{row.summary.instaCueFlippedCount}</span>
                      </span>
                      {row.summary.bitsGraded ? (
                        <span className="sm:col-span-2">
                          Quiz graded:{" "}
                          <span className="font-medium text-foreground">
                            {row.summary.bitsGraded.correct}/{row.summary.bitsGraded.totalQuestions} correct
                          </span>
                        </span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section>
          <ReferSessionSectionTitle>Subject topic chat (likely thread)</ReferSessionSectionTitle>
          {chatMatches.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No chat threads whose context key clearly overlaps this topic/chapter string.
            </p>
          ) : (
            <ul className="space-y-3">
              {chatMatches.map((m) => (
                <li key={m.id} className="rounded-lg border border-border/60 bg-muted/15 p-3">
                  <div className="flex flex-wrap justify-between gap-2 text-[11px]">
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {m.role}
                    </Badge>
                    <span className="tabular-nums text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{m.contextKey}</p>
                  <p className="mt-2 text-xs leading-relaxed text-foreground whitespace-pre-wrap">{m.body}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <ReferSessionSectionTitle>Gyan++ doubts (subject + topic text)</ReferSessionSectionTitle>
          {doubtMatches.length === 0 ? (
            <p className="text-xs text-muted-foreground">No recent doubts matched this topic wording.</p>
          ) : (
            <ul className="space-y-2">
              {doubtMatches.map((d) => (
                <li key={d.id} className="rounded-lg border border-border/60 px-3 py-2">
                  <p className="text-xs font-semibold text-foreground">{d.title}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {d.subject ?? "—"} · {d.isResolved ? "Resolved" : "Open"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <ReferSessionSectionTitle>Community posts (subject + text overlap)</ReferSessionSectionTitle>
          {communityMatches.length === 0 ? (
            <p className="text-xs text-muted-foreground">No loaded community posts matched this topic/chapter text.</p>
          ) : (
            <ul className="space-y-3">
              {communityMatches.map((p) => (
                <li key={p.id} className="rounded-lg border border-border/60 bg-muted/10 p-3">
                  <p className="text-xs font-semibold">{p.title}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {p.subject ?? "—"} · {new Date(p.createdAt).toLocaleString()}
                  </p>
                  <div className="mt-2 max-h-28 overflow-hidden text-xs text-muted-foreground">
                    <AdminCommunityMarkdown source={p.content} clamp lines={4} compact />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="rounded-lg border bg-muted/40 p-2.5 font-mono text-[10px] text-muted-foreground break-all">
          basket_row_id: {item.id}
        </div>
      </div>
    </>
  );
}

type ReferChallengeSessionQuestionJoin = {
  domain: string;
  category: string;
  content: unknown;
  options: unknown;
  correct_answer_index: number;
  explanation: string | null;
};

type ReferChallengeSessionAttemptRow = {
  id: string;
  question_id: string;
  is_correct: boolean;
  time_taken_ms: number | null;
  selected_answer_index: number | null;
  pool_key: string | null;
  created_at: string;
  play_questions:
    | ReferChallengeSessionQuestionJoin
    | ReferChallengeSessionQuestionJoin[]
    | null;
};

type ReferChallengeSessionCommunityShareRow = {
  id: string;
  title: string | null;
  content: string | null;
  created_at: string;
  tags: unknown;
  source_payload: unknown;
  source_type: string | null;
};

type ReferChallengeSessionApiResponse = {
  claim: {
    user_id: string;
    claim_date: string;
    challenge_key: string;
    win_claimed: boolean;
    share_claimed: boolean;
    win_claimed_at: string | null;
    share_claimed_at: string | null;
    updated_at: string;
    created_at?: string | null;
  };
  challengeName: string;
  poolKey: string;
  sessionWindowUtc: { start: string; end: string };
  postMatchWindowUtc: { start: string; end: string };
  heuristicNotes: string[];
  attempts: ReferChallengeSessionAttemptRow[];
  communityShares: ReferChallengeSessionCommunityShareRow[];
};

type PlayAttemptRow = AdminPlayHistoryAttemptRow;
type PlaySessionInsightRow = AdminPlaySessionRow;

function formatPlaySessionDuration(startedAt: string, endedAt: string): string {
  const ms = Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const m = Math.floor(ms / 60_000);
  const s = Math.round((ms % 60_000) / 1000);
  return `${m}m ${s}s`;
}

function playSessionDistinctModeLabels(s: PlaySessionInsightRow): string[] {
  const set = new Set<string>();
  for (const a of s.attempts) {
    const label = a.session_label?.trim();
    if (label) set.add(label);
  }
  return [...set];
}

/** Collapsible technical block inside the Play session sheet — admins expand only when needed. */
function PlaySessionExtendedAuditPanel({
  session,
  inferenceNote,
}: {
  session: AdminPlaySessionRow;
  inferenceNote: string;
}) {
  const [copied, setCopied] = useState<"summary" | "ids" | null>(null);
  const summaryText = [
    `session_id: ${session.id}`,
    `started_at: ${session.startedAt}`,
    `ended_at: ${session.endedAt}`,
    `attempt_count: ${session.attemptCount}`,
    `correct: ${session.correctCount}`,
    `wrong: ${session.wrongCount}`,
    `distinct_pool_keys: ${session.distinctPoolKeys.join(", ") || "—"}`,
  ].join("\n");
  const idsText = session.attemptIds.join("\n");

  const copy = async (kind: "summary" | "ids", text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1400);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-3">
      <p className="leading-relaxed text-muted-foreground">
        Technical fields for support tickets and exports. Quiz passages tied to{" "}
        <span className="font-medium text-foreground">Earn &amp; Learn</span> claims (questions + share trail) are
        opened from this user&apos;s <span className="font-medium text-foreground">Earn &amp; Learn</span> tab — click
        the matching claim row.
      </p>
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Session summary
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => void copy("summary", summaryText)}
          >
            <Copy className="h-3.5 w-3.5 shrink-0" />
            {copied === "summary" ? "Copied" : "Copy"}
          </Button>
        </div>
        <pre className="max-h-40 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[10px] leading-snug text-muted-foreground">
          {summaryText}
        </pre>
      </div>
      <div>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Attempt IDs ({session.attemptIds.length})
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => void copy("ids", idsText)}
          >
            <Copy className="h-3.5 w-3.5 shrink-0" />
            {copied === "ids" ? "Copied" : "Copy"}
          </Button>
        </div>
        <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[10px] leading-snug text-muted-foreground break-all whitespace-pre-wrap">
          {idsText || "—"}
        </pre>
      </div>
      <div className="rounded-md border border-border/80 bg-muted/15 p-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Session inference note
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">{inferenceNote}</p>
      </div>
    </div>
  );
}

function playAttemptMcqLetter(index: number): string {
  return index >= 0 && index < 26 ? String.fromCharCode(65 + index) : `#${index + 1}`;
}

/** Single-line KaTeX/markdown clamp; full content opens via row → sheet. */
function PlayAttemptStemOneLine({ row }: { row: PlayAttemptRow }) {
  const raw = row.question
    ? playQuestionStemMarkdownSource(row.question.content)
    : (row.stem_preview ?? "");
  if (!raw.trim()) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="min-w-0 w-full max-w-full">
      <PlayQuestionMarkdown
        variant="stem"
        source={raw}
        className={cn(
          "!text-sm !leading-normal text-foreground/90 font-medium",
          "line-clamp-1 overflow-hidden text-ellipsis",
          "[&_p]:!inline [&_p]:!my-0 [&_p]:!leading-normal",
          "[&_.katex]:!text-[0.97em]",
          "[&_.katex-display]:!inline [&_.katex-display]:!my-0 [&_.katex-display]:align-middle"
        )}
      />
    </div>
  );
}

function PlayAttemptOptionOneLine({
  letter,
  optionMarkdown,
  fallbackPlain,
}: {
  letter: string | null;
  optionMarkdown: string | null;
  fallbackPlain: string | null;
}) {
  const src = (optionMarkdown ?? "").trim() || (fallbackPlain ?? "").trim();
  if (!src) {
    return <span className="text-muted-foreground">—</span>;
  }
  return (
    <div className="flex min-w-0 w-full max-w-full items-baseline gap-1.5">
      {letter ? (
        <span className="shrink-0 font-mono text-xs font-semibold text-muted-foreground">
          {letter}
        </span>
      ) : null}
      <div className="min-w-0 flex-1">
        <PlayQuestionMarkdown
          variant="option"
          source={src}
          className={cn(
            "!text-sm !leading-normal text-foreground/90 font-medium",
            "line-clamp-1 overflow-hidden text-ellipsis",
            "[&_p]:!inline [&_p]:!my-0 [&_p]:!leading-normal",
            "[&_.katex]:!text-[0.97em]",
            "[&_.katex-display]:!inline [&_.katex-display]:!my-0"
          )}
        />
      </div>
    </div>
  );
}

/** Markdown + KaTeX for lessons_raw_* bodies (same pipeline as topic quizzes). */
function AdminCommunityMarkdown({
  source,
  clamp,
  lines = 4,
  compact,
  className,
}: {
  source: string;
  clamp: boolean;
  /** When clamping: single-line titles vs multi-line preview. */
  lines?: 1 | 4;
  /** Smaller type and tighter vertical rhythm (admin dense panels). */
  compact?: boolean;
  className?: string;
}) {
  const s = source?.trim();
  if (!s) {
    return (
      <p
        className={cn(compact ? "text-xs" : "text-sm", "italic text-muted-foreground", className)}
      >
        Empty
      </p>
    );
  }
  return (
    <div
      className={cn(
        "min-w-0 text-foreground [&_.play-question-md]:text-sm [&_.play-question-md]:leading-relaxed sm:[&_.play-question-md]:text-[15px]",
        compact &&
          cn(
            "text-xs [&_.play-question-md]:!text-[13px] [&_.play-question-md]:!leading-snug",
            "[&_.katex]:!text-[0.92em] [&_.katex-display]:!my-2 [&_.katex-display]:!text-[0.95em]",
            "[&_h1]:!mb-1 [&_h1]:!mt-2 [&_h1]:!text-sm [&_h2]:!mb-1 [&_h2]:!mt-2 [&_h2]:!text-sm",
            "[&_h3]:!mb-1 [&_h3]:!mt-1.5 [&_h3]:!text-xs [&_p]:!my-1 [&_ul]:!my-1 [&_ol]:!my-1 [&_li]:!my-0.5"
          ),
        clamp &&
          (lines === 1
            ? "line-clamp-1 max-h-[2.25rem] overflow-hidden"
            : "line-clamp-4 max-h-[6.5rem] overflow-hidden"),
        className
      )}
    >
      <PlayQuestionMarkdown variant="stem" source={s} />
    </div>
  );
}

function referAttemptQuestionJoin(
  row: ReferChallengeSessionAttemptRow
): ReferChallengeSessionQuestionJoin | null {
  const j = row.play_questions;
  if (j == null) return null;
  return Array.isArray(j) ? j[0] ?? null : j;
}

/** Refer challenge sheet: uppercase section rhythm matching Play / audit panels. */
function ReferSessionSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h3>
  );
}

function AdminReferChallengeSessionSheetInner({
  selection,
  loadState,
  rdmConfig,
}: {
  selection: { claim_date: string; challenge_key: string };
  loadState: {
    loading: boolean;
    error: string;
    data: ReferChallengeSessionApiResponse | null;
  };
  rdmConfig: RdmConfigParams | null;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const copyText = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1400);
    } catch {
      /* ignore */
    }
  }, []);

  const spec = referChallengeSpec(
    selection.challenge_key as ReferClaimKey,
    rdmConfig ?? DEFAULT_RDM_CONFIG
  );

  return (
    <>
      <SheetHeader className="space-y-3 border-b border-border/60 pb-5 text-left">
        <SheetTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
          Refer challenge session
        </SheetTitle>
        <SheetDescription className="text-base font-medium leading-snug text-foreground">
          {loadState.data?.challengeName ?? spec?.name ?? "Challenge"} · UTC {selection.claim_date}
        </SheetDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
            key:{selection.challenge_key}
          </span>
          {loadState.data ? (
            <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/40 px-2.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
              pool:{loadState.data.poolKey}
            </span>
          ) : null}
        </div>
      </SheetHeader>

      <div className="mt-6 space-y-8 text-sm">
        {loadState.loading ? (
          <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-3 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Loading session detail…
          </div>
        ) : null}
        {loadState.error ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {loadState.error}
          </p>
        ) : null}

        {loadState.data ? (
          <>
            {/* Status + UTC audit windows */}
            <section>
              <ReferSessionSectionTitle>Claim status &amp; time windows</ReferSessionSectionTitle>
              <div className="rounded-xl border border-border/70 bg-muted/[0.08] p-4 shadow-sm">
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={loadState.data.claim.win_claimed ? "secondary" : "outline"}
                    className={cn(
                      "text-xs font-semibold",
                      loadState.data.claim.win_claimed &&
                        "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                    )}
                  >
                    {loadState.data.claim.win_claimed ? "Win claimed" : "Win not claimed"}
                  </Badge>
                  <Badge
                    variant={loadState.data.claim.share_claimed ? "secondary" : "outline"}
                    className={cn(
                      "text-xs font-semibold",
                      loadState.data.claim.share_claimed &&
                        "border-emerald-500/35 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100"
                    )}
                  >
                    {loadState.data.claim.share_claimed ? "Share claimed" : "Share not claimed"}
                  </Badge>
                </div>
                <Separator className="my-4 opacity-60" />
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Play match window (UTC)
                    </dt>
                    <dd className="break-all rounded-lg border bg-background/60 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {loadState.data.sessionWindowUtc.start}
                      <span className="mx-1 text-foreground/40">→</span>
                      {loadState.data.sessionWindowUtc.end}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Community post window (UTC)
                    </dt>
                    <dd className="break-all rounded-lg border bg-background/60 px-2.5 py-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                      {loadState.data.postMatchWindowUtc.start}
                      <span className="mx-1 text-foreground/40">→</span>
                      {loadState.data.postMatchWindowUtc.end}
                    </dd>
                  </div>
                </dl>
              </div>
            </section>

            {/* Data logic */}
            <section className="rounded-xl border border-border/60 bg-muted/[0.06] p-4">
              <ReferSessionSectionTitle>How this matches data</ReferSessionSectionTitle>
              <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground marker:text-muted-foreground/70">
                {loadState.data.heuristicNotes.map((n, i) => (
                  <li key={i} className="pl-0.5">
                    {n}
                  </li>
                ))}
              </ul>
            </section>

            {/* Quiz replay */}
            <section>
              <ReferSessionSectionTitle>Quiz attempts (best-effort)</ReferSessionSectionTitle>
              {loadState.data.attempts.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-muted/15 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  No play_history rows in the time window for this pool. The student may have played
                  outside the window, or matching missed due to clock skew.
                </p>
              ) : (
                <ul className="space-y-5">
                  {loadState.data.attempts.map((row, idx) => {
                    const pq = referAttemptQuestionJoin(row);
                    const options = parsePlayQuestionOptions(pq?.options);
                    const secs =
                      row.time_taken_ms != null ? (row.time_taken_ms / 1000).toFixed(1) : null;
                    return (
                      <li
                        key={row.id}
                        className="overflow-hidden rounded-xl border border-border/70 bg-card/[0.35] shadow-sm"
                      >
                        {/* Attempt header bar */}
                        <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/25 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 space-y-1">
                            <p className="text-sm font-semibold tabular-nums text-foreground">
                              #{idx + 1}
                              <span className="mx-1.5 font-normal text-muted-foreground">·</span>
                              {new Date(row.created_at).toLocaleString()}
                            </p>
                            {pq ? (
                              <p className="text-xs text-muted-foreground">
                                <span className="font-medium text-foreground/90">{pq.domain}</span>
                                <span className="mx-1 opacity-50">·</span>
                                <span>{pq.category}</span>
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            <Badge
                              variant={row.is_correct ? "secondary" : "destructive"}
                              className={cn(
                                "text-[11px] font-semibold",
                                row.is_correct &&
                                  "border-emerald-500/40 bg-emerald-500/15 text-emerald-900 dark:text-emerald-100"
                              )}
                            >
                              {row.is_correct ? "Correct" : "Wrong"}
                            </Badge>
                            {secs != null ? (
                              <Badge variant="outline" className="tabular-nums text-[11px] font-medium">
                                {secs}s
                              </Badge>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-5 px-4 py-4">
                          <div>
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                              Question
                            </p>
                            <div className="rounded-lg border border-border/70 bg-background/80 px-3 py-3">
                              {pq ? (
                                <PlayQuestionMarkdown
                                  variant="stem"
                                  source={playQuestionStemMarkdownSource(pq.content)}
                                />
                              ) : (
                                <p className="text-xs text-amber-700 dark:text-amber-400">
                                  Question join missing — see IDs below.
                                </p>
                              )}
                            </div>
                          </div>

                          {pq && options.length > 0 ? (
                            <div>
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Options
                              </p>
                              <ul className="space-y-2.5">
                                {options.map((opt, i) => {
                                  const letter = i < 26 ? String.fromCharCode(65 + i) : `#${i + 1}`;
                                  const isPicked = row.selected_answer_index === i;
                                  const isRight = pq.correct_answer_index === i;
                                  return (
                                    <li
                                      key={`${row.id}-opt-${i}`}
                                      className={cn(
                                        "rounded-lg border px-3 py-2.5 transition-colors",
                                        isPicked && isRight
                                          ? "border-emerald-500/70 bg-emerald-500/[0.12] ring-1 ring-emerald-500/25"
                                          : isPicked
                                            ? "border-amber-500/65 bg-amber-500/[0.12] ring-1 ring-amber-500/20"
                                            : isRight
                                              ? "border-emerald-500/55 bg-emerald-500/[0.06]"
                                              : "border-border/65 bg-muted/15"
                                      )}
                                    >
                                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-xs font-bold text-muted-foreground">
                                          {letter}
                                        </span>
                                        {isPicked ? (
                                          <Badge variant="outline" className="text-[10px] font-medium">
                                            Student
                                          </Badge>
                                        ) : null}
                                        {isRight ? (
                                          <Badge
                                            variant="secondary"
                                            className="border-emerald-500/30 bg-emerald-500/20 text-[10px] font-semibold text-emerald-900 dark:text-emerald-100"
                                          >
                                            Correct
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <PlayQuestionMarkdown variant="option" source={opt} />
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ) : null}

                          <div className="flex flex-wrap gap-x-3 gap-y-1 rounded-md bg-muted/25 px-3 py-2 text-[11px] text-muted-foreground">
                            <span>
                              <span className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground/90">
                                Chosen
                              </span>{" "}
                              <span className="font-medium text-foreground">
                                {formatMcqChoiceLabel(row.selected_answer_index, options) || "—"}
                              </span>
                            </span>
                            <span className="hidden text-muted-foreground/40 sm:inline">|</span>
                            <span>
                              <span className="font-semibold uppercase tracking-wide text-[10px] text-muted-foreground/90">
                                Correct
                              </span>{" "}
                              <span className="font-medium text-foreground">
                                {formatMcqChoiceLabel(pq?.correct_answer_index ?? null, options) ||
                                  "—"}
                              </span>
                            </span>
                          </div>

                          {pq?.explanation ? (
                            <div>
                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                                Explanation
                              </p>
                              <div className="rounded-lg border border-border/60 bg-muted/10 px-3 py-3">
                                <PlayQuestionMarkdown variant="explanation" source={pq.explanation} />
                              </div>
                            </div>
                          ) : null}

                          <div className="rounded-lg border bg-muted/40 p-2.5 font-mono text-[10px] text-muted-foreground break-all">
                            attempt_id: {row.id} · question_id: {row.question_id}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Share trail */}
            <section className="border-t border-border/50 pt-8">
              <ReferSessionSectionTitle>Share trail (tracked vs external)</ReferSessionSectionTitle>
              <p className="mb-4 max-w-prose text-xs leading-relaxed text-muted-foreground">
                When the student uses{" "}
                <span className="font-medium text-foreground">Post to community</span>, we store{" "}
                <span className="rounded bg-muted px-1 font-mono text-[10px]">lessons_raw_posts</span>{" "}
                with{" "}
                <span className="rounded bg-muted px-1 font-mono text-[10px]">
                  source_type=refer_challenge
                </span>
                . Native WhatsApp / Instagram share sheets do not report a destination URL back to
                the server, so those paths cannot be listed here.
              </p>
              {loadState.data.communityShares.length === 0 ? (
                <p className="rounded-lg border border-dashed bg-muted/15 px-4 py-3 text-xs text-muted-foreground">
                  {loadState.data.claim.share_claimed
                    ? "No matching community post in the ±3h window — share was likely via external app intent only."
                    : "No share reward claimed for this row."}
                </p>
              ) : (
                <ul className="space-y-4">
                  {loadState.data.communityShares.map((post) => (
                    <li
                      key={post.id}
                      className="overflow-hidden rounded-xl border border-border/70 bg-muted/[0.06] shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/55 bg-muted/20 px-4 py-2.5">
                        <Badge variant="secondary" className="text-[10px] font-semibold">
                          Community feed (refer_challenge)
                        </Badge>
                        <span className="tabular-nums text-[11px] text-muted-foreground">
                          {new Date(post.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="space-y-4 px-4 py-3">
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Title
                          </p>
                          <AdminCommunityMarkdown source={post.title ?? ""} clamp={false} compact />
                        </div>
                        <div>
                          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                            Body
                          </p>
                          <AdminCommunityMarkdown source={post.content ?? ""} clamp={false} compact />
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => void copyText(`post-${post.id}`, post.id)}
                        >
                          <Copy className="h-3.5 w-3.5 shrink-0" />
                          {copiedKey === `post-${post.id}` ? "Copied" : "Copy post id"}
                        </Button>
                        <div className="whitespace-pre-wrap break-all rounded-lg border bg-muted/40 p-2.5 font-mono text-[10px] text-muted-foreground">
                          source_payload:{" "}
                          {post.source_payload != null ? JSON.stringify(post.source_payload) : "null"}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}

const PIE_COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#14b8a6"];

function fmtDwellMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const m = Math.floor(ms / 60000);
  const s = Math.round((ms % 60000) / 1000);
  if (m >= 120) return `${Math.round(ms / 3600000)}h`;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

/** Shift YYYY-MM-DD by delta days (UTC calendar). */
function isoCalendarDayAdd(iso: string, deltaDays: number): string {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return iso;
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function fmtStudyPresenceShort(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  if (ms < 60_000) return "<1m";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h${rm}m` : `${h}h`;
}

function adminSubjectLabel(subject: string): string {
  const s = subject.toLowerCase();
  if (s === "physics") return "Physics";
  if (s === "chemistry") return "Chemistry";
  if (s === "math") return "Mathematics";
  return subject;
}

function buildAdminStudyHeatCells(
  endKey: string | undefined,
  windowSize: 7 | 30,
  rows: Array<{ day: string; active_ms: number; presence_ms: number }>
): Array<{ day: string; active_ms: number; presence_ms: number }> {
  if (!endKey) return [];
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: Array<{ day: string; active_ms: number; presence_ms: number }> = [];
  for (let back = windowSize - 1; back >= 0; back--) {
    const key = isoCalendarDayAdd(endKey, -back);
    const hit = map.get(key);
    out.push({
      day: key,
      active_ms: hit?.active_ms ?? 0,
      presence_ms: hit?.presence_ms ?? 0,
    });
  }
  return out;
}

function fmtUpdatedCompact(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(undefined, {
      month: "numeric",
      day: "numeric",
      year: "2-digit",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function isoToMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : 0;
}

function isIsoDayKey(key: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(key);
}

function fmtShortMinutesFromMs(ms: number): string {
  const m = Math.round(Math.max(0, ms) / 60_000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

type ChecklistDayRow = {
  day: string;
  totalsMs: Record<string, number>;
  totalMs: number;
};

function extractChecklistDays(state: unknown): ChecklistDayRow[] {
  if (!state || typeof state !== "object" || Array.isArray(state)) return [];
  const obj = state as Record<string, unknown>;
  const out: ChecklistDayRow[] = [];
  for (const [day, v] of Object.entries(obj)) {
    if (!isIsoDayKey(day)) continue;
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const row = v as Record<string, unknown>;
    const totalsMs: Record<string, number> = {};
    let totalMs = 0;
    for (const [k, val] of Object.entries(row)) {
      if (!k.toLowerCase().endsWith("ms")) continue;
      if (typeof val !== "number" || !Number.isFinite(val)) continue;
      const n = Math.max(0, val);
      totalsMs[k] = n;
      totalMs += n;
    }
    out.push({ day, totalsMs, totalMs });
  }
  out.sort((a, b) => b.day.localeCompare(a.day));
  return out;
}

function ChecklistVisual({ state }: { state: unknown }) {
  const days = useMemo(() => extractChecklistDays(state), [state]);
  const maxMs = useMemo(() => Math.max(1, ...days.map((d) => d.totalMs)), [days]);
  const recent = days.slice(0, 14);

  const knownKeys = [
    { key: "doubtsFocusMs", label: "Doubts" },
    { key: "lessonFocusMs", label: "Lesson" },
    { key: "bitsFocusMs", label: "Quiz" },
    { key: "instaCueFocusMs", label: "InstaCue" },
    { key: "numeralsFocusMs", label: "Numerals" },
  ] as const;

  const totalAll = days.reduce((acc, d) => acc + d.totalMs, 0);
  const total7 = days.slice(0, 7).reduce((acc, d) => acc + d.totalMs, 0);

  return (
    <Card className="border-border/70 bg-muted/[0.06]">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Daily checklist (visual)</CardTitle>
        <CardDescription className="text-xs leading-relaxed sm:text-sm">
          Best-effort summary of the persisted home checklist state. Focus times are derived from fields ending with{" "}
          <span className="font-mono">Ms</span>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border bg-card/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Last 7 days</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{fmtShortMinutesFromMs(total7)}</p>
            <p className="text-[11px] text-muted-foreground">{recent.length ? `Newest day: ${recent[0].day}` : "—"}</p>
          </div>
          <div className="rounded-xl border bg-card/60 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">All time (loaded)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{fmtShortMinutesFromMs(totalAll)}</p>
            <p className="text-[11px] text-muted-foreground">{days.length ? `${days.length} day(s)` : "—"}</p>
          </div>
        </div>

        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No per-day checklist rows found.</p>
        ) : (
          <div className="rounded-xl border bg-card/40 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Timeline (recent)</p>
            <div className="mt-3 grid gap-2">
              {recent.map((d) => {
                const w = Math.max(2, Math.round((d.totalMs / maxMs) * 100));
                const breakdown = knownKeys
                  .map((k) => {
                    const ms = d.totalsMs[k.key] ?? 0;
                    return ms > 0 ? `${k.label} ${fmtShortMinutesFromMs(ms)}` : null;
                  })
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <div key={d.day} className="grid grid-cols-[5.25rem_1fr] items-center gap-3">
                    <div className="text-xs tabular-nums text-muted-foreground">{d.day}</div>
                    <div className="min-w-0">
                      <div className="h-2 w-full rounded-full bg-muted/50">
                        <div
                          className="h-2 rounded-full bg-emerald-500/70"
                          style={{ width: `${w}%` }}
                          title={`${d.day}: ${fmtShortMinutesFromMs(d.totalMs)}`}
                        />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-medium tabular-nums text-foreground">
                          {fmtShortMinutesFromMs(d.totalMs)}
                        </span>
                        <span className="text-[10px] text-muted-foreground line-clamp-1">{breakdown || "—"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function savedKindLabel(kind: SavedItemKind): string {
  if (kind === "bit") return "Quiz";
  if (kind === "formula") return "Formula";
  if (kind === "instacue_card") return "InstaCue";
  if (kind === "revision_unit") return "Unit";
  if (kind === "community_post") return "Community";
  return kind;
}

/** Matches `buildSubjectChatContextKey` encoding: alternating `label` + encodeURIComponent(value). */
function parseSubjectTopicContextKey(raw: string): Array<{ key: string; value: string }> {
  const parts = raw.split(":");
  const out: Array<{ key: string; value: string }> = [];
  for (let i = 0; i + 1 < parts.length; i += 2) {
    const key = parts[i] ?? "";
    const enc = parts[i + 1] ?? "";
    if (!key) continue;
    let value = enc;
    try {
      value = decodeURIComponent(enc.replace(/\+/g, " "));
    } catch {
      value = enc;
    }
    out.push({ key, value });
  }
  return out;
}

const SUBJECT_TOPIC_CTX_LABELS: Record<string, string> = {
  subject: "Subject",
  grade: "Grade",
  topic: "Topic",
  subtopic: "Subtopic",
  board: "Board",
  unit: "Unit",
  topicSlug: "Topic slug",
  level: "Level",
  section: "Section",
  unitLabel: "Unit label",
  chapterTitle: "Chapter",
};

function subjectTopicChatSnippet(body: string, max = 96): string {
  const t = body.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

function referClaimEarnedRdm(c: {
  challenge_key: string;
  win_claimed: boolean;
  share_claimed: boolean;
}, config: RdmConfigParams | null): number {
  const spec = referChallengeSpec(
    c.challenge_key as ReferClaimKey,
    config ?? DEFAULT_RDM_CONFIG
  );
  if (!spec) return 0;
  return (c.win_claimed ? spec.winRdm : 0) + (c.share_claimed ? spec.shareRdm : 0);
}

function fmtIsoOrDash(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

const LEARNING_MAP_PAGE_SIZES = [10, 25, 50] as const;
const MAGIC_WALL_PAGE_SIZES = [12, 24, 48] as const;
/** Paginate inferred play sessions (one sitting), not raw attempts—scales when attempt lists grow. */
const PLAY_SESSION_PAGE_SIZES = [8, 12, 15] as const;
const COMMUNITY_POST_PAGE_SIZES = [8, 12, 20] as const;
const COMMUNITY_COMMENT_PAGE_SIZES = [10, 15, 25] as const;

type CommunityPostThreadPayload = {
  postId: string;
  comments_total: number;
  comments_returned: number;
  comments_capped: boolean;
  votes_total: number;
  votes_returned: number;
  votes_capped: boolean;
  comments: Array<{
    id: string;
    user_id: string;
    parent_id: string | null;
    body: string;
    created_at: string;
    author_name: string | null;
  }>;
  votes: Array<{
    user_id: string;
    vote: number;
    created_at: string;
    author_name: string | null;
  }>;
};

type GyanDoubtInsightRow = StudentInsightsResponse["gyanDoubts"]["recent"][number];

function AdminGyanDoubtSheetInner({ d }: { d: GyanDoubtInsightRow }) {
  const aiAns = d.answers.filter((a) => a.kind === "ai");
  const teachAns = d.answers.filter((a) => a.kind === "teacher");
  const studAns = d.answers.filter((a) => a.kind === "student");

  const renderAnswerSection = (label: string, rows: GyanDoubtInsightRow["answers"]) => {
    if (rows.length === 0) return null;
    return (
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <ul className="space-y-2">
          {rows.map((a) => (
            <li
              key={a.id}
              className={cn(
                "rounded-lg border px-3 py-2.5",
                a.isAccepted
                  ? "border-emerald-500/50 bg-emerald-500/[0.06]"
                  : "border-border/60 bg-muted/20"
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {a.authorName ?? "Unknown"}
                </span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {a.kindLabel}
                </Badge>
                {a.isAccepted ? (
                  <Badge variant="secondary" className="text-[10px]">
                    Accepted
                  </Badge>
                ) : null}
                <span className="text-[10px] text-muted-foreground ml-auto tabular-nums">
                  {new Date(a.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mb-2 tabular-nums">
                Score ↑ {a.upvotes} · ↓ {a.downvotes}
              </p>
              <DoubtMarkdown content={a.body} className="text-sm leading-relaxed" />
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>Gyan++ doubt detail</SheetTitle>
        <SheetDescription className="space-y-1">
          <span className="block">{new Date(d.createdAt).toLocaleString()}</span>
          {d.curriculum ? (
            <span className="block font-medium text-foreground">
              {d.curriculum.chapter} · {d.curriculum.topic}
              {d.curriculum.subtopic ? ` · ${d.curriculum.subtopic}` : ""}
            </span>
          ) : (
            <span className="block font-medium text-foreground">{d.subject ?? "General"}</span>
          )}
          <span className="flex flex-wrap gap-2 pt-1">
            <Badge variant={d.isResolved ? "secondary" : "outline"}>
              {d.isResolved ? "Resolved" : "Open"}
            </Badge>
            <Badge variant="outline">{d.views} views</Badge>
            <Badge variant="outline" className="tabular-nums">
              ↑ {d.upvotes} · ↓ {d.downvotes}
            </Badge>
          </span>
        </SheetDescription>
      </SheetHeader>
      <div className="mt-6 space-y-6 text-sm">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Question title
          </p>
          <p className="text-base font-semibold leading-snug text-foreground">{d.title}</p>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Question details
          </p>
          {d.body?.trim() ? (
            <DoubtMarkdown content={d.body} className="text-sm leading-relaxed" />
          ) : (
            <p className="text-muted-foreground">No body text.</p>
          )}
        </div>
        {renderAnswerSection("AI answer", aiAns)}
        {renderAnswerSection("Teacher commentary", teachAns)}
        {renderAnswerSection("Student answers", studAns)}
        {d.answers.length === 0 ? (
          <p className="text-muted-foreground text-sm">No visible answers yet.</p>
        ) : null}
        <div className="rounded-lg border bg-muted/30 p-3 font-mono text-[10px] text-muted-foreground break-all">
          doubt_id: {d.id}
        </div>
      </div>
    </>
  );
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = params?.id;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [insightsError, setInsightsError] = useState("");
  const [headerCopied, setHeaderCopied] = useState<"email" | "userId" | null>(null);
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "learning-map"
    | "magic-wall"
    | "play"
    | "gyan"
    | "community"
    | "classroom"
    | "refer"
    | "chatbot"
    | "saved"
  >("overview");
  const [analytics, setAnalytics] = useState<AnalyticsResponse | null>(null);
  const [activity, setActivity] = useState<ActivityResponse["activity"]>([]);
  const [studentInsights, setStudentInsights] = useState<StudentInsightsResponse | null>(null);
  const [playAttemptDetail, setPlayAttemptDetail] = useState<
    StudentInsightsResponse["playArena"]["playHistoryRecent"][number] | null
  >(null);
  const [gyanDoubtDetail, setGyanDoubtDetail] = useState<GyanDoubtInsightRow | null>(null);
  const [learningMapPage, setLearningMapPage] = useState(0);
  const [learningMapPageSize, setLearningMapPageSize] =
    useState<(typeof LEARNING_MAP_PAGE_SIZES)[number]>(10);
  const [learningShowTelemetry, setLearningShowTelemetry] = useState(false);
  const [playSessionPage, setPlaySessionPage] = useState(0);
  const [playSessionPageSize, setPlaySessionPageSize] =
    useState<(typeof PLAY_SESSION_PAGE_SIZES)[number]>(12);
  const [playSessionDetail, setPlaySessionDetail] = useState<PlaySessionInsightRow | null>(null);
  const [communityQuery, setCommunityQuery] = useState("");
  const [communityPostPage, setCommunityPostPage] = useState(0);
  const [communityPostPageSize, setCommunityPostPageSize] =
    useState<(typeof COMMUNITY_POST_PAGE_SIZES)[number]>(12);
  const [communityCommentPage, setCommunityCommentPage] = useState(0);
  const [communityCommentPageSize, setCommunityCommentPageSize] =
    useState<(typeof COMMUNITY_COMMENT_PAGE_SIZES)[number]>(15);
  const [communityExpandedComments, setCommunityExpandedComments] = useState<
    Record<string, boolean>
  >({});
  const [communityCopiedKey, setCommunityCopiedKey] = useState<string | null>(null);
  const [selectedCommunityPostId, setSelectedCommunityPostId] = useState<string | null>(null);
  const [communityPostThread, setCommunityPostThread] = useState<{
    loading: boolean;
    error: string | null;
    data: CommunityPostThreadPayload | null;
  }>({ loading: false, error: null, data: null });
  const [selectedSubjectTopicContextKey, setSelectedSubjectTopicContextKey] = useState<string | null>(
    null
  );
  const [referClaimSheet, setReferClaimSheet] = useState<{
    claim_date: string;
    challenge_key: string;
  } | null>(null);
  const [referSessionLoad, setReferSessionLoad] = useState<{
    loading: boolean;
    error: string;
    data: ReferChallengeSessionApiResponse | null;
  }>({ loading: false, error: "", data: null });
  const [magicWallDetail, setMagicWallDetail] = useState<MagicWallBasketInsightRow | null>(null);
  const [magicWallPage, setMagicWallPage] = useState(0);
  const [magicWallPageSize, setMagicWallPageSize] =
    useState<(typeof MAGIC_WALL_PAGE_SIZES)[number]>(MAGIC_WALL_PAGE_SIZES[0]);
  const [adminStudyHeatmapWindow, setAdminStudyHeatmapWindow] = useState<7 | 30>(7);
  const [bitsAttemptFilterSubject, setBitsAttemptFilterSubject] = useState<
    "all" | "physics" | "chemistry" | "math"
  >("all");
  const [gyanDoubtsQuery, setGyanDoubtsQuery] = useState("");
  const [gyanDoubtsSubjectFilter, setGyanDoubtsSubjectFilter] = useState<
    "all" | "physics" | "chemistry" | "math" | "biology" | "general"
  >("all");
  const [gyanDoubtsStatusFilter, setGyanDoubtsStatusFilter] = useState<"all" | "open" | "resolved">(
    "all"
  );
  const [gyanDoubtsAnswerFilter, setGyanDoubtsAnswerFilter] = useState<
    "all" | "ai" | "teacher" | "student"
  >("all");
  const [savedQuery, setSavedQuery] = useState("");
  const [savedTypeFilter, setSavedTypeFilter] = useState<
    "all" | "bit" | "formula" | "instacue_card" | "revision_unit" | "community_post"
  >("all");
  const [savedDetail, setSavedDetail] = useState<SavedItemRow | null>(null);
  const [rdmConfig, setRdmConfig] = useState<RdmConfigParams | null>(null);

  useEffect(() => {
    fetchRdmConfig().then(setRdmConfig);
  }, []);

  type SeenState = {
    lastTab: typeof activeTab;
    seenAtByTab: Partial<Record<typeof activeTab, number>>;
  };

  const seenStateKey = useMemo(() => {
    if (!userId?.trim()) return null;
    return `admin:user-detail:seen:${userId.trim()}`;
  }, [userId]);

  const [seenState, setSeenState] = useState<SeenState>({
    lastTab: "overview",
    seenAtByTab: { overview: Date.now() },
  });

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError("");
    setInsightsError("");
    try {
      const { session } = await safeGetSession();
      if (!session?.access_token) throw new Error("Missing access token");

      const authHeaders = { Authorization: `Bearer ${session.access_token}` };

      const [aRes, actRes, insRes] = await Promise.all([
        fetch(`/api/admin/users/${userId}/analytics`, {
          headers: authHeaders,
          cache: "no-store",
        }),
        fetch(`/api/admin/users/${userId}/activity`, {
          headers: authHeaders,
          cache: "no-store",
        }),
        fetch(`/api/admin/users/${userId}/student-insights`, {
          headers: authHeaders,
          cache: "no-store",
        }),
      ]);

      const aBody = (await aRes.json()) as AnalyticsResponse & { error?: string };
      const actBody = (await actRes.json()) as ActivityResponse & { error?: string };
      if (!aRes.ok) throw new Error(aBody.error || "Failed to load analytics");
      if (!actRes.ok) throw new Error(actBody.error || "Failed to load activity");
      setAnalytics(aBody);
      setActivity(actBody.activity ?? []);

      const insBody = (await insRes.json()) as StudentInsightsResponse & { error?: string };
      if (!insRes.ok) {
        setStudentInsights(null);
        setInsightsError(insBody.error || "Failed to load student insights");
      } else {
        setStudentInsights(insBody);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!seenStateKey) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(seenStateKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<SeenState>;
      if (!parsed || typeof parsed !== "object") return;
      const lastTab = (parsed.lastTab ?? "overview") as SeenState["lastTab"];
      const seenAtByTab = (parsed.seenAtByTab ?? {}) as SeenState["seenAtByTab"];
      setSeenState({ lastTab, seenAtByTab });
      setActiveTab(lastTab);
    } catch {
      /* ignore */
    }
  }, [seenStateKey]);

  const persistSeenState = useCallback(
    (next: SeenState) => {
      if (!seenStateKey) return;
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(seenStateKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [seenStateKey]
  );

  useEffect(() => {
    if (!seenStateKey) return;
    const now = Date.now();
    setSeenState((prev) => {
      const next: SeenState = {
        lastTab: activeTab,
        seenAtByTab: { ...prev.seenAtByTab, [activeTab]: now },
      };
      persistSeenState(next);
      return next;
    });
  }, [activeTab, persistSeenState, seenStateKey]);

  const copyHeaderField = useCallback(async (kind: "email" | "userId", value: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value.trim());
      setHeaderCopied(kind);
      window.setTimeout(() => setHeaderCopied(null), 1200);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const savedMix = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: "Saved quizzes", value: analytics.metrics.savedBits },
      { name: "Formulas", value: analytics.metrics.savedFormulas },
      { name: "InstaCue", value: analytics.metrics.savedRevisionCards },
      { name: "Units", value: analytics.metrics.savedRevisionUnits },
    ];
  }, [analytics]);

  const checklistJson = useMemo(() => {
    if (!studentInsights?.profileLearning?.dailyChecklistState) return "";
    try {
      return JSON.stringify(studentInsights.profileLearning.dailyChecklistState, null, 2);
    } catch {
      return String(studentInsights.profileLearning.dailyChecklistState);
    }
  }, [studentInsights]);

  const subjectTopicChatThreads = useMemo(() => {
    const messages = studentInsights?.subjectTopicChat.messages ?? [];
    type Msg = (typeof messages)[number];
    const byKey = new Map<string, Msg[]>();
    for (const m of messages) {
      const list = byKey.get(m.contextKey) ?? [];
      list.push(m);
      byKey.set(m.contextKey, list);
    }
    const threads = [...byKey.entries()].map(([contextKey, thread]) => {
      const chronological = [...thread].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      const latestMs = Math.max(...thread.map((t) => new Date(t.createdAt).getTime()));
      const firstUser = chronological.find((m) => m.role === "user");
      const snippetSource =
        firstUser?.body ?? chronological[chronological.length - 1]?.body ?? "";
      return {
        contextKey,
        messages: chronological,
        latestAt: latestMs,
        snippet: subjectTopicChatSnippet(snippetSource),
      };
    });
    threads.sort((a, b) => b.latestAt - a.latestAt);
    return threads;
  }, [studentInsights?.subjectTopicChat.messages]);

  useEffect(() => {
    if (subjectTopicChatThreads.length === 0) {
      setSelectedSubjectTopicContextKey(null);
      return;
    }
    setSelectedSubjectTopicContextKey((prev) =>
      prev && subjectTopicChatThreads.some((t) => t.contextKey === prev)
        ? prev
        : subjectTopicChatThreads[0].contextKey
    );
  }, [subjectTopicChatThreads]);

  const selectedSubjectTopicThread = useMemo(
    () =>
      subjectTopicChatThreads.find((t) => t.contextKey === selectedSubjectTopicContextKey) ?? null,
    [subjectTopicChatThreads, selectedSubjectTopicContextKey]
  );

  /** Row counts per challenge_key in the admin snapshot (max 120 rows by newest claim_date). */
  const referEarnClaimsAggregate = useMemo(() => {
    const claims = studentInsights?.referEarn.claims ?? [];
    const counts = new Map<string, number>();
    for (const c of claims) {
      counts.set(c.challenge_key, (counts.get(c.challenge_key) ?? 0) + 1);
    }
    const distinctTierKeys = [...counts.keys()].sort();
    return { counts, distinctTierKeys };
  }, [studentInsights?.referEarn.claims]);

  const learningMapAllRows = studentInsights?.learningMap.rows ?? [];
  const learningMapTotal = learningMapAllRows.length;
  const learningMapTotalPages = Math.max(1, Math.ceil(learningMapTotal / learningMapPageSize));
  const learningMapPageClamped = Math.min(learningMapPage, Math.max(0, learningMapTotalPages - 1));
  const learningMapStart =
    learningMapTotal === 0 ? 0 : learningMapPageClamped * learningMapPageSize;
  const learningMapPageRows = learningMapAllRows.slice(
    learningMapStart,
    learningMapStart + learningMapPageSize
  );
  const learningMapEndExclusive = learningMapStart + learningMapPageRows.length;

  const magicWallAllItems = studentInsights?.magicWall.items ?? [];
  const magicWallTotal = magicWallAllItems.length;
  const magicWallTotalPages = Math.max(1, Math.ceil(magicWallTotal / magicWallPageSize));
  const magicWallPageClamped = Math.min(magicWallPage, Math.max(0, magicWallTotalPages - 1));
  const magicWallStart =
    magicWallTotal === 0 ? 0 : magicWallPageClamped * magicWallPageSize;
  const magicWallPageRows = magicWallAllItems.slice(
    magicWallStart,
    magicWallStart + magicWallPageSize
  );
  const magicWallEndExclusive = magicWallStart + magicWallPageRows.length;

  const magicWallFocusSummary = useMemo(() => {
    if (!studentInsights?.magicWall.items?.length) return null;
    const lmRows = studentInsights.learningMap.rows ?? [];
    const mw = studentInsights.magicWall.items[0];
    const learningMatches = learningRowsMatchingMagicWallItem(mw, lmRows);
    const dwell = sumLearningDwellMs(learningMatches);
    const nChat = chatMessagesMatchingMagicWallItem(
      mw,
      studentInsights.subjectTopicChat.messages
    ).length;
    const nDoubt = doubtsMatchingMagicWallItem(mw, studentInsights.gyanDoubts.recent).length;
    const nCommunity = communityPostsMatchingMagicWallItem(
      mw,
      studentInsights.community.posts
    ).length;
    return { mw, learningMatches, dwell, nChat, nDoubt, nCommunity };
  }, [studentInsights]);

  const latestActivityAnyMs = useMemo(() => {
    if (!studentInsights) return 0;
    const ms: number[] = [];
    ms.push(isoToMs(studentInsights.generatedAt));

    // Learning map (subtopic engagement updatedAt)
    for (const r of studentInsights.learningMap.rows ?? []) {
      ms.push(isoToMs(r.summary?.updatedAt));
      ms.push(isoToMs(r.summary?.lessonChecklistMarkedCompleteAt));
    }

    // Play attempts
    for (const a of studentInsights.playArena.playHistoryRecent ?? []) {
      ms.push(isoToMs(a.created_at));
    }

    // Chatbot messages
    for (const m of studentInsights.subjectTopicChat.messages ?? []) {
      ms.push(isoToMs(m.createdAt));
    }

    // Bits submissions in Performance slice
    for (const row of studentInsights.bitsQuiz?.attemptDetails ?? []) {
      ms.push(isoToMs(row.submittedAt));
    }

    // Study day totals updated
    for (const d of studentInsights.studyDays?.days ?? []) {
      ms.push(isoToMs(d.updated_at));
    }

    // Community posts/comments (already loaded subset)
    for (const p of studentInsights.community.posts ?? []) {
      ms.push(isoToMs(p.updatedAt));
      ms.push(isoToMs(p.createdAt));
    }
    for (const c of studentInsights.community.comments ?? []) {
      ms.push(isoToMs(c.createdAt));
    }

    // Gyan++ doubts (loaded subset)
    for (const d of studentInsights.gyanDoubts.recent ?? []) {
      ms.push(isoToMs(d.createdAt));
      for (const a of d.answers ?? []) ms.push(isoToMs(a.createdAt));
    }

    return Math.max(0, ...ms);
  }, [studentInsights]);

  type LastSeenSignal =
    | {
        kind:
          | "lesson_focus_timer"
          | "learning_map_update"
          | "bits_quiz_submit"
          | "play_attempt"
          | "topic_chat"
          | "magic_wall"
          | "community"
          | "gyan_doubt"
          | "classroom_task";
        atMs: number;
        title: string;
        subtitle?: string;
        tab: (typeof activeTab);
      }
    | null;

  const lastSeenSignal: LastSeenSignal = useMemo(() => {
    if (!studentInsights?.isStudent) return null;

    const candidates: Exclude<LastSeenSignal, null>[] = [];
    const push = (
      kind: Exclude<LastSeenSignal, null>["kind"],
      atIso: string | null | undefined,
      title: string,
      tab: (typeof activeTab),
      subtitle?: string
    ) => {
      const atMs = isoToMs(atIso);
      if (!atMs) return;
      candidates.push({ kind, atMs, title, tab, subtitle });
    };

    const lmRows = studentInsights.learningMap.rows ?? [];
    // Highest-confidence "present" signal: focus timer currently running on a lesson page.
    const running = lmRows
      .filter((r) => Boolean(r.summary?.lessonFocusTimer?.running))
      .sort((a, b) => isoToMs(b.summary?.updatedAt) - isoToMs(a.summary?.updatedAt))[0];
    if (running?.summary?.updatedAt) {
      const sec = running.summary.lessonFocusTimer?.secondsRemaining ?? null;
      const secLabel = typeof sec === "number" ? `${Math.max(0, Math.round(sec))}s remaining` : "";
      push(
        "lesson_focus_timer",
        running.summary.updatedAt,
        "Currently in lesson focus timer",
        "learning-map",
        [running.subject, `Class ${running.classLevel ?? "—"}`, running.topic, running.subtopicName, running.level]
          .filter(Boolean)
          .join(" · ") + (secLabel ? ` · ${secLabel}` : "")
      );
    }

    // Learning map "last touched subtopic"
    const latestLm = lmRows
      .slice()
      .sort((a, b) => isoToMs(b.summary?.updatedAt) - isoToMs(a.summary?.updatedAt))[0];
    if (latestLm?.summary?.updatedAt) {
      push(
        "learning_map_update",
        latestLm.summary.updatedAt,
        "Last lesson/subtopic activity",
        "learning-map",
        [latestLm.subject, `Class ${latestLm.classLevel ?? "—"}`, latestLm.topic, latestLm.subtopicName, latestLm.level]
          .filter(Boolean)
          .join(" · ")
      );
    }

    // Bits quiz submission rows (if present)
    const bitsRows = studentInsights.bitsQuiz?.attemptDetails ?? [];
    const latestBits = bitsRows
      .slice()
      .sort((a, b) => isoToMs(b.submittedAt) - isoToMs(a.submittedAt))[0];
    if (latestBits?.submittedAt) {
      push(
        "bits_quiz_submit",
        latestBits.submittedAt,
        "Submitted a topic quiz",
        "learning-map",
        latestBits.topic
          ? `Topic: ${latestBits.topic}${latestBits.subject ? ` · ${latestBits.subject}` : ""}`
          : undefined
      );
    }

    // Play attempt (arena/play)
    const play = studentInsights.playArena.playHistoryRecent ?? [];
    const latestPlay = play.slice().sort((a, b) => isoToMs(b.created_at) - isoToMs(a.created_at))[0];
    if (latestPlay?.created_at) {
      const label = latestPlay.session_label?.trim();
      push(
        "play_attempt",
        latestPlay.created_at,
        "Answered a Play question",
        "play",
        [
          label ? `Mode: ${label}` : null,
          latestPlay.is_correct ? "Correct" : "Wrong",
          typeof latestPlay.time_taken_ms === "number" ? `${latestPlay.time_taken_ms}ms` : null,
        ]
          .filter(Boolean)
          .join(" · ")
      );
    }

    // Subject topic chat (AI tutor)
    const chat = studentInsights.subjectTopicChat.messages ?? [];
    const latestChat = chat.slice().sort((a, b) => isoToMs(b.createdAt) - isoToMs(a.createdAt))[0];
    if (latestChat?.createdAt) {
      push(
        "topic_chat",
        latestChat.createdAt,
        "Messaged the AI tutor (topic chat)",
        "chatbot",
        latestChat.contextKey ? `contextKey: ${latestChat.contextKey}` : undefined
      );
    }

    // Magic Wall basket row activity
    const mw = studentInsights.magicWall.items?.[0];
    if (mw?.updated_at) {
      push(
        "magic_wall",
        mw.updated_at,
        "Touched Magic Wall topic",
        "magic-wall",
        [mw.subject, `Class ${mw.class_level}`, mw.topic_name].filter(Boolean).join(" · ")
      );
    }

    // Classroom tasks (completed events only)
    const tasks = studentInsights.classroomTasks.rows ?? [];
    const latestTask = tasks
      .slice()
      .sort((a, b) => isoToMs(b.completedAt) - isoToMs(a.completedAt))[0];
    if (latestTask?.completedAt) {
      push(
        "classroom_task",
        latestTask.completedAt,
        "Completed a classroom task",
        "classroom",
        latestTask.postTitle ?? latestTask.postId ?? undefined
      );
    }

    // Community posts/comments
    const posts = studentInsights.community.posts ?? [];
    const latestPost = posts
      .slice()
      .sort((a, b) => Math.max(isoToMs(b.updatedAt), isoToMs(b.createdAt)) - Math.max(isoToMs(a.updatedAt), isoToMs(a.createdAt)))[0];
    if (latestPost?.updatedAt || latestPost?.createdAt) {
      const at = latestPost.updatedAt || latestPost.createdAt;
      push(
        "community",
        at,
        "Community activity",
        "community",
        latestPost.title ? `Post: ${latestPost.title}` : undefined
      );
    }

    // Gyan++ doubts
    const doubts = studentInsights.gyanDoubts.recent ?? [];
    const latestDoubt = doubts
      .slice()
      .sort((a, b) => isoToMs(b.createdAt) - isoToMs(a.createdAt))[0];
    if (latestDoubt?.createdAt) {
      push(
        "gyan_doubt",
        latestDoubt.createdAt,
        "Created a doubt (Gyan++)",
        "gyan",
        latestDoubt.title ? `“${latestDoubt.title}”` : undefined
      );
    }

    if (candidates.length === 0) return null;
    candidates.sort((a, b) => b.atMs - a.atMs);
    return candidates[0];
  }, [studentInsights]);

  useEffect(() => {
    setLearningMapPage((p) => Math.min(p, Math.max(0, learningMapTotalPages - 1)));
  }, [learningMapTotalPages]);

  useEffect(() => {
    setMagicWallPage((p) => Math.min(p, Math.max(0, magicWallTotalPages - 1)));
  }, [magicWallTotalPages]);

  useEffect(() => {
    setLearningMapPage(0);
    setLearningMapPageSize(10);
    setMagicWallPage(0);
    setMagicWallPageSize(MAGIC_WALL_PAGE_SIZES[0]);
    setMagicWallDetail(null);
  }, [userId]);

  useEffect(() => {
    setPlaySessionPage(0);
    setPlaySessionPageSize(12);
    setPlaySessionDetail(null);
    setPlayAttemptDetail(null);
  }, [userId]);

  useEffect(() => {
    setGyanDoubtsQuery("");
    setGyanDoubtsSubjectFilter("all");
    setGyanDoubtsStatusFilter("all");
    setGyanDoubtsAnswerFilter("all");
    setSavedQuery("");
    setSavedTypeFilter("all");
    setSavedDetail(null);
    setCommunityQuery("");
    setCommunityPostPage(0);
    setCommunityPostPageSize(12);
    setCommunityCommentPage(0);
    setCommunityCommentPageSize(15);
    setCommunityExpandedComments({});
    setCommunityCopiedKey(null);
    setSelectedCommunityPostId(null);
    setCommunityPostThread({ loading: false, error: null, data: null });
    setSelectedSubjectTopicContextKey(null);
    setReferClaimSheet(null);
    setReferSessionLoad({ loading: false, error: "", data: null });
  }, [userId]);

  useEffect(() => {
    setCommunityPostPage(0);
    setCommunityCommentPage(0);
  }, [communityQuery]);

  const playHistoryAllRows = useMemo(
    () => studentInsights?.playArena.playHistoryRecent ?? [],
    [studentInsights?.playArena.playHistoryRecent]
  );
  const playHistoryLoadedCount = playHistoryAllRows.length;
  const playHistoryDbTotal = studentInsights?.playArena.playHistoryTotal ?? 0;
  const playSessionsInferenceNote =
    studentInsights?.playArena.playSessionsInferenceNote ?? PLAY_SESSION_INFERENCE_NOTE;

  const playSessionsAll = useMemo((): AdminPlaySessionRow[] => {
    const rows = playHistoryAllRows;
    const byId = new Map(rows.map((r) => [r.id, r]));
    const fromApi = studentInsights?.playArena.playSessions;
    if (Array.isArray(fromApi) && fromApi.length > 0) {
      return fromApi.map((s) => ({
        ...s,
        attempts: s.attemptIds
          .map((id) => byId.get(id))
          .filter((x): x is PlayAttemptRow => x != null),
      }));
    }
    return buildPlaySessionsFromAttempts(rows).map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      attemptCount: s.attemptCount,
      correctCount: s.correctCount,
      wrongCount: s.wrongCount,
      distinctPoolKeys: s.distinctPoolKeys,
      attemptIds: s.attempts.map((a) => a.id),
      attempts: s.attempts,
    }));
  }, [studentInsights?.playArena.playSessions, playHistoryAllRows]);

  const playSessionLoadedCount = playSessionsAll.length;
  const playSessionTotalPages = Math.max(
    1,
    Math.ceil(playSessionLoadedCount / playSessionPageSize)
  );
  const playSessionPageClamped = Math.min(playSessionPage, Math.max(0, playSessionTotalPages - 1));
  const playSessionStart =
    playSessionLoadedCount === 0 ? 0 : playSessionPageClamped * playSessionPageSize;
  const playSessionPageRows = playSessionsAll.slice(
    playSessionStart,
    playSessionStart + playSessionPageSize
  );
  const playSessionEndExclusive = playSessionStart + playSessionPageRows.length;

  const gyanFilteredDoubts = useMemo(() => {
    const rows = studentInsights?.gyanDoubts.recent ?? [];
    if (rows.length === 0) return [];

    const q = normalizeMwSearchToken(gyanDoubtsQuery);
    const subj = gyanDoubtsSubjectFilter;
    const status = gyanDoubtsStatusFilter;
    const ans = gyanDoubtsAnswerFilter;

    return rows.filter((d) => {
      if (subj !== "all") {
        if (subj === "general") {
          if (d.subject != null && d.subject.trim()) return false;
        } else if ((d.subject ?? "").toLowerCase().trim() !== subj) {
          return false;
        }
      }

      if (status !== "all") {
        if (status === "open" && d.isResolved) return false;
        if (status === "resolved" && !d.isResolved) return false;
      }

      if (ans !== "all") {
        if (!d.answers.some((a) => a.kind === ans)) return false;
      }

      if (q) {
        const title = normalizeMwSearchToken(d.title);
        const body = normalizeMwSearchToken(d.body);
        const preview = normalizeMwSearchToken(d.listPreview ?? "");
        const subjBlob = normalizeMwSearchToken(d.subject ?? "");
        const blob = `${title} ${preview} ${body} ${subjBlob}`;
        if (!blob.includes(q)) return false;
      }

      return true;
    });
  }, [
    gyanDoubtsAnswerFilter,
    gyanDoubtsQuery,
    gyanDoubtsStatusFilter,
    gyanDoubtsSubjectFilter,
    studentInsights?.gyanDoubts.recent,
  ]);

  const savedRows = useMemo((): SavedItemRow[] => {
    const saved = studentInsights?.savedContent;
    if (!saved) return [];

    const out: SavedItemRow[] = [];
    for (const b of saved.savedBits ?? []) {
      out.push({
        kind: "bit",
        id: b.id,
        subjectLabel: adminSubjectLabel(b.subject),
        classLevel: typeof b.classLevel === "number" ? b.classLevel : null,
        title: b.question || "—",
        subtitle: `${b.topic}${b.subtopicName ? ` · ${b.subtopicName}` : ""}`,
        savedAt: null,
        raw: b,
      });
    }
    for (const f of saved.savedFormulas ?? []) {
      out.push({
        kind: "formula",
        id: f.id,
        subjectLabel: adminSubjectLabel(f.subject),
        classLevel: typeof f.classLevel === "number" ? f.classLevel : null,
        title: f.name || "—",
        subtitle: `${f.topic}${f.subtopicName ? ` · ${f.subtopicName}` : ""} · ${f.bitsQuestions.length} Qs`,
        savedAt: null,
        raw: f,
      });
    }
    for (const c of saved.savedRevisionCards ?? []) {
      out.push({
        kind: "instacue_card",
        id: c.id,
        subjectLabel: adminSubjectLabel(c.subject),
        classLevel: typeof c.classLevel === "number" ? c.classLevel : null,
        title: c.frontContent || "—",
        subtitle: `${c.topic}${c.subtopicName ? ` · ${c.subtopicName}` : ""}${c.type ? ` · ${c.type}` : ""}`,
        savedAt: c.savedAt ?? null,
        raw: c,
      });
    }
    for (const u of saved.savedRevisionUnits ?? []) {
      out.push({
        kind: "revision_unit",
        id: u.id,
        subjectLabel: adminSubjectLabel(u.subject),
        classLevel: typeof u.classLevel === "number" ? u.classLevel : null,
        title: u.sectionTitle || "—",
        subtitle: `${u.unitName}${u.subtopicName ? ` · ${u.subtopicName}` : ""} · ${u.level}`,
        savedAt: null,
        raw: u,
      });
    }
    for (const p of saved.savedCommunityPosts ?? []) {
      out.push({
        kind: "community_post",
        id: p.id,
        subjectLabel: adminSubjectLabel(p.subject ?? "General"),
        classLevel: null,
        title: p.title || "—",
        subtitle: p.postId ? `postId: ${p.postId}` : "",
        savedAt: p.savedAt ?? null,
        raw: p,
      });
    }

    return out;
  }, [studentInsights?.savedContent]);

  const savedFilteredRows = useMemo(() => {
    const q = normalizeMwSearchToken(savedQuery);
    return savedRows.filter((r) => {
      if (savedTypeFilter !== "all" && r.kind !== savedTypeFilter) return false;
      if (!q) return true;
      const blob = normalizeMwSearchToken(`${r.title} ${r.subtitle} ${r.subjectLabel}`);
      return blob.includes(q);
    });
  }, [savedQuery, savedRows, savedTypeFilter]);

  const savedTotalCountFromProfile = useMemo(() => {
    if (!studentInsights) return 0;
    return (
      (studentInsights.profileLearning.savedBitsCount ?? 0) +
      (studentInsights.profileLearning.savedFormulasCount ?? 0) +
      (studentInsights.profileLearning.savedRevisionCardsCount ?? 0) +
      (studentInsights.profileLearning.savedRevisionUnitsCount ?? 0) +
      (studentInsights.profileLearning.savedCommunityPostsCount ?? 0)
    );
  }, [studentInsights]);

  const newCounts = useMemo(() => {
    const now = Date.now();
    const seen = seenState.seenAtByTab ?? {};
    const since = (tab: typeof activeTab) => seen[tab] ?? 0;
    const after = (iso: string | null | undefined, tab: typeof activeTab) =>
      isoToMs(iso) > since(tab);

    const learning = (studentInsights?.learningMap.rows ?? []).filter((r) =>
      after(r.summary?.updatedAt, "learning-map")
    ).length;

    const magic = (studentInsights?.magicWall.items ?? []).filter((r) =>
      after(r.updated_at, "magic-wall")
    ).length;

    const play = (studentInsights?.playArena.playSessions ?? []).filter((s) =>
      after(s.endedAt ?? s.startedAt, "play")
    ).length;

    const doubts = (studentInsights?.gyanDoubts.recent ?? []).filter((d) => {
      if (after(d.createdAt, "gyan")) return true;
      return (d.answers ?? []).some((a) => after(a.createdAt, "gyan"));
    }).length;

    const community = (studentInsights?.community.posts ?? []).filter((p) => {
      const t = isoToMs(p.updatedAt) || isoToMs(p.createdAt);
      return t > since("community");
    }).length;

    const classroom = (studentInsights?.classroomTasks.rows ?? []).filter((r) =>
      after(r.completedAt, "classroom")
    ).length;

    const refer = (studentInsights?.referEarn.claims ?? []).filter((c) =>
      after(c.updated_at, "refer")
    ).length;

    const chat = (studentInsights?.subjectTopicChat.messages ?? []).filter((m) =>
      after(m.createdAt, "chatbot")
    ).length;

    const saved = savedRows.filter((r) => after(r.savedAt, "saved")).length;

    // overview: use the inferred “any activity” timestamp
    const overview = latestActivityAnyMs > since("overview") ? 1 : 0;

    // guard against NaN/negative
    const clamp = (n: number) => (Number.isFinite(n) ? Math.max(0, n) : 0);
    return {
      overview: clamp(overview),
      learning: clamp(learning),
      magic: clamp(magic),
      play: clamp(play),
      doubts: clamp(doubts),
      community: clamp(community),
      classroom: clamp(classroom),
      refer: clamp(refer),
      chat: clamp(chat),
      saved: clamp(saved),
      _now: now,
    };
  }, [latestActivityAnyMs, savedRows, seenState.seenAtByTab, studentInsights]);

  useEffect(() => {
    setPlaySessionPage((p) => Math.min(p, Math.max(0, playSessionTotalPages - 1)));
  }, [playSessionTotalPages]);

  const communityPostsRaw = useMemo(
    () => studentInsights?.community.posts ?? [],
    [studentInsights?.community.posts]
  );
  const communityCommentsRaw = useMemo(
    () => studentInsights?.community.comments ?? [],
    [studentInsights?.community.comments]
  );
  const communityTotals = studentInsights?.community.totals;

  const communityPostTitleById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of communityPostsRaw) {
      m.set(p.id, p.title.replace(/\s+/g, " ").trim());
    }
    return m;
  }, [communityPostsRaw]);

  const filteredCommunityPosts = useMemo(() => {
    const q = communityQuery.trim().toLowerCase();
    if (!q) return communityPostsRaw;
    return communityPostsRaw.filter((p) => {
      const blob = [
        p.title,
        p.content,
        p.kind,
        p.subject ?? "",
        p.sourceType ?? "",
        p.topicRef ?? "",
        p.subtopicRef ?? "",
        p.boardRef ?? "",
        p.gradeRef ?? "",
        (p.tags ?? []).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [communityPostsRaw, communityQuery]);

  const filteredCommunityComments = useMemo(() => {
    const q = communityQuery.trim().toLowerCase();
    if (!q) return communityCommentsRaw;
    return communityCommentsRaw.filter((c) => {
      const title = communityPostTitleById.get(c.postId) ?? "";
      return [c.body, c.postId, title].join(" ").toLowerCase().includes(q);
    });
  }, [communityCommentsRaw, communityQuery, communityPostTitleById]);

  const communityPostTotalPages = Math.max(
    1,
    Math.ceil(filteredCommunityPosts.length / communityPostPageSize)
  );
  const communityPostPageClamped = Math.min(
    communityPostPage,
    Math.max(0, communityPostTotalPages - 1)
  );
  const communityPostStart =
    filteredCommunityPosts.length === 0 ? 0 : communityPostPageClamped * communityPostPageSize;
  const communityPostPageRows = filteredCommunityPosts.slice(
    communityPostStart,
    communityPostStart + communityPostPageSize
  );
  const communityPostEndExclusive = communityPostStart + communityPostPageRows.length;

  const communityCommentTotalPages = Math.max(
    1,
    Math.ceil(filteredCommunityComments.length / communityCommentPageSize)
  );
  const communityCommentPageClamped = Math.min(
    communityCommentPage,
    Math.max(0, communityCommentTotalPages - 1)
  );
  const communityCommentStart =
    filteredCommunityComments.length === 0
      ? 0
      : communityCommentPageClamped * communityCommentPageSize;
  const communityCommentPageRows = filteredCommunityComments.slice(
    communityCommentStart,
    communityCommentStart + communityCommentPageSize
  );
  const communityCommentEndExclusive = communityCommentStart + communityCommentPageRows.length;

  const selectedCommunityPost = useMemo(() => {
    if (!selectedCommunityPostId) return null;
    return filteredCommunityPosts.find((p) => p.id === selectedCommunityPostId) ?? null;
  }, [filteredCommunityPosts, selectedCommunityPostId]);

  useEffect(() => {
    if (filteredCommunityPosts.length === 0) {
      setSelectedCommunityPostId(null);
      return;
    }
    setSelectedCommunityPostId((prev) =>
      prev && filteredCommunityPosts.some((p) => p.id === prev)
        ? prev
        : filteredCommunityPosts[0].id
    );
  }, [filteredCommunityPosts]);

  useEffect(() => {
    if (!selectedCommunityPostId) {
      setCommunityPostThread({ loading: false, error: null, data: null });
      return;
    }

    const ac = new AbortController();
    let cancelled = false;

    void (async () => {
      setCommunityPostThread({ loading: true, error: null, data: null });
      try {
        const { session } = await safeGetSession();
        if (!session?.access_token) {
          if (!cancelled) {
            setCommunityPostThread({ loading: false, error: "Missing access token", data: null });
          }
          return;
        }
        const res = await fetch(
          `/api/admin/community/posts/${encodeURIComponent(selectedCommunityPostId)}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store",
            signal: ac.signal,
          }
        );
        const body = (await res.json()) as CommunityPostThreadPayload & { error?: string };
        if (!res.ok) {
          if (!cancelled) {
            setCommunityPostThread({
              loading: false,
              error: body.error ?? `Request failed (${res.status})`,
              data: null,
            });
          }
          return;
        }
        if (!cancelled) setCommunityPostThread({ loading: false, error: null, data: body });
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        const msg = e instanceof Error ? e.message : "Unknown error";
        if (!cancelled) setCommunityPostThread({ loading: false, error: msg, data: null });
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [selectedCommunityPostId]);

  useEffect(() => {
    if (!userId?.trim() || !referClaimSheet) {
      setReferSessionLoad({ loading: false, error: "", data: null });
      return;
    }

    const ac = new AbortController();
    let cancelled = false;
    const { claim_date, challenge_key } = referClaimSheet;

    void (async () => {
      setReferSessionLoad({ loading: true, error: "", data: null });
      try {
        const { session } = await safeGetSession();
        if (!session?.access_token) {
          if (!cancelled) {
            setReferSessionLoad({ loading: false, error: "Missing access token", data: null });
          }
          return;
        }
        const qs = new URLSearchParams({ claim_date, challenge_key });
        const res = await fetch(
          `/api/admin/users/${encodeURIComponent(userId)}/refer-challenge-session?${qs.toString()}`,
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
            cache: "no-store",
            signal: ac.signal,
          }
        );
        const body = (await res.json()) as ReferChallengeSessionApiResponse & { error?: string };
        if (!res.ok) {
          if (!cancelled) {
            setReferSessionLoad({
              loading: false,
              error: body.error ?? `Request failed (${res.status})`,
              data: null,
            });
          }
          return;
        }
        if (!cancelled) setReferSessionLoad({ loading: false, error: "", data: body });
      } catch (e) {
        if (cancelled || (e instanceof DOMException && e.name === "AbortError")) return;
        const msg = e instanceof Error ? e.message : "Unknown error";
        if (!cancelled) setReferSessionLoad({ loading: false, error: msg, data: null });
      }
    })();

    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [userId, referClaimSheet]);

  const openReferClaimDetail = useCallback(
    (c: StudentInsightsResponse["referEarn"]["claims"][number]) => {
      setReferSessionLoad({ loading: true, error: "", data: null });
      setReferClaimSheet({ claim_date: c.claim_date, challenge_key: c.challenge_key });
    },
    []
  );

  useEffect(() => {
    setCommunityPostPage((p) => Math.min(p, Math.max(0, communityPostTotalPages - 1)));
  }, [communityPostTotalPages]);

  useEffect(() => {
    setCommunityCommentPage((p) => Math.min(p, Math.max(0, communityCommentTotalPages - 1)));
  }, [communityCommentTotalPages]);

  const copyCommunity = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCommunityCopiedKey(key);
      window.setTimeout(() => setCommunityCopiedKey(null), 1400);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card/70 px-4 py-4 shadow-sm sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Admin console · User profile
            </p>
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="min-w-0 text-xl font-semibold tracking-tight sm:text-2xl">
                {analytics?.user.name?.trim() || "User"}
              </h1>
              {analytics?.user.status ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "capitalize",
                    analytics.user.status === "active" && "border-emerald-500/35 text-emerald-700 dark:text-emerald-400",
                    analytics.user.status === "suspended" && "border-amber-500/35 text-amber-700 dark:text-amber-400",
                    analytics.user.status === "banned" && "border-rose-500/35 text-rose-700 dark:text-rose-400",
                    analytics.user.status === "soft_deleted" && "border-muted-foreground/35 text-muted-foreground"
                  )}
                >
                  {analytics.user.status}
                </Badge>
              ) : null}
              <Badge variant="secondary" className="capitalize">
                {analytics?.user.role || "unknown"}
              </Badge>
              {studentInsights?.isStudent ? (
                <Badge variant="outline" className="text-[10px]">
                  student signals
                </Badge>
              ) : null}
            </div>

            <div className="mt-1 flex min-w-0 flex-col gap-1.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-3">
              <span className="min-w-0 truncate">
                Email:{" "}
                <span className="font-medium text-foreground">
                  {analytics?.user.email?.trim() || "—"}
                </span>
              </span>
              <span className="hidden text-muted-foreground/60 sm:inline">•</span>
              <span className="tabular-nums">
                Last sign-in:{" "}
                <span className="text-foreground">
                  {analytics?.user.lastSignInAt
                    ? new Date(analytics.user.lastSignInAt).toLocaleString()
                    : "—"}
                </span>
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                disabled={!analytics?.user.email?.trim()}
                onClick={() => void copyHeaderField("email", analytics?.user.email ?? "")}
              >
                <Copy className="h-3.5 w-3.5 shrink-0" />
                {headerCopied === "email" ? "Copied email" : "Copy email"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                disabled={!analytics?.user.id?.trim()}
                onClick={() => void copyHeaderField("userId", analytics?.user.id ?? "")}
              >
                <Copy className="h-3.5 w-3.5 shrink-0" />
                {headerCopied === "userId" ? "Copied id" : "Copy user id"}
              </Button>
              <Button variant="outline" size="sm" asChild className="h-8">
                <Link href="/admin/users">Back to users</Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => void load()} disabled={loading}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Loading user analytics...</p> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {analytics ? (
        <>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="w-full">
            <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1 bg-muted/80 p-1">
              <TabsTrigger value="overview" className="text-xs sm:text-sm">
                Overview{" "}
                {newCounts.overview > 0 ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] tabular-nums">
                    {newCounts.overview}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="learning-map" className="text-xs sm:text-sm">
                Learning{" "}
                {newCounts.learning > 0 ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] tabular-nums">
                    {newCounts.learning}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="magic-wall" className="text-xs sm:text-sm">
                Magic Wall{" "}
                {newCounts.magic > 0 ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] tabular-nums">
                    {newCounts.magic}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="play" className="text-xs sm:text-sm">
                Play{" "}
                {newCounts.play > 0 ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] tabular-nums">
                    {newCounts.play}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="gyan" className="text-xs sm:text-sm">
                Doubts{" "}
                {newCounts.doubts > 0 ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] tabular-nums">
                    {newCounts.doubts}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="community" className="text-xs sm:text-sm">
                Community{" "}
                {newCounts.community > 0 ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] tabular-nums">
                    {newCounts.community}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="classroom" className="text-xs sm:text-sm">
                Classroom{" "}
                {newCounts.classroom > 0 ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] tabular-nums">
                    {newCounts.classroom}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="refer" className="text-xs sm:text-sm">
                Refer{" "}
                {newCounts.refer > 0 ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] tabular-nums">
                    {newCounts.refer}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="chatbot" className="text-xs sm:text-sm">
                Chat{" "}
                {newCounts.chat > 0 ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] tabular-nums">
                    {newCounts.chat}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger value="saved" className="text-xs sm:text-sm">
                Saved{" "}
                {newCounts.saved > 0 ? (
                  <Badge variant="secondary" className="ml-1.5 text-[10px] tabular-nums">
                    {newCounts.saved}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            <Card className="border-border/70 bg-muted/[0.06]">
              <CardHeader className="space-y-1 pb-3">
                <CardTitle className="text-base">Admin summary (fast read)</CardTitle>
                <CardDescription className="text-xs leading-relaxed sm:text-sm">
                  Start here. Use the tabs for deep drill-down (Learning map, Magic Wall, Play sessions, Doubts, etc.).
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm lg:grid-cols-3">
                <section className="rounded-xl border border-border/60 bg-card/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Account
                  </p>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">Status</span>
                      <span className="font-semibold capitalize text-foreground">{analytics.user.status}</span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">Role</span>
                      <span className="font-medium text-foreground">{analytics.user.role || "unknown"}</span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">Last sign-in</span>
                      <span className="tabular-nums text-foreground">
                        {analytics.user.lastSignInAt ? new Date(analytics.user.lastSignInAt).toLocaleString() : "—"}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">User id</span>
                      <span className="font-mono text-[10px] text-muted-foreground break-all">{analytics.user.id}</span>
                    </div>
                  </div>
                </section>

                <section className="rounded-xl border border-border/60 bg-card/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Last seen (best-effort)
                  </p>
                  <div className="mt-2 space-y-2 text-xs">
                    {!studentInsights?.isStudent ? (
                      <p className="text-muted-foreground">Not a student account (no learning signals).</p>
                    ) : (
                      <>
                        <p className="text-[11px] text-muted-foreground">
                          Latest activity anywhere:{" "}
                          <span className="font-semibold text-foreground tabular-nums">
                            {latestActivityAnyMs ? new Date(latestActivityAnyMs).toLocaleString() : "—"}
                          </span>
                        </p>
                        {lastSeenSignal ? (
                          <div className="rounded-lg border border-border/70 bg-muted/20 p-2">
                            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Best guess: what they did last
                            </p>
                            <p className="mt-1 text-xs font-semibold text-foreground">
                              {lastSeenSignal.title}
                            </p>
                            {lastSeenSignal.subtitle ? (
                              <p className="mt-1 text-[11px] leading-snug text-muted-foreground break-words">
                                {lastSeenSignal.subtitle}
                              </p>
                            ) : null}
                            <div className="mt-2 flex flex-wrap gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => setActiveTab(lastSeenSignal.tab)}
                              >
                                Open {lastSeenSignal.tab === "learning-map"
                                  ? "Learning"
                                  : lastSeenSignal.tab === "gyan"
                                    ? "Doubts"
                                    : lastSeenSignal.tab === "chatbot"
                                      ? "Chat"
                                        : lastSeenSignal.tab === "play"
                                          ? "Play"
                                          : lastSeenSignal.tab}
                              </Button>
                            </div>
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-border/60 bg-card/50 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Usage snapshot (lifetime)
                  </p>
                  <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-1">
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">Total RDM</span>
                      <span className="font-semibold tabular-nums text-foreground">
                        {analytics.metrics.rdm.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">AI calls</span>
                      <span className="font-semibold tabular-nums text-foreground">{analytics.metrics.aiCalls}</span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">Saved (quizzes)</span>
                      <span className="tabular-nums text-foreground">{analytics.metrics.savedBits}</span>
                    </div>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span className="text-muted-foreground">Doubts (created)</span>
                      <span className="tabular-nums text-foreground">{analytics.metrics.doubtsCreated}</span>
                    </div>
                  </div>
                </section>
              </CardContent>
            </Card>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Card size="sm">
                <CardHeader className="pb-2">
                  <CardDescription>Name</CardDescription>
                  <CardTitle>{analytics.user.name || "—"}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader className="pb-2">
                  <CardDescription>Email</CardDescription>
                  <CardTitle className="text-base">{analytics.user.email || "—"}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader className="pb-2">
                  <CardDescription>Status</CardDescription>
                  <CardTitle className="capitalize">{analytics.user.status}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader className="pb-2">
                  <CardDescription>Role</CardDescription>
                  <CardTitle>{analytics.user.role || "unknown"}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            <div className="flex flex-wrap items-end justify-between gap-2 pt-2">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold text-foreground">Performance &amp; activity</h2>
                <p className="text-xs text-muted-foreground">
                  High-level charts for usage. For learning progress, use <span className="font-medium text-foreground">Learning map</span> and{" "}
                  <span className="font-medium text-foreground">Magic Wall</span>.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild className="h-8">
                  <Link href="/admin/dashboard">Admin dashboard</Link>
                </Button>
                <Button variant="outline" size="sm" asChild className="h-8">
                  <Link href="/performance">Performance page</Link>
                </Button>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>AI Token Activity</CardTitle>
                  <CardDescription>Monthly token usage footprint</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.series.aiTokensByMonth}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area
                        type="monotone"
                        dataKey="tokens"
                        stroke="#6366f1"
                        fill="#6366f133"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Saved Content Mix</CardTitle>
                  <CardDescription>User revision behavior composition</CardDescription>
                </CardHeader>
                <CardContent className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={savedMix}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={95}
                        innerRadius={45}
                      >
                        {savedMix.map((entry, index) => (
                          <Cell
                            key={`${entry.name}-${index}`}
                            fill={PIE_COLORS[index % PIE_COLORS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Card size="sm">
                <CardHeader className="pb-2">
                  <CardDescription>Doubts Created</CardDescription>
                  <CardTitle>{analytics.metrics.doubtsCreated}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader className="pb-2">
                  <CardDescription>Doubts Resolved</CardDescription>
                  <CardTitle>{analytics.metrics.doubtsResolved}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader className="pb-2">
                  <CardDescription>AI Calls</CardDescription>
                  <CardTitle>{analytics.metrics.aiCalls}</CardTitle>
                </CardHeader>
              </Card>
              <Card size="sm">
                <CardHeader className="pb-2">
                  <CardDescription>Total RDM</CardDescription>
                  <CardTitle>{analytics.metrics.rdm.toLocaleString()}</CardTitle>
                </CardHeader>
              </Card>
            </div>

            {studentInsights?.isStudent && studentInsights?.studyDays && studentInsights.streakTodayKeyUsed ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Study streak &amp; day totals</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    Streak matches saved study credits (<span className="font-mono">active_ms</span>); cells show
                    foreground on-site time (<span className="font-mono">presence_ms</span>). Reference day{" "}
                    <span className="font-mono">{studentInsights.streakTodayKeyUsed}</span> (UTC default; student events
                    store client calendar days).
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-3 text-xs">
                    <span className="text-muted-foreground">
                      Current streak:{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {studentInsights.studyDays.summary.streak} days
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      Active days this month:{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {studentInsights.studyDays.summary.activeDaysThisMonth}
                      </span>
                    </span>
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {studentInsights.studyDays.streakActiveMsNote}
                  </p>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    {studentInsights.studyDays.presenceMsNote}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={adminStudyHeatmapWindow === 7 ? "secondary" : "outline"}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setAdminStudyHeatmapWindow(7)}
                    >
                      Last 7 days
                    </Button>
                    <Button
                      type="button"
                      variant={adminStudyHeatmapWindow === 30 ? "secondary" : "outline"}
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => setAdminStudyHeatmapWindow(30)}
                    >
                      Last 30 days
                    </Button>
                  </div>
                  {(() => {
                    const cells = buildAdminStudyHeatCells(
                      studentInsights.streakTodayKeyUsed,
                      adminStudyHeatmapWindow,
                      studentInsights.studyDays.days
                    );
                    const maxPresence = Math.max(1, ...cells.map((c) => c.presence_ms));
                    return (
                      <div className="flex flex-wrap gap-1.5">
                        {cells.map((c) => {
                          const wd = new Date(`${c.day}T12:00:00Z`).toLocaleDateString(undefined, {
                            weekday: "short",
                          });
                          const intensity = c.presence_ms / maxPresence;
                          return (
                            <div
                              key={c.day}
                              title={`${c.day}\npresence: ${fmtStudyPresenceShort(c.presence_ms)}\nactive (streak ms): ${fmtDwellMs(c.active_ms)}`}
                              className={cn(
                                "flex min-w-[3.25rem] flex-1 flex-col rounded-md border px-1 py-1 text-center text-[10px] tabular-nums",
                                c.presence_ms > 0 ? "border-emerald-500/35" : "border-border/70"
                              )}
                              style={{
                                background:
                                  c.presence_ms > 0
                                    ? `rgba(16, 185, 129, ${0.06 + intensity * 0.42})`
                                    : undefined,
                              }}
                            >
                              <span className="font-medium text-muted-foreground">{wd}</span>
                              <span className="text-foreground">{fmtStudyPresenceShort(c.presence_ms)}</span>
                              <span className="text-[9px] text-muted-foreground">{c.day.slice(5)}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                  <p className="text-[10px] text-muted-foreground">
                    Hover a cell for raw day + saved-study (<span className="font-mono">active_ms</span>) duration.
                  </p>
                </CardContent>
              </Card>
            ) : null}

            {studentInsights?.isStudent && studentInsights?.chapterAccuracy ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Subject accuracy (chapter rollup)</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {studentInsights.chapterAccuracy.progressSourceNote}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {studentInsights.chapterAccuracy.taxonomyNote ? (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      {studentInsights.chapterAccuracy.taxonomyNote}
                    </p>
                  ) : null}
                  {studentInsights.chapterAccuracy.needsAttention.length > 0 ? (
                    <div className="rounded-lg border border-red-500/40 bg-red-500/[0.06] px-3 py-2 text-xs">
                      <p className="font-semibold text-red-800 dark:text-red-300">Needs attention</p>
                      <ul className="mt-1 list-inside list-disc text-muted-foreground">
                        {studentInsights.chapterAccuracy.needsAttention.map((r) => (
                          <li key={r.label}>
                            <span className="font-medium text-foreground">{r.label}</span> at {r.completionPct}% (
                            {r.completed}/{r.total} subtopics across {r.topicCountInChapter} topics)
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {studentInsights.chapterAccuracy.rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No chapters with lesson marks in scope (or taxonomy unavailable).
                    </p>
                  ) : (
                    <ul className="space-y-3">
                      {studentInsights.chapterAccuracy.rows.map((r) => (
                        <li key={r.label} className="rounded-lg border border-border/70 bg-muted/15 px-3 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground">{r.label}</span>
                            <span className="text-sm font-semibold tabular-nums">{r.completionPct}%</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            {r.completed}/{r.total} subtopics marked · {r.topicCountInChapter} topics in chapter · Class{" "}
                            {r.classLevel}
                          </p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-emerald-500/80 transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, r.completionPct))}%` }}
                            />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ) : null}

            {studentInsights?.isStudent && studentInsights?.bitsQuiz ? (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Topic quiz breakdown (submitted + drafts)</CardTitle>
                  <CardDescription className="text-xs leading-relaxed">
                    {studentInsights.bitsQuiz.rollupNote}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-[11px] text-muted-foreground">
                    Submitted attempt rows:{" "}
                    <span className="font-mono tabular-nums">{studentInsights.bitsQuiz.submittedAttemptRowCount}</span>{" "}
                    · Draft graded engagement rows:{" "}
                    <span className="font-mono tabular-nums">
                      {studentInsights.bitsQuiz.draftGradedEngagementRows}
                    </span>
                  </p>
                  <div className="grid gap-3 md:grid-cols-3">
                    {studentInsights.bitsQuiz.subjectRollup.map((s) => (
                      <div
                        key={s.subject}
                        className="rounded-xl border border-border/70 bg-muted/15 px-3 py-3 text-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold">{adminSubjectLabel(s.subject)}</span>
                          <span className="text-lg font-bold tabular-nums">{s.accuracy}%</span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {s.quizCount} quiz{s.quizCount === 1 ? "" : "zes"} · {s.total} answers graded
                        </p>
                        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px]">
                          <div className="rounded-md bg-background/80 px-1 py-1">
                            <div className="text-muted-foreground">Correct</div>
                            <div className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {s.correct}
                            </div>
                          </div>
                          <div className="rounded-md bg-background/80 px-1 py-1">
                            <div className="text-muted-foreground">Wrong</div>
                            <div className="font-semibold tabular-nums text-red-600 dark:text-red-400">{s.wrong}</div>
                          </div>
                          <div className="rounded-md bg-background/80 px-1 py-1">
                            <div className="text-muted-foreground">Skipped</div>
                            <div className="font-semibold tabular-nums">{s.skipped}</div>
                          </div>
                        </div>
                        {s.subtopicTags.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {s.subtopicTags.slice(0, 8).map((t) => (
                              <Badge key={t} variant="outline" className="max-w-[10rem] truncate text-[10px] font-normal">
                                {t}
                              </Badge>
                            ))}
                            {s.subtopicTags.length > 8 ? (
                              <Badge variant="secondary" className="text-[10px]">
                                +{s.subtopicTags.length - 8}
                              </Badge>
                            ) : null}
                          </div>
                        ) : (
                          <p className="mt-2 text-[11px] text-muted-foreground">No subtopic tags parsed.</p>
                        )}
                      </div>
                    ))}
                  </div>

                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 w-full justify-between gap-2 font-normal [&[data-state=open]>svg]:rotate-180"
                      >
                        <span className="text-xs font-medium">Attempt details (storage keys / retests)</span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>Subject</span>
                          <select
                            className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
                            value={bitsAttemptFilterSubject}
                            onChange={(e) =>
                              setBitsAttemptFilterSubject(e.target.value as typeof bitsAttemptFilterSubject)
                            }
                            aria-label="Filter attempts by subject"
                          >
                            <option value="all">All</option>
                            <option value="physics">Physics</option>
                            <option value="chemistry">Chemistry</option>
                            <option value="math">Mathematics</option>
                          </select>
                        </label>
                      </div>
                      <div className="overflow-x-auto rounded-lg border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs whitespace-nowrap">Submitted</TableHead>
                              <TableHead className="text-xs">Subject</TableHead>
                              <TableHead className="text-xs min-w-[8rem]">Subtopic</TableHead>
                              <TableHead className="text-xs">Lv</TableHead>
                              <TableHead className="text-right text-xs tabular-nums">OK</TableHead>
                              <TableHead className="text-right text-xs tabular-nums">Bad</TableHead>
                              <TableHead className="text-right text-xs tabular-nums">Skip</TableHead>
                              <TableHead className="text-xs font-mono min-w-[7rem]">Group key</TableHead>
                              <TableHead className="text-xs font-mono min-w-[8rem]">Storage key</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {studentInsights.bitsQuiz.attemptDetails.filter(
                              (row) =>
                                bitsAttemptFilterSubject === "all" || row.subject === bitsAttemptFilterSubject
                            ).length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={9} className="text-muted-foreground text-xs">
                                  No rows (filter or empty profile).
                                </TableCell>
                              </TableRow>
                            ) : (
                              studentInsights.bitsQuiz.attemptDetails
                                .filter(
                                  (row) =>
                                    bitsAttemptFilterSubject === "all" || row.subject === bitsAttemptFilterSubject
                                )
                                .map((row, idx) => (
                                  <TableRow key={`${row.storageKey}:${idx}`}>
                                    <TableCell className="whitespace-nowrap text-[11px] text-muted-foreground">
                                      {row.submittedAt ? fmtUpdatedCompact(row.submittedAt) : "—"}
                                    </TableCell>
                                    <TableCell className="text-xs">{adminSubjectLabel(row.subject)}</TableCell>
                                    <TableCell className="max-w-[14rem] truncate text-xs" title={row.subtopicName}>
                                      {row.subtopicName}
                                    </TableCell>
                                    <TableCell className="text-xs">{row.level}</TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">{row.correctCount}</TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">{row.wrongCount}</TableCell>
                                    <TableCell className="text-right text-xs tabular-nums">{row.skippedCount}</TableCell>
                                    <TableCell
                                      className="break-all font-mono text-[10px] text-muted-foreground"
                                      title={row.groupingKey}
                                    >
                                      {row.groupingKey}
                                    </TableCell>
                                    <TableCell className="break-all font-mono text-[10px] text-muted-foreground">
                                      {row.storageKey}
                                    </TableCell>
                                  </TableRow>
                                ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Group key strips <span className="font-mono">||set:N</span> from storage keys so retests on the
                        same attempt slot roll up together; advanced sets keep distinct storage keys.
                      </p>
                    </CollapsibleContent>
                  </Collapsible>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Recent Activity Feed</CardTitle>
                <CardDescription>Governance + doubt + AI event timeline</CardDescription>
              </CardHeader>
              <CardContent>
                {activity.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activity found.</p>
                ) : (
                  <div className="space-y-2">
                    {activity.map((item, idx) => (
                      <div key={`${item.timestamp}-${idx}`} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold">{item.title}</p>
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{item.details}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="learning-map" className="mt-4 space-y-4">
            {insightsError ? <p className="text-sm text-destructive">{insightsError}</p> : null}
            {studentInsights ? (
              <>
                <Card className="border-border/70 bg-muted/[0.06]">
                  <CardHeader className="pb-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-base">How to read “Learning”</CardTitle>
                        <CardDescription className="text-xs leading-relaxed sm:text-sm">
                          Each row is a lesson subtopic the student interacted with. This table mixes{" "}
                          <span className="font-medium text-foreground">progress signals</span> (Quiz / InstaCue / checklist)
                          and optional{" "}
                          <span className="font-medium text-foreground">dwell telemetry</span> (90d aggregate).
                        </CardDescription>
                      </div>
                      <label className="flex items-center gap-2 rounded-lg border bg-card/60 px-2.5 py-2 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={learningShowTelemetry}
                          onChange={(e) => setLearningShowTelemetry(e.target.checked)}
                        />
                        <span className="whitespace-nowrap">
                          Show advanced telemetry (90d)
                        </span>
                      </label>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                      <div className="rounded-lg border bg-card/50 p-2">
                        <p className="font-semibold text-foreground">Quiz</p>
                        <p className="text-[11px] leading-snug">
                          <span className="font-mono">iX/vY</span> = current index X, visited Y.{" "}
                          <span className="font-mono">(c/a)</span> = correct/answered.
                        </p>
                      </div>
                      <div className="rounded-lg border bg-card/50 p-2">
                        <p className="font-semibold text-foreground">InstaCue</p>
                        <p className="text-[11px] leading-snug">
                          <span className="font-mono">nN·fF</span> = navigation visits N, flips F.
                        </p>
                      </div>
                      <div className="rounded-lg border bg-card/50 p-2">
                        <p className="font-semibold text-foreground">Telemetry (optional)</p>
                        <p className="text-[11px] leading-snug">
                          When enabled: shows 90d dwell totals by panel (Theory/Quiz/Numerals/InstaCue).
                        </p>
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] leading-snug text-muted-foreground">
                      {studentInsights.schemaNote}
                    </p>
                  </CardContent>
                </Card>
                {!studentInsights.isStudent ? (
                  <p className="text-sm text-muted-foreground">
                    This account is not a student; learning-map rows may be empty or stale.
                  </p>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Dwell total (90d)</CardDescription>
                      <CardTitle>
                        {fmtDwellMs(studentInsights.dwellTotalsLast90DaysMs?.all ?? 0)}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Subtopic keys (store)</CardDescription>
                      <CardTitle>{studentInsights.learningMap.totalKeysInStore}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Quiz test rows (profile JSON)</CardDescription>
                      <CardTitle>{studentInsights.profileLearning.bitsTestAttemptsKeys}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Saved bits</CardDescription>
                      <CardTitle>{studentInsights.profileLearning.savedBitsCount}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Saved InstaCue cards</CardDescription>
                      <CardTitle>
                        {studentInsights.profileLearning.savedRevisionCardsCount}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>
                {studentInsights?.profileLearning?.dailyChecklistState ? (
                  <>
                    <ChecklistVisual state={studentInsights.profileLearning.dailyChecklistState} />
                    {checklistJson ? (
                      <Collapsible>
                        <Card>
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="space-y-1">
                                <CardTitle className="text-base">Daily checklist (raw JSON)</CardTitle>
                                <CardDescription>
                                  Debug-only. Visual summary above is preferred for admins.
                                </CardDescription>
                              </div>
                              <CollapsibleTrigger asChild>
                                <Button type="button" variant="outline" size="sm" className="h-8">
                                  Show / hide
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                          </CardHeader>
                          <CollapsibleContent>
                            <CardContent>
                              <pre className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-3 text-xs">
                                {checklistJson}
                              </pre>
                            </CardContent>
                          </CollapsibleContent>
                        </Card>
                      </Collapsible>
                    ) : null}
                  </>
                ) : null}
                {studentInsights.learningMap.capped ? (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Showing the {studentInsights.learningMap.rows.length} most recently updated
                    subtopics only.
                  </p>
                ) : null}

                {learningMapTotal > 10 ? (
                  <div className="flex w-full min-w-0 flex-col gap-2 rounded-xl border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {learningMapTotal === 0
                        ? "No rows."
                        : `Showing ${learningMapStart + 1}–${learningMapEndExclusive} of ${learningMapTotal}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">Per page</span>
                        <select
                          className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
                          value={learningMapPageSize}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (n === 10 || n === 25 || n === 50) {
                              setLearningMapPageSize(n);
                              setLearningMapPage(0);
                            }
                          }}
                          aria-label="Rows per page"
                        >
                          {LEARNING_MAP_PAGE_SIZES.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={learningMapPageClamped <= 0}
                          onClick={() => setLearningMapPage((p) => Math.max(0, p - 1))}
                        >
                          Previous
                        </Button>
                        <span className="min-w-[5.5rem] px-1 text-center text-xs tabular-nums text-muted-foreground">
                          Page {learningMapPageClamped + 1} / {learningMapTotalPages}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={learningMapPageClamped >= learningMapTotalPages - 1}
                          onClick={() =>
                            setLearningMapPage((p) => Math.min(learningMapTotalPages - 1, p + 1))
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : learningMapTotal > 0 ? (
                  <p className="text-xs text-muted-foreground">{learningMapTotal} row(s)</p>
                ) : null}

                <div className="w-full min-w-0 max-w-full rounded-xl border">
                  <Table className="min-w-0 table-fixed text-[11px] sm:text-xs">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="h-9 w-[7.5rem] px-1.5 py-2 sm:w-[8.5rem] sm:px-2">
                          Updated
                        </TableHead>
                        <TableHead className="hidden h-9 px-1.5 py-2 sm:table-cell sm:w-[4rem] sm:px-2">
                          Board
                        </TableHead>
                        <TableHead className="h-9 w-[4.5rem] px-1.5 py-2 sm:w-[5rem] sm:px-2">
                          Subject
                        </TableHead>
                        <TableHead className="h-9 w-9 px-1 py-2 text-center sm:w-10 sm:px-2">
                          Class
                        </TableHead>
                        <TableHead className="h-9 min-w-0 px-1.5 py-2 sm:px-2">Topic</TableHead>
                        <TableHead className="h-9 min-w-0 px-1.5 py-2 sm:px-2">Subtopic</TableHead>
                        <TableHead className="h-9 w-[4.5rem] px-1 py-2 sm:w-[5rem] sm:px-2">
                          Level
                        </TableHead>
                        <TableHead className="hidden h-9 px-1.5 py-2 md:table-cell md:w-[5.5rem] md:px-2">
                          Checklist
                        </TableHead>
                        <TableHead
                          className="h-9 min-w-0 px-1.5 py-2 sm:px-2"
                          title="Quiz progress for this subtopic: current index + how many questions were visited"
                        >
                          Quiz progress
                        </TableHead>
                        <TableHead className="hidden h-9 px-1.5 py-2 md:table-cell md:w-[6rem] md:px-2">
                          InstaCue activity
                        </TableHead>
                        <TableHead className="hidden h-9 px-1 py-2 text-center lg:table-cell lg:w-12 lg:px-2">
                          # Num
                        </TableHead>
                        <TableHead className="hidden h-9 px-1 py-2 text-center lg:table-cell lg:w-12 lg:px-2">
                          # Th
                        </TableHead>
                        {learningShowTelemetry ? (
                          <>
                            <TableHead
                              className="hidden h-9 px-1 py-2 xl:table-cell xl:w-[4rem] xl:px-2"
                              title="90d dwell time in Theory panel"
                            >
                              Th (90d)
                            </TableHead>
                            <TableHead
                              className="hidden h-9 px-1 py-2 xl:table-cell xl:w-[4rem] xl:px-2"
                              title="90d dwell time in Quiz panel"
                            >
                              Quiz (90d)
                            </TableHead>
                            <TableHead
                              className="hidden h-9 px-1 py-2 xl:table-cell xl:w-[4rem] xl:px-2"
                              title="90d dwell time in Numerals panel"
                            >
                              Num (90d)
                            </TableHead>
                            <TableHead
                              className="hidden h-9 px-1 py-2 xl:table-cell xl:w-[4rem] xl:px-2"
                              title="90d dwell time in InstaCue panel"
                            >
                              IC (90d)
                            </TableHead>
                          </>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {learningMapTotal === 0 ? (
                        <TableRow>
                          <TableCell colSpan={learningShowTelemetry ? 16 : 12} className="p-4 text-muted-foreground">
                            No subtopic engagement recorded.
                          </TableCell>
                        </TableRow>
                      ) : (
                        learningMapPageRows.map((row) => {
                          const s = row.summary;
                          const dw = row.dwellMsByPanel ?? {
                            theory: 0,
                            bits: 0,
                            numerals: 0,
                            instacue: 0,
                          };
                          const bitsLabel =
                            s.bitsVisitedCount > 0
                              ? s.bitsCurrentIdx !== null
                                ? `Quiz: ${s.bitsCurrentIdx} of ${s.bitsVisitedCount} visited`
                                : `Quiz: visited ${s.bitsVisitedCount}`
                              : "No Quiz activity";
                          const graded =
                            s.bitsGraded && `(${s.bitsGraded.correct}/${s.bitsGraded.answered})`;
                          return (
                            <TableRow key={row.storageKey}>
                              <TableCell
                                className="whitespace-nowrap p-1.5 align-top sm:p-2"
                                title={new Date(s.updatedAt).toLocaleString()}
                              >
                                {fmtUpdatedCompact(s.updatedAt)}
                              </TableCell>
                              <TableCell className="hidden p-1.5 align-top text-muted-foreground sm:table-cell sm:p-2">
                                {row.board || "—"}
                              </TableCell>
                              <TableCell className="p-1.5 align-top sm:p-2">
                                {row.subject || "—"}
                              </TableCell>
                              <TableCell className="p-1 py-2 text-center align-top sm:p-2">
                                {row.classLevel ?? "—"}
                              </TableCell>
                              <TableCell
                                className="max-w-[1px] break-words p-1.5 align-top leading-snug sm:p-2"
                                title={row.topic}
                              >
                                <span className="line-clamp-2">{row.topic || "—"}</span>
                              </TableCell>
                              <TableCell
                                className="max-w-[1px] break-words p-1.5 align-top leading-snug sm:p-2"
                                title={row.subtopicName}
                              >
                                <span className="line-clamp-2">{row.subtopicName || "—"}</span>
                              </TableCell>
                              <TableCell className="whitespace-nowrap p-1 py-2 align-top sm:p-2">
                                {row.level || "—"}
                              </TableCell>
                              <TableCell className="hidden p-1.5 align-top text-[10px] md:table-cell sm:text-xs sm:p-2">
                                {s.lessonChecklistMarkedCompleteAt
                                  ? fmtUpdatedCompact(s.lessonChecklistMarkedCompleteAt)
                                  : "—"}
                              </TableCell>
                              <TableCell className="p-1.5 align-top leading-tight sm:p-2">
                                <span className="text-[11px] leading-snug text-foreground">{bitsLabel}</span>
                                {graded ? (
                                  <span className="mt-0.5 block text-muted-foreground">
                                    Score {graded}
                                  </span>
                                ) : null}
                              </TableCell>
                              <TableCell className="hidden whitespace-nowrap p-1.5 align-top md:table-cell sm:p-2">
                                <span className="text-[11px] text-foreground">
                                  Browsed {s.instaCueNavVisitedCount}
                                </span>
                                <span className="block text-[11px] text-muted-foreground">
                                  Flipped {s.instaCueFlippedCount}
                                </span>
                              </TableCell>
                              <TableCell className="hidden p-1 py-2 text-center align-top lg:table-cell sm:p-2">
                                {s.numeralsFormulaSlots}
                              </TableCell>
                              <TableCell className="hidden p-1 py-2 text-center align-top lg:table-cell sm:p-2">
                                {s.conceptsPagesCount}
                              </TableCell>
                              {learningShowTelemetry ? (
                                <>
                                  <TableCell className="hidden whitespace-nowrap p-1.5 align-top xl:table-cell sm:p-2">
                                    {fmtDwellMs(dw.theory)}
                                  </TableCell>
                                  <TableCell className="hidden whitespace-nowrap p-1.5 align-top xl:table-cell sm:p-2">
                                    {fmtDwellMs(dw.bits)}
                                  </TableCell>
                                  <TableCell className="hidden whitespace-nowrap p-1.5 align-top xl:table-cell sm:p-2">
                                    {fmtDwellMs(dw.numerals)}
                                  </TableCell>
                                  <TableCell className="hidden whitespace-nowrap p-1.5 align-top xl:table-cell sm:p-2">
                                    {fmtDwellMs(dw.instacue)}
                                  </TableCell>
                                </>
                              ) : null}
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
                {!learningShowTelemetry ? (
                  <p className="text-[11px] text-muted-foreground">
                    Tip: enable <span className="font-medium text-foreground">Show advanced telemetry</span> for 90-day dwell time per panel.
                  </p>
                ) : null}
              </>
            ) : insightsError ? null : (
              <p className="text-sm text-muted-foreground">No insights loaded.</p>
            )}
          </TabsContent>

          <TabsContent value="gyan" className="mt-4 space-y-4">
            {insightsError ? <p className="text-sm text-destructive">{insightsError}</p> : null}
            {studentInsights ? (
              <>
                {!studentInsights.isStudent ? (
                  <p className="text-sm text-muted-foreground">
                    This account is not a student; Gyan++ doubts may be empty or stale.
                  </p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Gyan++ doubts listed (recent cap)</CardDescription>
                      <CardTitle>{studentInsights.gyanDoubts.recentCount}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Gyan++ answers submitted</CardDescription>
                      <CardTitle>{studentInsights.gyanDoubts.totals.answersSubmitted}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <Card className="overflow-hidden">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Gyan++ doubts</CardTitle>
                    <CardDescription>
                      Forum-style doubts (not the in-topic AI tutor — use the{" "}
                      <span className="font-medium text-foreground">Chatbot</span> tab). Open a row for the full
                      thread.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="border-t bg-muted/10 px-5 py-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <Input
                          value={gyanDoubtsQuery}
                          onChange={(e) => setGyanDoubtsQuery(e.target.value)}
                          placeholder="Search title/body…"
                          className="h-9 sm:max-w-xs"
                        />
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>Subject</span>
                            <select
                              className="h-9 rounded-md border bg-background px-2 text-xs text-foreground"
                              value={gyanDoubtsSubjectFilter}
                              onChange={(e) =>
                                setGyanDoubtsSubjectFilter(
                                  e.target.value as typeof gyanDoubtsSubjectFilter
                                )
                              }
                            >
                              <option value="all">All</option>
                              <option value="physics">Physics</option>
                              <option value="chemistry">Chemistry</option>
                              <option value="math">Mathematics</option>
                              <option value="biology">Biology</option>
                              <option value="general">General</option>
                            </select>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>Status</span>
                            <select
                              className="h-9 rounded-md border bg-background px-2 text-xs text-foreground"
                              value={gyanDoubtsStatusFilter}
                              onChange={(e) =>
                                setGyanDoubtsStatusFilter(
                                  e.target.value as typeof gyanDoubtsStatusFilter
                                )
                              }
                            >
                              <option value="all">All</option>
                              <option value="open">Open</option>
                              <option value="resolved">Resolved</option>
                            </select>
                          </label>
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span>Answers</span>
                            <select
                              className="h-9 rounded-md border bg-background px-2 text-xs text-foreground"
                              value={gyanDoubtsAnswerFilter}
                              onChange={(e) =>
                                setGyanDoubtsAnswerFilter(
                                  e.target.value as typeof gyanDoubtsAnswerFilter
                                )
                              }
                            >
                              <option value="all">Any</option>
                              <option value="ai">Has AI</option>
                              <option value="teacher">Has teacher</option>
                              <option value="student">Has peer</option>
                            </select>
                          </label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9"
                            onClick={() => {
                              setGyanDoubtsQuery("");
                              setGyanDoubtsSubjectFilter("all");
                              setGyanDoubtsStatusFilter("all");
                              setGyanDoubtsAnswerFilter("all");
                            }}
                          >
                            Clear
                          </Button>
                        </div>
                      </div>
                      <p className="mt-2 text-[11px] text-muted-foreground tabular-nums">
                        Showing {gyanFilteredDoubts.length} of {studentInsights.gyanDoubts.recent.length} loaded doubt(s)
                      </p>
                    </div>

                    {studentInsights.gyanDoubts.recent.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-6 pb-6 pt-4">None.</p>
                    ) : gyanFilteredDoubts.length === 0 ? (
                      <p className="text-sm text-muted-foreground px-6 pb-6 pt-4">
                        No matches for current filters.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border/80">
                        {gyanFilteredDoubts.map((d) => {
                          const nAi = d.answers.filter((a) => a.kind === "ai").length;
                          const nTeach = d.answers.filter((a) => a.kind === "teacher").length;
                          const nStud = d.answers.filter((a) => a.kind === "student").length;
                          return (
                            <li key={d.id}>
                              <button
                                type="button"
                                className={cn(
                                  "w-full text-left px-5 py-4 transition-colors",
                                  "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                                )}
                                onClick={() => setGyanDoubtDetail(d)}
                              >
                                <div className="flex justify-between gap-3">
                                  <span className="font-semibold text-sm leading-snug text-foreground line-clamp-2">
                                    {d.title}
                                  </span>
                                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 tabular-nums">
                                    {new Date(d.createdAt).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">
                                  {d.listPreview || "—"}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-2">
                                  <span className="text-[11px] text-muted-foreground">
                                    {(d.subject ?? "—") +
                                      " · " +
                                      (d.isResolved ? "Resolved" : "Open") +
                                      " · " +
                                      d.views +
                                      " views"}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] font-normal tabular-nums">
                                    {d.answers.length} answer{d.answers.length === 1 ? "" : "s"}
                                  </Badge>
                                  {nAi > 0 ? (
                                    <Badge variant="secondary" className="text-[10px]">
                                      AI {nAi}
                                    </Badge>
                                  ) : null}
                                  {nTeach > 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] border-emerald-500/35 text-emerald-700 dark:text-emerald-400"
                                    >
                                      Teacher {nTeach}
                                    </Badge>
                                  ) : null}
                                  {nStud > 0 ? (
                                    <Badge variant="outline" className="text-[10px]">
                                      Peer {nStud}
                                    </Badge>
                                  ) : null}
                                </div>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : insightsError ? null : (
              <p className="text-sm text-muted-foreground">No insights loaded.</p>
            )}
          </TabsContent>

          <TabsContent value="saved" className="mt-4 space-y-4">
            {insightsError ? <p className="text-sm text-destructive">{insightsError}</p> : null}
            {studentInsights ? (
              <>
                {!studentInsights.isStudent ? (
                  <p className="text-sm text-muted-foreground">
                    This account is not a student; saved content may be empty or stale.
                  </p>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Saved bits</CardDescription>
                      <CardTitle>{studentInsights.profileLearning.savedBitsCount}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Saved formulas</CardDescription>
                      <CardTitle>{studentInsights.profileLearning.savedFormulasCount}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>InstaCue cards</CardDescription>
                      <CardTitle>{studentInsights.profileLearning.savedRevisionCardsCount}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Revision units</CardDescription>
                      <CardTitle>{studentInsights.profileLearning.savedRevisionUnitsCount}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Saved community posts</CardDescription>
                      <CardTitle>{studentInsights.profileLearning.savedCommunityPostsCount ?? 0}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Total (profile)</CardDescription>
                      <CardTitle>{savedTotalCountFromProfile}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Saved library</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      Everything below is scoped to this student’s profile saved lists.{" "}
                      {studentInsights.savedContent?.capsNote ?? ""}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                      <Input
                        value={savedQuery}
                        onChange={(e) => setSavedQuery(e.target.value)}
                        placeholder="Search saved content…"
                        className="h-9 w-full lg:max-w-md"
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span>Type</span>
                          <select
                            className="h-9 rounded-md border bg-background px-2 text-xs text-foreground"
                            value={savedTypeFilter}
                            onChange={(e) =>
                              setSavedTypeFilter(e.target.value as typeof savedTypeFilter)
                            }
                            aria-label="Filter saved content by type"
                          >
                            <option value="all">All</option>
                            <option value="bit">Quiz</option>
                            <option value="formula">Formula</option>
                            <option value="instacue_card">InstaCue card</option>
                            <option value="revision_unit">Revision unit</option>
                            <option value="community_post">Community post</option>
                          </select>
                        </label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => {
                            setSavedQuery("");
                            setSavedTypeFilter("all");
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      Showing {savedFilteredRows.length} of {savedRows.length} loaded item(s){" "}
                      {savedRows.length < savedTotalCountFromProfile ? (
                        <span className="text-amber-700 dark:text-amber-400">
                          (capped: profile has {savedTotalCountFromProfile})
                        </span>
                      ) : null}
                    </p>

                    <div className="w-full rounded-lg border">
                      <Table className="w-full table-fixed">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[5.5rem] text-xs">Type</TableHead>
                            <TableHead className="min-w-0 text-xs">Title</TableHead>
                            <TableHead className="hidden w-[7rem] text-xs md:table-cell">Subject</TableHead>
                            <TableHead className="hidden w-[3.5rem] text-xs md:table-cell">Class</TableHead>
                            <TableHead className="hidden text-xs lg:table-cell">Context</TableHead>
                            <TableHead className="hidden w-[7.5rem] text-xs whitespace-nowrap xl:table-cell">
                              Saved at
                            </TableHead>
                            <TableHead className="w-[5rem] text-xs text-right"> </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {savedFilteredRows.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={7} className="text-sm text-muted-foreground">
                                No saved items match these filters.
                              </TableCell>
                            </TableRow>
                          ) : (
                            savedFilteredRows.map((r, idx) => (
                              <TableRow key={`${r.kind}:${r.id}:${idx}`}>
                                <TableCell className="p-2 text-xs">
                                  <Badge variant="outline" className="text-[10px] font-normal">
                                    {savedKindLabel(r.kind)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="p-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium" title={r.title}>
                                      {r.title}
                                    </p>
                                    <p
                                      className="mt-0.5 line-clamp-1 text-[11px] text-muted-foreground lg:hidden"
                                      title={r.subtitle}
                                    >
                                      {r.subtitle || "—"}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="hidden p-2 text-xs md:table-cell">
                                  {r.subjectLabel}
                                </TableCell>
                                <TableCell className="hidden p-2 text-xs tabular-nums md:table-cell">
                                  {r.classLevel ?? "—"}
                                </TableCell>
                                <TableCell
                                  className="hidden p-2 text-xs text-muted-foreground lg:table-cell"
                                  title={r.subtitle}
                                >
                                  <span className="line-clamp-1">{r.subtitle || "—"}</span>
                                </TableCell>
                                <TableCell className="hidden p-2 text-xs text-muted-foreground whitespace-nowrap xl:table-cell">
                                  {r.savedAt ? fmtUpdatedCompact(r.savedAt) : "—"}
                                </TableCell>
                                <TableCell className="p-2 text-right">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => setSavedDetail(r)}
                                  >
                                    View
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : insightsError ? null : (
              <p className="text-sm text-muted-foreground">No insights loaded.</p>
            )}
          </TabsContent>

          <TabsContent value="magic-wall" className="mt-4 space-y-4">
            {insightsError ? (
              <p className="text-sm text-destructive">{insightsError}</p>
            ) : studentInsights ? (
              <>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Basket rows are ordered by{" "}
                  <span className="font-medium text-foreground">last activity</span> (
                  <span className="font-mono text-[10px]">updated_at</span> desc). The card below is the
                  student&apos;s most recently touched Magic Wall topic; click any row for correlated
                  learning map dwell, topic chat, Gyan++ doubts, and community posts.
                </p>

                {magicWallFocusSummary ? (
                  <Card className="border-primary/25 bg-primary/[0.04] shadow-sm">
                    <CardHeader className="space-y-1 pb-2">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <CardTitle className="text-base leading-snug">
                            Latest Magic Wall activity (best-effort)
                          </CardTitle>
                          <CardDescription className="text-xs leading-relaxed sm:text-sm">
                            Derived from <span className="font-mono text-[10px]">magic_wall_basket_items.updated_at</span>{" "}
                            (not a live “current screen” signal). Last fetched{" "}
                            <span className="font-mono text-[10px]">{fmtUpdatedCompact(studentInsights.generatedAt)}</span>.
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" className="shrink-0 tabular-nums">
                          Updated {new Date(magicWallFocusSummary.mw.updated_at).toLocaleString()}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold leading-snug text-foreground">
                          {magicWallFocusSummary.mw.topic_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {(magicWallFocusSummary.mw.chapter_title ?? "—") +
                            (magicWallFocusSummary.mw.unit_name
                              ? ` · Unit: ${magicWallFocusSummary.mw.unit_name}`
                              : "")}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          <Badge variant="outline" className="capitalize">
                            {magicWallFocusSummary.mw.board}
                          </Badge>
                          <Badge variant="outline" className="capitalize">
                            {magicWallFocusSummary.mw.subject}
                          </Badge>
                          <Badge variant="outline" className="tabular-nums">
                            Class {magicWallFocusSummary.mw.class_level}
                          </Badge>
                          {magicWallFocusSummary.mw.source ? (
                            <Badge variant="outline" className="font-mono text-[10px]">
                              {magicWallFocusSummary.mw.source}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <Badge variant="outline" className="tabular-nums">
                          Learning-map hits {magicWallFocusSummary.learningMatches.length}
                        </Badge>
                        <Badge variant="outline" className="tabular-nums">
                          Σ dwell {fmtDwellMs(magicWallFocusSummary.dwell.all)}
                        </Badge>
                        <Badge variant="outline" className="tabular-nums">
                          Topic chat msgs {magicWallFocusSummary.nChat}
                        </Badge>
                        <Badge variant="outline" className="tabular-nums">
                          Gyan++ doubts {magicWallFocusSummary.nDoubt}
                        </Badge>
                        <Badge variant="outline" className="tabular-nums">
                          Community posts {magicWallFocusSummary.nCommunity}
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full sm:w-auto"
                        onClick={() => setMagicWallDetail(magicWallFocusSummary.mw)}
                      >
                        Open full drill-down for this topic
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <p className="rounded-lg border border-dashed px-4 py-3 text-xs text-muted-foreground">
                    No Magic Wall basket rows for this user yet.
                  </p>
                )}

                {magicWallTotal > MAGIC_WALL_PAGE_SIZES[0] ? (
                  <div className="flex w-full min-w-0 flex-col gap-2 rounded-xl border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {magicWallTotal === 0
                        ? "No rows."
                        : `Showing ${magicWallStart + 1}–${magicWallEndExclusive} of ${magicWallTotal}`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="whitespace-nowrap">Per page</span>
                        <select
                          className="h-8 rounded-md border bg-background px-2 text-xs text-foreground"
                          value={magicWallPageSize}
                          onChange={(e) => {
                            const n = Number(e.target.value);
                            if (
                              n === MAGIC_WALL_PAGE_SIZES[0] ||
                              n === MAGIC_WALL_PAGE_SIZES[1] ||
                              n === MAGIC_WALL_PAGE_SIZES[2]
                            ) {
                              setMagicWallPageSize(n);
                              setMagicWallPage(0);
                            }
                          }}
                          aria-label="Magic Wall rows per page"
                        >
                          {MAGIC_WALL_PAGE_SIZES.map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={magicWallPageClamped <= 0}
                          onClick={() => setMagicWallPage((p) => Math.max(0, p - 1))}
                        >
                          Previous
                        </Button>
                        <span className="min-w-[5.5rem] px-1 text-center text-xs tabular-nums text-muted-foreground">
                          Page {magicWallPageClamped + 1} / {magicWallTotalPages}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8"
                          disabled={magicWallPageClamped >= magicWallTotalPages - 1}
                          onClick={() =>
                            setMagicWallPage((p) => Math.min(magicWallTotalPages - 1, p + 1))
                          }
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : magicWallTotal > 0 ? (
                  <p className="text-xs text-muted-foreground">{magicWallTotal} basket row(s)</p>
                ) : null}

                <div className="rounded-xl border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Subject</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Topic name</TableHead>
                        <TableHead>Chapter</TableHead>
                        <TableHead>Topic key</TableHead>
                        <TableHead>Updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {magicWallTotal === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-muted-foreground">
                            No Magic Wall basket items.
                          </TableCell>
                        </TableRow>
                      ) : (
                        magicWallPageRows.map((it) => {
                          const isLatest = it.id === magicWallAllItems[0]?.id;
                          return (
                            <TableRow
                              key={it.id}
                              role="button"
                              tabIndex={0}
                              title="Open drill-down"
                              onClick={() => setMagicWallDetail(it)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  setMagicWallDetail(it);
                                }
                              }}
                              className={cn(
                                "cursor-pointer transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                                isLatest && "bg-primary/[0.06]"
                              )}
                            >
                              <TableCell className="text-xs">
                                <span className="inline-flex flex-wrap items-center gap-1">
                                  {it.subject}
                                  {isLatest ? (
                                    <Badge variant="secondary" className="text-[9px] font-normal">
                                      latest
                                    </Badge>
                                  ) : null}
                                </span>
                              </TableCell>
                              <TableCell className="text-xs">{it.class_level}</TableCell>
                              <TableCell
                                className="text-xs max-w-[200px] truncate"
                                title={it.topic_name}
                              >
                                {it.topic_name}
                              </TableCell>
                              <TableCell
                                className="text-xs max-w-[180px] truncate"
                                title={it.chapter_title ?? ""}
                              >
                                {it.chapter_title ?? "—"}
                              </TableCell>
                              <TableCell
                                className="font-mono text-[10px] max-w-[120px] truncate"
                                title={it.topic_key}
                              >
                                {it.topic_key}
                              </TableCell>
                              <TableCell className="text-xs whitespace-nowrap">
                                {new Date(it.updated_at).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                <Sheet
                  open={magicWallDetail !== null}
                  onOpenChange={(open) => {
                    if (!open) setMagicWallDetail(null);
                  }}
                >
                  <SheetContent
                    side="right"
                    className="flex w-full min-w-0 flex-col overflow-x-hidden overflow-y-auto sm:max-w-3xl lg:max-w-4xl"
                  >
                    {magicWallDetail ? (
                      <AdminMagicWallTopicSheetInner
                        item={magicWallDetail}
                        learningMatches={learningRowsMatchingMagicWallItem(
                          magicWallDetail,
                          learningMapAllRows
                        )}
                        chatMatches={chatMessagesMatchingMagicWallItem(
                          magicWallDetail,
                          studentInsights.subjectTopicChat.messages
                        )}
                        doubtMatches={doubtsMatchingMagicWallItem(
                          magicWallDetail,
                          studentInsights.gyanDoubts.recent
                        )}
                        communityMatches={communityPostsMatchingMagicWallItem(
                          magicWallDetail,
                          studentInsights.community.posts
                        )}
                      />
                    ) : null}
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </TabsContent>

          <TabsContent value="classroom" className="mt-4">
            {insightsError ? (
              <p className="text-sm text-destructive">{insightsError}</p>
            ) : studentInsights ? (
              <div className="rounded-xl border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Completed</TableHead>
                      <TableHead>Post</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Task id</TableHead>
                      <TableHead>Classroom</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentInsights.classroomTasks.rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-muted-foreground">
                          No classroom assignment task progress.
                        </TableCell>
                      </TableRow>
                    ) : (
                      studentInsights.classroomTasks.rows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-xs whitespace-nowrap">
                            {new Date(r.completedAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-xs max-w-[240px]" title={r.postTitle ?? ""}>
                            {r.postTitle ?? r.postId}
                          </TableCell>
                          <TableCell className="text-xs">{r.postType ?? "—"}</TableCell>
                          <TableCell className="font-mono text-[10px]">{r.taskId}</TableCell>
                          <TableCell className="font-mono text-[10px]">
                            {r.classroomId ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </TabsContent>

          <TabsContent value="chatbot" className="mt-4 space-y-4">
            {insightsError ? (
              <p className="text-sm text-destructive">{insightsError}</p>
            ) : studentInsights ? (
              <Card>
                  <CardHeader className="space-y-1 pb-2">
                    <CardTitle className="text-base">Subject topic chat (AI tutor)</CardTitle>
                    <CardDescription className="text-xs leading-relaxed sm:text-sm">
                      Private tutor chat from subject/topic lesson pages (same assistant pipeline as the app).{" "}
                      <span className="font-medium text-foreground">Not</span> Community posts.{" "}
                      <span className="font-medium text-foreground">Not</span> Gyan++ forum doubts — those are under{" "}
                      <span className="font-medium text-foreground">Learning map</span>.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {studentInsights.subjectTopicChat.messages.length === 0 ? (
                      <p className="text-xs text-muted-foreground sm:text-sm">No topic chat messages.</p>
                    ) : (
                      <>
                        {studentInsights.subjectTopicChat.messages.length >= MAX_CHAT_MESSAGES ? (
                          <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-400">
                            Only the newest {MAX_CHAT_MESSAGES} chat rows are loaded for this page—threads here may be
                            partial snapshots, not full history.
                          </p>
                        ) : null}
                        <div className="grid gap-3 lg:grid-cols-[minmax(260px,300px)_1fr] lg:items-start">
                          <ScrollArea className="h-[min(58vh,400px)] rounded-lg border bg-muted/20">
                            <div className="flex flex-col gap-0.5 p-1">
                              {subjectTopicChatThreads.map((thread) => {
                                const pairs = parseSubjectTopicContextKey(thread.contextKey);
                                const subject = pairs.find((p) => p.key === "subject")?.value;
                                const topic = pairs.find((p) => p.key === "topic")?.value;
                                const headline =
                                  [subject, topic].filter(Boolean).join(" · ") ||
                                  subjectTopicChatSnippet(thread.contextKey, 72);
                                const selected = selectedSubjectTopicContextKey === thread.contextKey;
                                return (
                                  <button
                                    key={thread.contextKey}
                                    type="button"
                                    onClick={() => setSelectedSubjectTopicContextKey(thread.contextKey)}
                                    className={cn(
                                      "flex w-full min-w-0 flex-col gap-0.5 rounded-md border px-2 py-2 text-left transition-colors",
                                      selected
                                        ? "border-primary/40 bg-primary/10"
                                        : "border-transparent hover:bg-muted/80"
                                    )}
                                  >
                                    <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground sm:text-[13px]">
                                      {thread.snippet}
                                    </p>
                                    <p className="line-clamp-1 text-[11px] text-muted-foreground">{headline}</p>
                                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0 text-[10px] text-muted-foreground tabular-nums sm:text-[11px]">
                                      <span>
                                        {thread.messages.length} msg
                                        {thread.messages.length !== 1 ? "s" : ""}
                                      </span>
                                      <span className="ml-auto">
                                        {fmtUpdatedCompact(new Date(thread.latestAt).toISOString())}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </ScrollArea>

                          <div className="min-h-[min(58vh,400px)] min-w-0 overflow-hidden rounded-lg border bg-card/80 shadow-sm">
                            {!selectedSubjectTopicThread ? (
                              <div className="flex h-full min-h-[10rem] items-center justify-center px-3 text-center text-xs text-muted-foreground sm:text-sm">
                                Select a thread for curriculum labels and messages (compact text).
                              </div>
                            ) : (
                              <ScrollArea className="h-[min(58vh,400px)]">
                                <div className="space-y-3 px-3 py-3">
                                  <div className="space-y-1.5">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Curriculum context
                                    </p>
                                    <div className="flex flex-wrap gap-1">
                                      {parseSubjectTopicContextKey(selectedSubjectTopicThread.contextKey).map(
                                        ({ key, value }, idx) => (
                                          <Badge
                                            key={`${key}-${idx}`}
                                            variant="outline"
                                            className="h-auto max-w-full gap-0.5 px-1.5 py-0.5 text-[10px] font-normal leading-tight"
                                          >
                                            <span className="text-muted-foreground">
                                              {SUBJECT_TOPIC_CTX_LABELS[key] ?? key}
                                            </span>
                                            <span className="min-w-0 truncate font-medium">{value || "—"}</span>
                                          </Badge>
                                        )
                                      )}
                                    </div>
                                    <div className="flex flex-wrap items-start gap-2">
                                      <span className="max-h-16 max-w-full overflow-y-auto break-all font-mono text-[9px] leading-snug text-muted-foreground sm:text-[10px]">
                                        {selectedSubjectTopicThread.contextKey}
                                      </span>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-7 shrink-0 gap-1 px-2 text-[11px]"
                                        onClick={() =>
                                          void copyCommunity(
                                            `ctx:${selectedSubjectTopicThread.contextKey}`,
                                            selectedSubjectTopicThread.contextKey
                                          )
                                        }
                                      >
                                        <Copy className="h-3 w-3" />
                                        {communityCopiedKey === `ctx:${selectedSubjectTopicThread.contextKey}`
                                          ? "Copied"
                                          : "Copy key"}
                                      </Button>
                                    </div>
                                  </div>

                                  <Separator />

                                  <div className="space-y-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                                      Conversation (chronological)
                                    </p>
                                    {selectedSubjectTopicThread.messages.map((m) => (
                                      <div
                                        key={m.id}
                                        className={cn(
                                          "rounded-md border px-2 py-1.5",
                                          m.role === "assistant"
                                            ? "border-border/80 bg-muted/25"
                                            : "border-primary/25 bg-primary/[0.06]"
                                        )}
                                      >
                                        <div className="mb-1 flex flex-wrap items-center justify-between gap-1.5">
                                          <Badge
                                            variant="secondary"
                                            className="h-5 px-1.5 py-0 text-[10px] capitalize"
                                          >
                                            {m.role}
                                          </Badge>
                                          <span className="text-[10px] text-muted-foreground tabular-nums sm:text-[11px]">
                                            {new Date(m.createdAt).toLocaleString()}
                                          </span>
                                        </div>
                                        <AdminCommunityMarkdown source={m.body} clamp={false} compact />
                                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-1.5">
                                          <span className="font-mono text-[9px] text-muted-foreground sm:text-[10px]">
                                            {m.id}
                                          </span>
                                          <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 gap-1 px-1.5 text-[10px]"
                                            onClick={() => void copyCommunity(`chat:${m.id}`, m.id)}
                                          >
                                            <Copy className="h-3 w-3" />
                                            {communityCopiedKey === `chat:${m.id}` ? "Copied" : "Copy id"}
                                          </Button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </ScrollArea>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </TabsContent>

          <TabsContent value="community" className="mt-4 space-y-4">
            {insightsError ? (
              <p className="text-sm text-destructive">{insightsError}</p>
            ) : studentInsights ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Posts (database)</CardDescription>
                      <CardTitle className="text-2xl tabular-nums">
                        {communityTotals?.postsInDb ?? communityPostsRaw.length}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Comments (database)</CardDescription>
                      <CardTitle className="text-2xl tabular-nums">
                        {communityTotals?.commentsInDb ?? communityCommentsRaw.length}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Loaded for this view</CardDescription>
                      <CardTitle className="text-lg leading-snug">
                        {communityTotals?.postsLoaded ?? communityPostsRaw.length} posts ·{" "}
                        {communityTotals?.commentsLoaded ?? communityCommentsRaw.length} comments
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {communityTotals?.postsCapped || communityTotals?.commentsCapped ? (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Only the newest posts and comments are loaded in this tab; the summary cards
                    still reflect full database totals.
                  </p>
                ) : null}

                <div className="flex flex-col gap-3 rounded-xl border bg-muted/25 px-3 py-3 sm:flex-row sm:items-center">
                  <div className="relative flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={communityQuery}
                      onChange={(e) => setCommunityQuery(e.target.value)}
                      placeholder="Filter posts & comments (title, body, tags, kind, topic…)"
                      className="h-10 pl-9 text-sm"
                      aria-label="Filter community"
                    />
                  </div>
                  {communityQuery.trim() ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => setCommunityQuery("")}
                    >
                      Clear filter
                    </Button>
                  ) : null}
                </div>

                <Card>
                  <CardHeader className="space-y-1 pb-2">
                    <CardTitle className="text-lg">Community posts</CardTitle>
                    <CardDescription className="text-sm">
                      Posts created by this user (their threads). Pick one on the left for full
                      markdown / LaTeX, all comments and votes on that post, and DB totals. Copy IDs
                      for support.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {filteredCommunityPosts.length > COMMUNITY_POST_PAGE_SIZES[0] ? (
                      <div className="flex w-full min-w-0 flex-col gap-2 rounded-xl border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground tabular-nums sm:text-sm">
                          {filteredCommunityPosts.length === 0 ? (
                            "No matches."
                          ) : (
                            <>
                              Showing {communityPostStart + 1}–{communityPostEndExclusive} of{" "}
                              {filteredCommunityPosts.length}
                              {communityQuery.trim()
                                ? ` (filtered from ${communityPostsRaw.length})`
                                : ""}
                            </>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                            <span className="whitespace-nowrap">Per page</span>
                            <select
                              className="h-8 rounded-md border bg-background px-2 text-xs text-foreground sm:text-sm"
                              value={communityPostPageSize}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (n === 8 || n === 12 || n === 20) {
                                  setCommunityPostPageSize(n);
                                  setCommunityPostPage(0);
                                }
                              }}
                              aria-label="Posts per page"
                            >
                              {COMMUNITY_POST_PAGE_SIZES.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={communityPostPageClamped <= 0}
                              onClick={() => setCommunityPostPage((p) => Math.max(0, p - 1))}
                            >
                              Previous
                            </Button>
                            <span className="min-w-[5.5rem] px-1 text-center text-xs tabular-nums text-muted-foreground sm:text-sm">
                              Page {communityPostPageClamped + 1} / {communityPostTotalPages}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={communityPostPageClamped >= communityPostTotalPages - 1}
                              onClick={() =>
                                setCommunityPostPage((p) =>
                                  Math.min(communityPostTotalPages - 1, p + 1)
                                )
                              }
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : filteredCommunityPosts.length > 0 ? (
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {filteredCommunityPosts.length} post(s)
                        {communityQuery.trim()
                          ? ` (filtered from ${communityPostsRaw.length})`
                          : ""}
                      </p>
                    ) : null}

                    {communityPostsRaw.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No community posts for this user.
                      </p>
                    ) : filteredCommunityPosts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No posts match this filter.</p>
                    ) : (
                      <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_1fr] lg:items-start">
                        {selectedCommunityPost &&
                        !communityPostPageRows.some((r) => r.id === selectedCommunityPost.id) ? (
                          <p className="text-xs text-muted-foreground lg:col-span-2">
                            Selected post is not on this page — use Previous / Next or change rows
                            per page to highlight it in the list.
                          </p>
                        ) : null}

                        <ScrollArea className="h-[min(70vh,560px)] rounded-xl border bg-muted/20">
                          <div className="flex flex-col gap-0.5 p-1.5">
                            {communityPostPageRows.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => setSelectedCommunityPostId(p.id)}
                                className={cn(
                                  "flex w-full min-w-0 flex-col gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                                  selectedCommunityPostId === p.id
                                    ? "border-primary/40 bg-primary/10"
                                    : "border-transparent hover:bg-muted/80"
                                )}
                              >
                                <AdminCommunityMarkdown source={p.title} clamp lines={1} />
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground sm:text-sm">
                                  <Badge
                                    variant="secondary"
                                    className="shrink-0 text-[10px] font-medium"
                                  >
                                    {p.kind}
                                  </Badge>
                                  {p.subject ? (
                                    <span className="max-w-[10rem] truncate font-medium text-foreground/90">
                                      {p.subject}
                                    </span>
                                  ) : null}
                                  {p.sourceType ? (
                                    <span className="truncate text-[11px] opacity-80">
                                      {p.sourceType}
                                    </span>
                                  ) : null}
                                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                                    <ArrowBigUp className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                    {p.upvoteCount}
                                  </span>
                                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                                    <ArrowBigDown className="h-3.5 w-3.5 shrink-0 text-red-600 dark:text-red-400" />
                                    {p.downvoteCount}
                                  </span>
                                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                                    {p.commentCount}
                                  </span>
                                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                                    <Sparkles className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                    {p.boostCount}
                                  </span>
                                  <span className="ml-auto shrink-0 tabular-nums text-[11px]">
                                    {fmtUpdatedCompact(p.createdAt)}
                                  </span>
                                </div>
                              </button>
                            ))}
                          </div>
                        </ScrollArea>

                        <div className="min-h-[min(70vh,560px)] min-w-0 overflow-hidden rounded-xl border bg-card/80 shadow-sm">
                          {!selectedCommunityPost ? (
                            <div className="flex h-full min-h-[12rem] items-center justify-center px-4 text-center text-sm text-muted-foreground">
                              Select a post to view full content, curriculum refs, tags, thread
                              comments, and vote samples.
                            </div>
                          ) : (
                            <ScrollArea className="h-[min(70vh,560px)]">
                              <div className="space-y-4 px-4 py-4">
                                {(() => {
                                  const p = selectedCommunityPost;
                                  const refs = [
                                    p.boardRef && `board:${p.boardRef}`,
                                    p.gradeRef && `grade:${p.gradeRef}`,
                                    p.subject && `subject:${p.subject}`,
                                    p.topicRef && `topic:${p.topicRef}`,
                                    p.subtopicRef && `subtopic:${p.subtopicRef}`,
                                    p.unitRef && `unit:${p.unitRef}`,
                                    p.chapterRef && `chapter:${p.chapterRef}`,
                                  ].filter(Boolean) as string[];
                                  const thread = communityPostThread;
                                  return (
                                    <>
                                      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/80 pb-3">
                                        <div className="flex flex-wrap gap-2">
                                          <Badge variant="secondary" className="font-medium">
                                            {p.kind}
                                          </Badge>
                                          {p.subject ? (
                                            <Badge variant="outline">{p.subject}</Badge>
                                          ) : null}
                                          {p.sourceType ? (
                                            <Badge
                                              variant="outline"
                                              className="text-muted-foreground"
                                            >
                                              {p.sourceType}
                                            </Badge>
                                          ) : null}
                                        </div>
                                        <div className="text-right text-xs text-muted-foreground sm:text-sm">
                                          <div className="whitespace-nowrap tabular-nums">
                                            {new Date(p.createdAt).toLocaleString()}
                                          </div>
                                          {p.updatedAt !== p.createdAt ? (
                                            <div className="mt-0.5 whitespace-nowrap text-[11px] opacity-80">
                                              Updated {new Date(p.updatedAt).toLocaleString()}
                                            </div>
                                          ) : null}
                                        </div>
                                      </div>

                                      <div className="min-w-0 space-y-3">
                                        <div className="min-w-0">
                                          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Title
                                          </p>
                                          <AdminCommunityMarkdown source={p.title} clamp={false} />
                                        </div>

                                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground sm:text-sm">
                                          <span className="inline-flex items-center gap-1 tabular-nums">
                                            <ArrowBigUp className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                            {p.upvoteCount}
                                          </span>
                                          <span className="inline-flex items-center gap-1 tabular-nums">
                                            <ArrowBigDown className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                                            {p.downvoteCount}
                                          </span>
                                          <span className="inline-flex items-center gap-1 tabular-nums">
                                            <MessageCircle className="h-4 w-4 shrink-0" />
                                            {p.commentCount} on post
                                          </span>
                                          <span className="inline-flex items-center gap-1 tabular-nums">
                                            <Sparkles className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                            {p.boostCount}
                                          </span>
                                        </div>

                                        {refs.length > 0 ? (
                                          <div className="flex flex-wrap gap-1.5">
                                            {refs.map((r) => (
                                              <span
                                                key={r}
                                                className="rounded-md bg-muted/80 px-2 py-0.5 font-mono text-[11px] text-muted-foreground sm:text-xs"
                                              >
                                                {r}
                                              </span>
                                            ))}
                                          </div>
                                        ) : null}

                                        <Separator />

                                        <div className="min-w-0">
                                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            Body
                                          </p>
                                          <AdminCommunityMarkdown
                                            source={p.content}
                                            clamp={false}
                                          />
                                        </div>

                                        {(p.tags ?? []).length > 0 ? (
                                          <div className="flex flex-wrap gap-1.5 pt-1">
                                            {(p.tags ?? []).map((t) => (
                                              <Badge
                                                key={t}
                                                variant="outline"
                                                className="font-normal"
                                              >
                                                {t}
                                              </Badge>
                                            ))}
                                          </div>
                                        ) : null}

                                        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                                          <span className="break-all font-mono text-[11px] text-muted-foreground">
                                            {p.id}
                                          </span>
                                          <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="h-8 gap-1 text-xs"
                                            onClick={() => void copyCommunity(`post:${p.id}`, p.id)}
                                          >
                                            <Copy className="h-3.5 w-3.5" />
                                            {communityCopiedKey === `post:${p.id}`
                                              ? "Copied"
                                              : "Copy ID"}
                                          </Button>
                                        </div>
                                      </div>

                                      <Separator />

                                      <div className="space-y-3">
                                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                          Thread (admin sample)
                                        </p>
                                        {thread.loading ? (
                                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Loading comments and votes…
                                          </div>
                                        ) : thread.error ? (
                                          <p className="text-sm text-destructive">{thread.error}</p>
                                        ) : thread.data ? (
                                          <>
                                            <div className="space-y-1 text-xs text-muted-foreground sm:text-sm">
                                              <p className="tabular-nums">
                                                Comments in DB:{" "}
                                                <span className="font-medium text-foreground">
                                                  {thread.data.comments_total}
                                                </span>
                                                {thread.data.comments_capped ? (
                                                  <span className="ml-1 text-amber-600 dark:text-amber-400">
                                                    (showing newest {thread.data.comments_returned})
                                                  </span>
                                                ) : (
                                                  <span className="ml-1">
                                                    · loaded {thread.data.comments_returned}
                                                  </span>
                                                )}
                                              </p>
                                              <p className="tabular-nums">
                                                Votes in DB:{" "}
                                                <span className="font-medium text-foreground">
                                                  {thread.data.votes_total}
                                                </span>
                                                {thread.data.votes_capped ? (
                                                  <span className="ml-1 text-amber-600 dark:text-amber-400">
                                                    (showing newest {thread.data.votes_returned})
                                                  </span>
                                                ) : (
                                                  <span className="ml-1">
                                                    · loaded {thread.data.votes_returned}
                                                  </span>
                                                )}
                                              </p>
                                            </div>

                                            {thread.data.votes.length > 0 ? (
                                              <div className="overflow-x-auto rounded-lg border">
                                                <Table>
                                                  <TableHeader>
                                                    <TableRow>
                                                      <TableHead className="w-[4rem]">
                                                        Vote
                                                      </TableHead>
                                                      <TableHead>Voter</TableHead>
                                                      <TableHead className="w-[12rem] text-right">
                                                        When
                                                      </TableHead>
                                                    </TableRow>
                                                  </TableHeader>
                                                  <TableBody>
                                                    {thread.data.votes.map((v, idx) => (
                                                      <TableRow
                                                        key={`${v.user_id}-${v.created_at}-${idx}`}
                                                      >
                                                        <TableCell className="tabular-nums font-medium">
                                                          {v.vote > 0
                                                            ? "+1"
                                                            : v.vote < 0
                                                              ? "−1"
                                                              : String(v.vote)}
                                                        </TableCell>
                                                        <TableCell className="max-w-[14rem]">
                                                          <div className="truncate text-sm">
                                                            {v.author_name ?? "—"}{" "}
                                                            <span className="font-mono text-[11px] text-muted-foreground">
                                                              {v.user_id.slice(0, 8)}…
                                                            </span>
                                                            {userId && v.user_id === userId ? (
                                                              <Badge
                                                                variant="outline"
                                                                className="ml-1 text-[10px]"
                                                              >
                                                                This user
                                                              </Badge>
                                                            ) : null}
                                                          </div>
                                                        </TableCell>
                                                        <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                                                          {fmtUpdatedCompact(v.created_at)}
                                                        </TableCell>
                                                      </TableRow>
                                                    ))}
                                                  </TableBody>
                                                </Table>
                                              </div>
                                            ) : (
                                              <p className="text-sm text-muted-foreground">
                                                No votes on this post.
                                              </p>
                                            )}

                                            {thread.data.comments.length > 0 ? (
                                              <div className="space-y-3">
                                                {thread.data.comments.map((c) => (
                                                  <div
                                                    key={c.id}
                                                    className="rounded-lg border bg-muted/30 px-3 py-2.5"
                                                  >
                                                    <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                      <span className="font-mono">
                                                        {c.id.slice(0, 8)}…
                                                      </span>
                                                      {c.parent_id ? (
                                                        <Badge
                                                          variant="outline"
                                                          className="text-[10px]"
                                                        >
                                                          reply
                                                        </Badge>
                                                      ) : null}
                                                      {userId && c.user_id === userId ? (
                                                        <Badge
                                                          variant="secondary"
                                                          className="text-[10px]"
                                                        >
                                                          This user
                                                        </Badge>
                                                      ) : null}
                                                      <span className="ml-auto tabular-nums">
                                                        {fmtUpdatedCompact(c.created_at)}
                                                      </span>
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">
                                                      {c.author_name ?? "Unknown"}{" "}
                                                      <span className="font-mono text-[11px] opacity-80">
                                                        {c.user_id.slice(0, 8)}…
                                                      </span>
                                                    </p>
                                                    <div className="mt-2 min-w-0">
                                                      <AdminCommunityMarkdown
                                                        source={c.body}
                                                        clamp={false}
                                                      />
                                                    </div>
                                                  </div>
                                                ))}
                                              </div>
                                            ) : (
                                              <p className="text-sm text-muted-foreground">
                                                No comments on this post.
                                              </p>
                                            )}
                                          </>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">
                                            No thread data.
                                          </p>
                                        )}
                                      </div>
                                    </>
                                  );
                                })()}
                              </div>
                            </ScrollArea>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="space-y-1 pb-2">
                    <CardTitle className="text-lg">Comments by this user</CardTitle>
                    <CardDescription className="text-sm">
                      Replies they wrote on community posts (often under someone else&apos;s
                      thread). Markdown / LaTeX. Each row shows the parent post title and
                      ids—different from &quot;Community posts&quot; above, which lists content they
                      published.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {filteredCommunityComments.length > COMMUNITY_COMMENT_PAGE_SIZES[0] ? (
                      <div className="flex w-full min-w-0 flex-col gap-2 rounded-xl border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground tabular-nums sm:text-sm">
                          {filteredCommunityComments.length === 0 ? (
                            "No matches."
                          ) : (
                            <>
                              Showing {communityCommentStart + 1}–{communityCommentEndExclusive} of{" "}
                              {filteredCommunityComments.length}
                              {communityQuery.trim()
                                ? ` (filtered from ${communityCommentsRaw.length})`
                                : ""}
                            </>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                            <span className="whitespace-nowrap">Per page</span>
                            <select
                              className="h-8 rounded-md border bg-background px-2 text-xs text-foreground sm:text-sm"
                              value={communityCommentPageSize}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if (n === 10 || n === 15 || n === 25) {
                                  setCommunityCommentPageSize(n);
                                  setCommunityCommentPage(0);
                                }
                              }}
                              aria-label="Comments per page"
                            >
                              {COMMUNITY_COMMENT_PAGE_SIZES.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={communityCommentPageClamped <= 0}
                              onClick={() => setCommunityCommentPage((p) => Math.max(0, p - 1))}
                            >
                              Previous
                            </Button>
                            <span className="min-w-[5.5rem] px-1 text-center text-xs tabular-nums text-muted-foreground sm:text-sm">
                              Page {communityCommentPageClamped + 1} / {communityCommentTotalPages}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={
                                communityCommentPageClamped >= communityCommentTotalPages - 1
                              }
                              onClick={() =>
                                setCommunityCommentPage((p) =>
                                  Math.min(communityCommentTotalPages - 1, p + 1)
                                )
                              }
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : filteredCommunityComments.length > 0 ? (
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {filteredCommunityComments.length} comment(s)
                        {communityQuery.trim()
                          ? ` (filtered from ${communityCommentsRaw.length})`
                          : ""}
                      </p>
                    ) : null}

                    {communityCommentsRaw.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No comments for this user.</p>
                    ) : filteredCommunityComments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No comments match this filter.
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {communityCommentPageRows.map((c) => {
                          const expanded = communityExpandedComments[c.id] ?? false;
                          const parentTitle = communityPostTitleById.get(c.postId);
                          return (
                            <div
                              key={c.id}
                              className="rounded-xl border bg-card/80 px-4 py-3 shadow-sm"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border/60 pb-2">
                                <div className="min-w-0 flex-1 space-y-1">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                    Parent post
                                  </p>
                                  {parentTitle ? (
                                    <p className="text-sm font-medium leading-snug text-foreground">
                                      {parentTitle.length > 140
                                        ? `${parentTitle.slice(0, 140)}…`
                                        : parentTitle}
                                    </p>
                                  ) : (
                                    <p className="text-xs italic text-muted-foreground">
                                      Title not in loaded posts (older or other author thread).
                                    </p>
                                  )}
                                  <p className="font-mono text-[11px] text-muted-foreground break-all">
                                    post_id: {c.postId}
                                  </p>
                                </div>
                                <span className="shrink-0 text-xs text-muted-foreground tabular-nums sm:text-sm whitespace-nowrap">
                                  {new Date(c.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <div className="pt-3">
                                <div className="mb-2 flex justify-end">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs"
                                    onClick={() =>
                                      setCommunityExpandedComments((prev) => ({
                                        ...prev,
                                        [c.id]: !expanded,
                                      }))
                                    }
                                  >
                                    {expanded ? "Collapse" : "Expand full comment"}
                                  </Button>
                                </div>
                                <AdminCommunityMarkdown source={c.body} clamp={!expanded} />
                              </div>
                              <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                                <span className="font-mono text-[11px] text-muted-foreground break-all">
                                  {c.id}
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1 text-xs"
                                  onClick={() => void copyCommunity(`cmt:${c.id}`, c.id)}
                                >
                                  <Copy className="h-3.5 w-3.5" />
                                  {communityCopiedKey === `cmt:${c.id}` ? "Copied" : "Copy ID"}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </TabsContent>

          <Sheet open={savedDetail !== null} onOpenChange={(open) => !open && setSavedDetail(null)}>
            <SheetContent className="w-full sm:max-w-2xl">
              <SheetHeader>
                <SheetTitle>Saved item detail</SheetTitle>
                <SheetDescription className="space-y-1">
                  <span className="block">
                    {savedDetail ? `${savedKindLabel(savedDetail.kind)} · ${savedDetail.subjectLabel}` : ""}
                  </span>
                  {savedDetail?.subtitle ? (
                    <span className="block text-xs text-muted-foreground">{savedDetail.subtitle}</span>
                  ) : null}
                </SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {savedDetail ? (
                  <>
                    <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Summary
                      </p>

                      {savedDetail.kind === "bit" ? (
                        (() => {
                          const b = savedDetail.raw as {
                            question?: string;
                            options?: string[];
                            correctAnswer?: number;
                            solution?: string;
                          };
                          const options = Array.isArray(b.options) ? b.options : [];
                          const correctIdx =
                            typeof b.correctAnswer === "number" ? b.correctAnswer : null;
                          return (
                            <div className="space-y-3">
                              <div className="rounded-md border bg-background/60 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                  Question
                                </p>
                                <div className="text-[13px] leading-relaxed">
                                  <PlayQuestionMarkdown variant="stem" source={b.question ?? savedDetail.title} />
                                </div>
                              </div>

                              {options.length ? (
                                <div className="rounded-md border bg-background/60 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                    Options
                                  </p>
                                  <ol className="space-y-2 pl-4 text-[13px] leading-relaxed">
                                    {options.map((opt, i) => (
                                      <li
                                        key={`${i}:${opt.slice(0, 12)}`}
                                        className={cn(
                                          "rounded-md px-2 py-1.5",
                                          correctIdx === i
                                            ? "bg-emerald-500/[0.08] border border-emerald-500/30"
                                            : "bg-transparent"
                                        )}
                                      >
                                        <PlayQuestionMarkdown variant="option" source={opt} />
                                      </li>
                                    ))}
                                  </ol>
                                  {correctIdx !== null ? (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      Correct option:{" "}
                                      <span className="font-semibold text-foreground tabular-nums">
                                        {correctIdx + 1}
                                      </span>
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}

                              {b.solution?.trim() ? (
                                <div className="rounded-md border bg-background/60 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                    Explanation
                                  </p>
                                  <div className="text-[13px] leading-relaxed">
                                    <PlayQuestionMarkdown variant="explanation" source={b.solution} />
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          );
                        })()
                      ) : savedDetail.kind === "instacue_card" ? (
                        (() => {
                          const c = savedDetail.raw as {
                            type?: string;
                            status?: string;
                            frontContent?: string;
                            backContent?: string;
                            savedAt?: string;
                          };
                          const front = c.frontContent ?? savedDetail.title;
                          const back = c.backContent ?? "";
                          return (
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                {c.type ? (
                                  <Badge variant="outline" className="text-[10px] capitalize">
                                    {c.type.replace(/_/g, " ")}
                                  </Badge>
                                ) : null}
                                {c.status ? (
                                  <Badge variant="secondary" className="text-[10px] capitalize">
                                    {c.status.replace(/_/g, " ")}
                                  </Badge>
                                ) : null}
                                {c.savedAt ? (
                                  <span className="text-[11px] text-muted-foreground tabular-nums">
                                    Saved {fmtUpdatedCompact(c.savedAt)}
                                  </span>
                                ) : null}
                              </div>

                              <div className="rounded-md border bg-background/60 p-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                  Front
                                </p>
                                <div className="text-[13px] leading-relaxed">
                                  <PlayQuestionMarkdown variant="stem" source={front} />
                                </div>
                              </div>

                              {back.trim() ? (
                                <div className="rounded-md border bg-background/60 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                                    Back
                                  </p>
                                  <div className="text-[13px] leading-relaxed">
                                    <PlayQuestionMarkdown variant="explanation" source={back} />
                                  </div>
                                </div>
                              ) : (
                                <p className="text-[11px] text-muted-foreground">No back content saved.</p>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <div className="rounded-md border bg-background/60 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                            Title / Front
                          </p>
                          <p className="text-[13px] font-semibold leading-relaxed text-foreground whitespace-pre-wrap">
                            {savedDetail.title}
                          </p>
                        </div>
                      )}
                    </div>

                    <Collapsible>
                      <div className="rounded-lg border bg-muted/20 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Raw JSON (advanced)
                          </p>
                          <CollapsibleTrigger asChild>
                            <Button type="button" variant="outline" size="sm" className="h-8">
                              Show / hide JSON
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent className="mt-3">
                          <pre className="max-h-[60vh] overflow-auto rounded-md border bg-background/60 p-3 text-[11px]">
                            {JSON.stringify(savedDetail.raw, null, 2)}
                          </pre>
                        </CollapsibleContent>
                      </div>
                    </Collapsible>
                  </>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>

          <TabsContent value="play" className="mt-4 space-y-4">
            {insightsError ? (
              <p className="text-sm text-destructive">{insightsError}</p>
            ) : studentInsights ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Play answers (total)</CardDescription>
                      <CardTitle>{studentInsights.playArena.playHistoryTotal}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Arena streak (gauntlet days)</CardDescription>
                      <CardTitle>{studentInsights.playArena.arenaStreakDays}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card size="sm">
                    <CardHeader className="pb-2">
                      <CardDescription>Gauntlet attempts loaded</CardDescription>
                      <CardTitle>
                        {studentInsights.playArena.dailyGauntletAttempts.length}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">User play stats by category</CardTitle>
                  </CardHeader>
                  <CardContent className="rounded-xl border overflow-x-auto p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead>Rating</TableHead>
                          <TableHead>Answered</TableHead>
                          <TableHead>Win streak</TableHead>
                          <TableHead>Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {studentInsights.playArena.userPlayStats.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-muted-foreground">
                              No rows.
                            </TableCell>
                          </TableRow>
                        ) : (
                          studentInsights.playArena.userPlayStats.map((s) => (
                            <TableRow key={`${s.user_id}-${s.category}`}>
                              <TableCell className="text-xs">{s.category}</TableCell>
                              <TableCell className="text-xs">{s.current_rating}</TableCell>
                              <TableCell className="text-xs">{s.questions_answered}</TableCell>
                              <TableCell className="text-xs">{s.win_streak}</TableCell>
                              <TableCell className="text-xs whitespace-nowrap">
                                {new Date(s.updated_at).toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="space-y-1">
                    <CardTitle className="text-lg">Play sessions</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {playSessionsInferenceNote} Each row is one inferred sitting (answers clustered by
                      ~25&nbsp;min gaps). Open a session to see every question in playback order; click a
                      question for full stems, choices, and explanation. The pager steps through{" "}
                      <strong>sessions</strong>, not individual attempts, so the grid stays fast even when
                      stored attempts grow very large. Loaded snapshot: up to {playHistoryLoadedCount}{" "}
                      attempts ({playHistoryDbTotal} total in database).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {playSessionLoadedCount > PLAY_SESSION_PAGE_SIZES[0] ? (
                      <div className="flex w-full min-w-0 flex-col gap-2 rounded-xl border bg-muted/30 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-xs text-muted-foreground tabular-nums sm:text-sm">
                          {playSessionLoadedCount === 0 ? (
                            "No sessions."
                          ) : (
                            <>
                              Showing sessions {playSessionStart + 1}–{playSessionEndExclusive} of{" "}
                              {playSessionLoadedCount}
                              {playHistoryDbTotal > playHistoryLoadedCount ? (
                                <span className="text-muted-foreground/90">
                                  {" "}
                                  ({playHistoryDbTotal} total attempts in database; snapshot capped)
                                </span>
                              ) : null}
                            </>
                          )}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="flex items-center gap-1.5 text-xs text-muted-foreground sm:text-sm">
                            <span className="whitespace-nowrap">Sessions per page</span>
                            <select
                              className="h-8 rounded-md border bg-background px-2 text-xs text-foreground sm:text-sm"
                              value={playSessionPageSize}
                              onChange={(e) => {
                                const n = Number(e.target.value);
                                if ((PLAY_SESSION_PAGE_SIZES as readonly number[]).includes(n)) {
                                  setPlaySessionPageSize(
                                    n as (typeof PLAY_SESSION_PAGE_SIZES)[number]
                                  );
                                  setPlaySessionPage(0);
                                }
                              }}
                              aria-label="Play sessions per page"
                            >
                              {PLAY_SESSION_PAGE_SIZES.map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={playSessionPageClamped <= 0}
                              onClick={() => setPlaySessionPage((p) => Math.max(0, p - 1))}
                            >
                              Previous
                            </Button>
                            <span className="min-w-[5.5rem] px-1 text-center text-xs tabular-nums text-muted-foreground sm:text-sm">
                              Page {playSessionPageClamped + 1} / {playSessionTotalPages}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8"
                              disabled={playSessionPageClamped >= playSessionTotalPages - 1}
                              onClick={() =>
                                setPlaySessionPage((p) =>
                                  Math.min(playSessionTotalPages - 1, p + 1)
                                )
                              }
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : playHistoryLoadedCount > 0 ? (
                      <p className="text-xs text-muted-foreground sm:text-sm">
                        {playSessionLoadedCount} session(s) from {playHistoryLoadedCount} loaded attempt(s)
                        {playHistoryDbTotal > playHistoryLoadedCount ? (
                          <span> · {playHistoryDbTotal} total attempts in database</span>
                        ) : null}
                      </p>
                    ) : null}
                    <div className="rounded-xl border overflow-x-auto p-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="whitespace-nowrap text-sm font-semibold">
                              Last activity
                            </TableHead>
                            <TableHead className="hidden sm:table-cell whitespace-nowrap text-sm font-semibold">
                              Started
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-sm font-semibold tabular-nums">
                              Duration
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-sm font-semibold tabular-nums">
                              Qs
                            </TableHead>
                            <TableHead className="whitespace-nowrap text-sm font-semibold tabular-nums">
                              Score
                            </TableHead>
                            <TableHead className="hidden md:table-cell min-w-[120px] text-sm font-semibold">
                              Mode
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {playHistoryLoadedCount === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-muted-foreground">
                                None.
                              </TableCell>
                            </TableRow>
                          ) : (
                            playSessionPageRows.map((sess) => {
                              const modes = playSessionDistinctModeLabels(sess);
                              return (
                                <TableRow
                                  key={sess.id}
                                  role="button"
                                  tabIndex={0}
                                  className="cursor-pointer hover:bg-muted/40"
                                  onClick={() => {
                                    setPlayAttemptDetail(null);
                                    setPlaySessionDetail(sess);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                      e.preventDefault();
                                      setPlayAttemptDetail(null);
                                      setPlaySessionDetail(sess);
                                    }
                                  }}
                                >
                                  <TableCell className="whitespace-nowrap align-top text-sm tabular-nums text-muted-foreground">
                                    {new Date(sess.endedAt).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="hidden sm:table-cell whitespace-nowrap align-top text-sm tabular-nums text-muted-foreground">
                                    {new Date(sess.startedAt).toLocaleString()}
                                  </TableCell>
                                  <TableCell className="align-top text-sm tabular-nums">
                                    {formatPlaySessionDuration(sess.startedAt, sess.endedAt)}
                                  </TableCell>
                                  <TableCell className="align-top text-sm tabular-nums font-medium">
                                    {sess.attemptCount}
                                  </TableCell>
                                  <TableCell className="align-top text-sm tabular-nums">
                                    <span className="text-emerald-600 dark:text-emerald-400">
                                      {sess.correctCount}
                                    </span>
                                    <span className="text-muted-foreground"> / </span>
                                    <span>{sess.attemptCount}</span>
                                  </TableCell>
                                  <TableCell className="hidden md:table-cell align-top">
                                    <div className="flex flex-wrap gap-1">
                                      {modes.length === 0 ? (
                                        <span className="text-xs text-muted-foreground">—</span>
                                      ) : (
                                        modes.slice(0, 3).map((m) => (
                                          <Badge
                                            key={m}
                                            variant="outline"
                                            className="text-[10px] font-normal"
                                          >
                                            {m}
                                          </Badge>
                                        ))
                                      )}
                                      {modes.length > 3 ? (
                                        <Badge variant="secondary" className="text-[10px]">
                                          +{modes.length - 3}
                                        </Badge>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                </TableRow>
                              );
                            })
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>

                <Sheet
                  open={playSessionDetail !== null}
                  onOpenChange={(open) => {
                    if (!open) {
                      setPlaySessionDetail(null);
                      setPlayAttemptDetail(null);
                    }
                  }}
                >
                  <SheetContent
                    side="right"
                    className="flex w-full min-w-0 flex-col overflow-x-hidden overflow-y-auto sm:max-w-3xl lg:max-w-4xl"
                  >
                    {playSessionDetail ? (
                      <>
                        <SheetHeader>
                          <SheetTitle>Play session</SheetTitle>
                          <SheetDescription className="space-y-1">
                            <span className="block tabular-nums">
                              {new Date(playSessionDetail.startedAt).toLocaleString()} →{" "}
                              {new Date(playSessionDetail.endedAt).toLocaleString()}
                            </span>
                            <span className="block font-medium text-foreground">
                              {formatPlaySessionDuration(
                                playSessionDetail.startedAt,
                                playSessionDetail.endedAt
                              )}{" "}
                              · {playSessionDetail.attemptCount} question
                              {playSessionDetail.attemptCount === 1 ? "" : "s"} ·{" "}
                              <span className="text-emerald-600 dark:text-emerald-400">
                                {playSessionDetail.correctCount}
                              </span>
                              {" correct"}
                              {playSessionDetail.wrongCount > 0
                                ? ` · ${playSessionDetail.wrongCount} wrong`
                                : null}
                            </span>
                            <span className="flex flex-wrap gap-2 pt-1">
                              {playSessionDistinctModeLabels(playSessionDetail).map((m) => (
                                <Badge key={m} variant="outline" className="text-[10px]">
                                  {m}
                                </Badge>
                              ))}
                            </span>
                          </SheetDescription>
                        </SheetHeader>
                        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                          Playback order for this sitting. Select a row for the full question, MCQ options,
                          and explanation (same panel as before).
                        </p>
                        <div className="mt-4 min-h-0 max-w-full flex-1 touch-pan-y rounded-xl border pb-2 min-w-0 overflow-x-hidden overflow-y-visible">
                          <Table className="w-full min-w-0 table-fixed">
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-8 px-1 text-sm font-semibold tabular-nums">
                                  #
                                </TableHead>
                                <TableHead className="w-[7.5rem] whitespace-nowrap text-sm font-semibold sm:w-[8.5rem]">
                                  When
                                </TableHead>
                                <TableHead className="hidden w-[6.5rem] text-sm font-semibold md:table-cell">
                                  Mode
                                </TableHead>
                                <TableHead className="w-[4.5rem] text-sm font-semibold">Result</TableHead>
                                <TableHead className="w-[4rem] text-sm font-semibold">ms</TableHead>
                                <TableHead className="min-w-0 text-sm font-semibold">Stem</TableHead>
                                <TableHead className="hidden w-[11rem] min-w-0 text-xs font-semibold sm:table-cell">
                                  Chosen / correct
                                </TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {playSessionDetail.attempts.map((h: PlayAttemptRow, idx: number) => {
                                const q = h.question;
                                const chosenIdx = h.selected_answer_index;
                                const chosenInRange =
                                  q != null &&
                                  chosenIdx != null &&
                                  chosenIdx >= 0 &&
                                  chosenIdx < q.options.length;
                                const chosenLetter =
                                  chosenInRange && chosenIdx != null
                                    ? playAttemptMcqLetter(chosenIdx)
                                    : null;
                                const chosenMd =
                                  chosenInRange && chosenIdx != null
                                    ? (q?.options[chosenIdx] ?? null)
                                    : null;

                                const corrIdx = q?.correct_answer_index;
                                const correctInRange =
                                  q != null &&
                                  corrIdx != null &&
                                  corrIdx >= 0 &&
                                  corrIdx < q.options.length;
                                const correctLetter =
                                  correctInRange && corrIdx != null
                                    ? playAttemptMcqLetter(corrIdx)
                                    : null;
                                const correctMd =
                                  correctInRange && corrIdx != null
                                    ? (q?.options[corrIdx] ?? null)
                                    : null;

                                return (
                                  <TableRow
                                    key={h.id}
                                    role="button"
                                    tabIndex={0}
                                    className="cursor-pointer hover:bg-muted/40"
                                    onClick={() => {
                                      setPlayAttemptDetail(h);
                                    }}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        setPlayAttemptDetail(h);
                                      }
                                    }}
                                  >
                                    <TableCell className="align-top px-1 text-sm tabular-nums text-muted-foreground">
                                      {idx + 1}
                                    </TableCell>
                                    <TableCell className="align-top text-xs tabular-nums text-muted-foreground sm:text-sm whitespace-nowrap">
                                      <span className="hidden sm:inline">
                                        {new Date(h.created_at).toLocaleString()}
                                      </span>
                                      <span className="sm:hidden">{fmtUpdatedCompact(h.created_at)}</span>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell align-top text-sm text-muted-foreground">
                                      {h.session_label ?? q?.category ?? "—"}
                                    </TableCell>
                                    <TableCell className="align-top py-2">
                                      <Badge
                                        variant={h.is_correct ? "secondary" : "destructive"}
                                        className="text-xs font-semibold px-2.5 py-0.5"
                                      >
                                        {h.is_correct ? "Correct" : "Wrong"}
                                      </Badge>
                                    </TableCell>
                                    <TableCell className="align-top py-2 text-sm tabular-nums font-medium">
                                      {h.time_taken_ms ?? "—"}
                                    </TableCell>
                                    <TableCell className="min-w-0 align-top py-2">
                                      <PlayAttemptStemOneLine row={h} />
                                      <div className="mt-1.5 text-xs text-muted-foreground sm:hidden">
                                        <span className="font-semibold text-muted-foreground">Chosen: </span>
                                        <PlayAttemptOptionOneLine
                                          letter={chosenLetter}
                                          optionMarkdown={chosenMd}
                                          fallbackPlain={chosenMd ? null : h.chosen_preview}
                                        />
                                      </div>
                                    </TableCell>
                                    <TableCell className="hidden min-w-0 align-top py-2 sm:table-cell">
                                      <div className="space-y-1.5 text-[11px] leading-snug">
                                        <div className="min-w-0">
                                          <span className="font-semibold text-muted-foreground">Chosen: </span>
                                          <PlayAttemptOptionOneLine
                                            letter={chosenLetter}
                                            optionMarkdown={chosenMd}
                                            fallbackPlain={chosenMd ? null : h.chosen_preview}
                                          />
                                        </div>
                                        <div className="min-w-0">
                                          <span className="font-semibold text-muted-foreground">Correct: </span>
                                          <PlayAttemptOptionOneLine
                                            letter={correctLetter}
                                            optionMarkdown={correctMd}
                                            fallbackPlain={correctMd ? null : h.correct_preview}
                                          />
                                        </div>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        <Collapsible className="mt-4 border-t pt-4">
                          <CollapsibleTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 w-full justify-between gap-2 font-normal [&[data-state=open]>svg]:rotate-180"
                            >
                              <span className="text-xs font-medium">Extended audit (optional)</span>
                              <ChevronDown className="h-4 w-4 shrink-0 opacity-70 transition-transform duration-200" />
                            </Button>
                          </CollapsibleTrigger>
                          <CollapsibleContent className="mt-3">
                            <PlaySessionExtendedAuditPanel
                              session={playSessionDetail}
                              inferenceNote={playSessionsInferenceNote}
                            />
                          </CollapsibleContent>
                        </Collapsible>
                      </>
                    ) : null}
                  </SheetContent>
                </Sheet>

                <Sheet
                  open={playAttemptDetail !== null}
                  onOpenChange={(open) => {
                    if (!open) setPlayAttemptDetail(null);
                  }}
                >
                  <SheetContent
                    side="right"
                    className="z-[60] flex h-full w-full flex-col sm:max-w-xl overflow-y-auto"
                  >
                    {playAttemptDetail ? (
                      <>
                        <SheetHeader>
                          <SheetTitle>Play attempt detail</SheetTitle>
                          <SheetDescription className="space-y-1">
                            <span className="block">
                              {new Date(playAttemptDetail.created_at).toLocaleString()}
                            </span>
                            {playAttemptDetail.question ? (
                              <span className="block font-medium text-foreground">
                                {playAttemptDetail.question.domain} ·{" "}
                                {playAttemptDetail.question.category}
                              </span>
                            ) : (
                              <span className="block text-amber-600 dark:text-amber-400">
                                Question row missing (deleted or unavailable).
                              </span>
                            )}
                            <span className="flex flex-wrap gap-2 pt-1">
                              <Badge
                                variant={playAttemptDetail.is_correct ? "secondary" : "destructive"}
                              >
                                {playAttemptDetail.is_correct
                                  ? "Marked correct"
                                  : "Marked incorrect"}
                              </Badge>
                              {playAttemptDetail.session_label ? (
                                <Badge variant="outline">{playAttemptDetail.session_label}</Badge>
                              ) : null}
                            </span>
                          </SheetDescription>
                        </SheetHeader>
                        <div className="mt-6 space-y-6 text-sm">
                          <div>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Question
                            </p>
                            {playAttemptDetail.question ? (
                              <PlayQuestionMarkdown
                                variant="stem"
                                source={playQuestionStemMarkdownSource(
                                  playAttemptDetail.question.content
                                )}
                              />
                            ) : (
                              <p className="text-muted-foreground">No stem available.</p>
                            )}
                          </div>
                          {playAttemptDetail.question &&
                          playAttemptDetail.question.options.length > 0 ? (
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Options
                              </p>
                              <ul className="space-y-2">
                                {playAttemptDetail.question.options.map((opt, i) => {
                                  const letter = i < 26 ? String.fromCharCode(65 + i) : `#${i + 1}`;
                                  const isPicked = playAttemptDetail.selected_answer_index === i;
                                  const isRight =
                                    playAttemptDetail.question!.correct_answer_index === i;
                                  return (
                                    <li
                                      key={`${playAttemptDetail.id}-opt-${i}`}
                                      className={`rounded-lg border px-3 py-2 ${
                                        isPicked && isRight
                                          ? "border-emerald-500/60 bg-emerald-500/10"
                                          : isPicked
                                            ? "border-amber-500/60 bg-amber-500/10"
                                            : isRight
                                              ? "border-emerald-500/40 bg-emerald-500/5"
                                              : "border-border/60 bg-muted/20"
                                      }`}
                                    >
                                      <div className="mb-1 flex flex-wrap gap-2">
                                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                                          {letter}
                                        </span>
                                        {isPicked ? (
                                          <Badge variant="outline" className="text-[10px]">
                                            Student
                                          </Badge>
                                        ) : null}
                                        {isRight ? (
                                          <Badge variant="secondary" className="text-[10px]">
                                            Correct
                                          </Badge>
                                        ) : null}
                                      </div>
                                      <PlayQuestionMarkdown variant="option" source={opt} />
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ) : null}
                          {playAttemptDetail.question?.explanation ? (
                            <div>
                              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Explanation
                              </p>
                              <PlayQuestionMarkdown
                                variant="explanation"
                                source={playAttemptDetail.question.explanation}
                              />
                            </div>
                          ) : null}
                          <div className="rounded-lg border bg-muted/30 p-3 font-mono text-[10px] text-muted-foreground break-all">
                            question_id: {playAttemptDetail.question_id}
                          </div>
                        </div>
                      </>
                    ) : null}
                  </SheetContent>
                </Sheet>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </TabsContent>

          <TabsContent value="refer" className="mt-4 space-y-4">
            {insightsError ? (
              <p className="text-sm text-destructive">{insightsError}</p>
            ) : studentInsights ? (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Earn &amp; Learn — challenge claims</CardTitle>
                    <CardDescription className="text-xs leading-relaxed sm:text-sm">
                      Rows come from <span className="font-mono">refer_challenge_claims</span>: one row per{" "}
                      <span className="font-medium text-foreground">calendar day (UTC)</span> and{" "}
                      <span className="font-medium text-foreground">challenge tier</span> (keys{" "}
                      <span className="font-mono">5 / 10 / 20 / 50</span> mean max bundle size in RDM for that tier,
                      e.g. MentaMill Blitz vs Academic Arena Pro).{" "}
                      <span className="font-medium text-foreground">Win</span> = quiz-pass reward claimed;{" "}
                      <span className="font-medium text-foreground">Share</span> = share/post reward claimed. Daily
                      totals are capped in product logic (50 RDM/day across these claims). Admin loads up to{" "}
                      <span className="font-mono">120</span> newest rows by claim date.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-3 border-t pt-3 text-sm">
                    <span className="text-muted-foreground">
                      Rows loaded:{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {studentInsights.referEarn.claims.length}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      RDM from wins + shares (this snapshot):{" "}
                      <span className="font-semibold tabular-nums text-foreground">
                        {studentInsights.referEarn.claims.reduce((s, c) => s + referClaimEarnedRdm(c, rdmConfig), 0)}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      Tier keys with ≥1 row:{" "}
                      <span className="font-semibold font-mono text-foreground">
                        {referEarnClaimsAggregate.distinctTierKeys.length === 0
                          ? "—"
                          : referEarnClaimsAggregate.distinctTierKeys.join(", ")}
                      </span>
                    </span>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">All four tiers — verification</CardTitle>
                    <CardDescription className="text-xs leading-relaxed">
                      Rows are created only when the student runs the claim RPC for that tier on that UTC day (see{" "}
                      <span className="font-mono">claim_refer_challenge_reward</span>). Playing FunBrain / Academic
                      refer challenges without claiming does not show here.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 border-t pt-3">
                    <div className="overflow-x-auto rounded-lg border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs whitespace-nowrap">Key</TableHead>
                            <TableHead className="text-xs">Challenge name</TableHead>
                            <TableHead className="text-right text-xs whitespace-nowrap">Rows</TableHead>
                            <TableHead className="text-right text-xs whitespace-nowrap">RDM Σ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {getReferChallengeSpecs(rdmConfig ?? DEFAULT_RDM_CONFIG).map((spec) => {
                            const rows = referEarnClaimsAggregate.counts.get(spec.key) ?? 0;
                            const rdm = studentInsights.referEarn.claims
                              .filter((c) => c.challenge_key === spec.key)
                              .reduce((s, c) => s + referClaimEarnedRdm(c, rdmConfig), 0);
                            return (
                              <TableRow key={spec.key}>
                                <TableCell className="font-mono text-xs">{spec.key}</TableCell>
                                <TableCell className="text-xs">{spec.name}</TableCell>
                                <TableCell className="text-right text-xs tabular-nums">{rows}</TableCell>
                                <TableCell className="text-right text-xs font-medium tabular-nums">
                                  {rdm > 0 ? `+${rdm}` : "0"}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      <span className="font-medium text-foreground">Answer for support:</span> If only key{" "}
                      <span className="font-mono">5</span> has rows (MentaMill Blitz), this snapshot has{" "}
                      <span className="font-medium text-foreground">no database evidence</span> of refer claim activity
                      for keys <span className="font-mono">10</span>, <span className="font-mono">20</span>, or{" "}
                      <span className="font-mono">50</span>. Older rows could fall off the 120-row cap, but missing tiers
                      usually means those claims never ran.
                    </p>
                  </CardContent>
                </Card>
                <p className="mb-2 text-[11px] leading-snug text-muted-foreground">
                  Click a row to open a detailed sheet: quiz attempts matched from{" "}
                  <span className="font-mono">play_history</span> (time-window heuristic) and community posts from the
                  refer share flow when available.
                </p>
                <div className="rounded-xl border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Claim date (UTC)</TableHead>
                        <TableHead>Challenge</TableHead>
                        <TableHead className="whitespace-nowrap">Win</TableHead>
                        <TableHead className="whitespace-nowrap">Share</TableHead>
                        <TableHead className="text-right whitespace-nowrap">RDM row</TableHead>
                        <TableHead className="whitespace-nowrap">Win claimed at</TableHead>
                        <TableHead className="whitespace-nowrap">Share claimed at</TableHead>
                        <TableHead className="whitespace-nowrap">Row updated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {studentInsights.referEarn.claims.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-muted-foreground">
                            No refer challenge claim rows.
                          </TableCell>
                        </TableRow>
                      ) : (
                        studentInsights.referEarn.claims.map((c) => {
                          const spec = referChallengeSpec(
                            c.challenge_key as ReferClaimKey,
                            rdmConfig ?? DEFAULT_RDM_CONFIG
                          );
                          const earned = referClaimEarnedRdm(c, rdmConfig);
                          return (
                            <TableRow
                              key={`${c.claim_date}-${c.challenge_key}`}
                              className="cursor-pointer hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                              tabIndex={0}
                              role="button"
                              aria-label={`Open refer challenge detail for ${spec?.name ?? c.challenge_key} on ${c.claim_date}`}
                              onClick={() => openReferClaimDetail(c)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                  e.preventDefault();
                                  openReferClaimDetail(c);
                                }
                              }}
                            >
                              <TableCell className="align-top text-xs tabular-nums">{c.claim_date}</TableCell>
                              <TableCell className="align-top text-xs min-w-[10rem] max-w-[18rem]">
                                <div className="font-medium text-foreground">{spec?.name ?? "Unknown tier"}</div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                                  <Badge variant="outline" className="font-mono text-[10px]">
                                    key:{c.challenge_key}
                                  </Badge>
                                  {spec ? (
                                    <span className="text-[10px] text-muted-foreground">
                                      max {spec.totalRdm} RDM/day tier · up to +{spec.winRdm} win / +{spec.shareRdm}{" "}
                                      share
                                    </span>
                                  ) : null}
                                </div>
                              </TableCell>
                              <TableCell className="align-top text-xs whitespace-nowrap">
                                {c.win_claimed ? (
                                  <span className="text-emerald-700 dark:text-emerald-400">
                                    yes{spec ? ` (+${spec.winRdm})` : ""}
                                  </span>
                                ) : (
                                  "no"
                                )}
                              </TableCell>
                              <TableCell className="align-top text-xs whitespace-nowrap">
                                {c.share_claimed ? (
                                  <span className="text-emerald-700 dark:text-emerald-400">
                                    yes{spec ? ` (+${spec.shareRdm})` : ""}
                                  </span>
                                ) : (
                                  "no"
                                )}
                              </TableCell>
                              <TableCell className="align-top text-right text-xs font-semibold tabular-nums">
                                {earned > 0 ? `+${earned}` : "0"}
                              </TableCell>
                              <TableCell className="align-top text-[11px] text-muted-foreground whitespace-nowrap">
                                {fmtIsoOrDash(c.win_claimed_at)}
                              </TableCell>
                              <TableCell className="align-top text-[11px] text-muted-foreground whitespace-nowrap">
                                {fmtIsoOrDash(c.share_claimed_at)}
                              </TableCell>
                              <TableCell className="align-top text-[11px] text-muted-foreground whitespace-nowrap">
                                {fmtIsoOrDash(c.updated_at)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )}
          </TabsContent>
        </Tabs>
        <Sheet
          open={referClaimSheet !== null}
          onOpenChange={(open) => {
            if (!open) setReferClaimSheet(null);
          }}
        >
          <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
            {referClaimSheet ? (
              <AdminReferChallengeSessionSheetInner
                selection={referClaimSheet}
                loadState={referSessionLoad}
                rdmConfig={rdmConfig}
              />
            ) : null}
          </SheetContent>
        </Sheet>
        <Sheet
          open={gyanDoubtDetail !== null}
          onOpenChange={(open) => {
            if (!open) setGyanDoubtDetail(null);
          }}
        >
          <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
            {gyanDoubtDetail ? <AdminGyanDoubtSheetInner d={gyanDoubtDetail} /> : null}
          </SheetContent>
        </Sheet>
      </>
      ) : null}
    </div>
  );
}
