/**
 * Student admin insights: relational aggregates + subtopic engagement JSON + dwell telemetry rollups.
 */
import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/auth/apiAuth";
import { isAdminUser } from "@/lib/admin/admin";
import {
  buildSubtopicInsightRows,
  MAX_CLASSROOM_PROGRESS_ROWS,
  MAX_COMMUNITY_ITEMS,
  MAX_CHAT_MESSAGES,
  MAX_DOUBTS_LIST,
  mergeDwellIntoSubtopicRows,
  rollupDwellEvents,
  STUDENT_DWELL_TELEMETRY_NOTE,
} from "@/lib/admin/adminStudentInsights";
import { createAdminClient } from "@/integrations/supabase/server";
import { computeStreakDays } from "@/lib/dashboard/gauntletStreak";
import type { Json } from "@/integrations/supabase/types";
import type {
  SavedBit,
  SavedCommunityPost,
  SavedFormula,
  SavedRevisionCard,
  SavedRevisionUnit,
} from "@/types";
import {
  formatMcqChoiceLabel,
  parsePlayQuestionOptions,
  playQuestionStemPlain,
  poolKeyLabel,
} from "@/lib/admin/adminPlayQuestionPreview";
import { isAiTutorAnswer, type ExpandedAnswer } from "@/components/doubts/doubtTypes";
import {
  buildPlaySessionsFromAttempts,
  PLAY_SESSION_INFERENCE_NOTE,
} from "@/lib/admin/adminPlaySessions";
import { computeStudyStreakFromDayMs } from "@/lib/dashboard/studyStreakClient";
import type { TopicNode } from "@/data/topicTaxonomy";
import {
  buildChapterCompletionRowsByRecentActivity,
  type ChapterCompletionRow,
} from "@/lib/dashboard/dashboardChapterCompletion";
import { parseBitsTestAttemptsStore } from "@/lib/play/bits/parseBitsTestAttemptsStore";
import { parseEngagementDraftDashboardContributions } from "@/lib/dashboard/parseEngagementDraftDashboardContributions";
import {
  buildBitsQuizRollupForAdmin,
  parseBitsTestAttemptsKeyed,
} from "@/lib/admin/adminBitsQuizInsights";

/** Full doubt payload for admin Gyan++ sheet (avoid huge rows). */
const MAX_DOUBT_TITLE_CHARS = 4000;
const MAX_DOUBT_BODY_CHARS = 48000;
const MAX_ANSWER_BODY_CHARS = 32000;
const MAX_ANSWERS_PER_DOUBT = 48;

const MAX_SAVED_BITS = 200;
const MAX_SAVED_FORMULAS = 120;
const MAX_SAVED_REVISION_CARDS = 200;
const MAX_SAVED_REVISION_UNITS = 200;
const MAX_SAVED_COMMUNITY_POSTS = 120;

const MAX_SAVED_TEXT_CHARS = 1600;

function safeStr(value: unknown, maxLen = MAX_SAVED_TEXT_CHARS): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

function sanitizeSavedBits(raw: unknown): SavedBit[] {
  const rows = Array.isArray(raw) ? (raw as unknown[]) : [];
  return rows.slice(0, MAX_SAVED_BITS).map((r, idx): SavedBit => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      id: safeStr(o.id, 200) || `saved-bit:${idx}`,
      question: safeStr(o.question),
      options: Array.isArray(o.options) ? (o.options as unknown[]).map((x) => safeStr(x, 420)) : [],
      correctAnswer: Number(o.correctAnswer ?? 0) || 0,
      solution: safeStr(o.solution) || undefined,
      subject: safeStr(o.subject, 30).toLowerCase() as SavedBit["subject"],
      topic: safeStr(o.topic, 300),
      subtopicName: safeStr(o.subtopicName, 300),
      classLevel: (Number(o.classLevel) === 12 ? 12 : 11) as SavedBit["classLevel"],
      unitName: safeStr(o.unitName, 300) || undefined,
      level: safeStr(o.level, 30) || undefined,
      board: (safeStr(o.board, 10) as SavedBit["board"]) || undefined,
      sectionIndex: Number.isFinite(Number(o.sectionIndex))
        ? (Number(o.sectionIndex) as number)
        : undefined,
      formulaName: safeStr(o.formulaName, 240) || undefined,
      formulaLatex: safeStr(o.formulaLatex, 1200) || undefined,
    };
  });
}

function sanitizeSavedFormulas(raw: unknown): SavedFormula[] {
  const rows = Array.isArray(raw) ? (raw as unknown[]) : [];
  return rows.slice(0, MAX_SAVED_FORMULAS).map((r, idx): SavedFormula => {
    const o = (r ?? {}) as Record<string, unknown>;
    const bits = Array.isArray(o.bitsQuestions) ? (o.bitsQuestions as unknown[]) : [];
    return {
      id: safeStr(o.id, 200) || `saved-formula:${idx}`,
      name: safeStr(o.name, 240),
      formulaLatex: safeStr(o.formulaLatex, 1400) || undefined,
      description: safeStr(o.description, 2400) || undefined,
      bitsQuestions: bits.slice(0, 30).map((b) => {
        const bo = (b ?? {}) as Record<string, unknown>;
        return {
          question: safeStr(bo.question),
          options: Array.isArray(bo.options)
            ? (bo.options as unknown[]).map((x) => safeStr(x, 420))
            : [],
          correctAnswer: Number(bo.correctAnswer ?? 0) || 0,
          solution: safeStr(bo.solution) || undefined,
        };
      }),
      subject: safeStr(o.subject, 30).toLowerCase() as SavedFormula["subject"],
      topic: safeStr(o.topic, 300),
      subtopicName: safeStr(o.subtopicName, 300),
      classLevel: (Number(o.classLevel) === 12 ? 12 : 11) as SavedFormula["classLevel"],
      unitName: safeStr(o.unitName, 300) || undefined,
      level: safeStr(o.level, 30) || undefined,
      board: (safeStr(o.board, 10) as SavedFormula["board"]) || undefined,
      sectionIndex: Number.isFinite(Number(o.sectionIndex))
        ? (Number(o.sectionIndex) as number)
        : undefined,
    };
  });
}

function sanitizeSavedRevisionCards(raw: unknown): SavedRevisionCard[] {
  const rows = Array.isArray(raw) ? (raw as unknown[]) : [];
  return rows.slice(0, MAX_SAVED_REVISION_CARDS).map((r, idx): SavedRevisionCard => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      id: safeStr(o.id, 200) || `saved-card:${idx}`,
      type: safeStr(o.type, 30) as SavedRevisionCard["type"],
      frontContent: safeStr(o.frontContent, 3200),
      backContent: safeStr(o.backContent, 5200),
      savedAt: safeStr(o.savedAt, 80) || undefined,
      subtopicName: safeStr(o.subtopicName, 300),
      topic: safeStr(o.topic, 300),
      subject: safeStr(o.subject, 30).toLowerCase() as SavedRevisionCard["subject"],
      classLevel: (Number(o.classLevel) === 12 ? 12 : 11) as SavedRevisionCard["classLevel"],
      status: safeStr(o.status, 20) as SavedRevisionCard["status"],
      level: safeStr(o.level, 30) as SavedRevisionCard["level"],
      board: safeStr(o.board, 10) as SavedRevisionCard["board"],
      sectionIndex: Number.isFinite(Number(o.sectionIndex))
        ? (Number(o.sectionIndex) as number)
        : undefined,
    };
  });
}

function sanitizeSavedRevisionUnits(raw: unknown): SavedRevisionUnit[] {
  const rows = Array.isArray(raw) ? (raw as unknown[]) : [];
  return rows.slice(0, MAX_SAVED_REVISION_UNITS).map((r, idx): SavedRevisionUnit => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      id: safeStr(o.id, 200) || `saved-unit:${idx}`,
      board: safeStr(o.board, 10) as SavedRevisionUnit["board"],
      subject: safeStr(o.subject, 30).toLowerCase() as SavedRevisionUnit["subject"],
      classLevel: (Number(o.classLevel) === 12 ? 12 : 11) as SavedRevisionUnit["classLevel"],
      unitName: safeStr(o.unitName, 300),
      subtopicName: safeStr(o.subtopicName, 300),
      level: safeStr(o.level, 30) as SavedRevisionUnit["level"],
      sectionIndex: Number(o.sectionIndex ?? 0) || 0,
      sectionTitle: safeStr(o.sectionTitle, 400),
    };
  });
}

function sanitizeSavedCommunityPosts(raw: unknown): SavedCommunityPost[] {
  const rows = Array.isArray(raw) ? (raw as unknown[]) : [];
  return rows.slice(0, MAX_SAVED_COMMUNITY_POSTS).map((r, idx): SavedCommunityPost => {
    const o = (r ?? {}) as Record<string, unknown>;
    return {
      id: safeStr(o.id, 200) || `saved-community:${idx}`,
      postId: safeStr(o.postId, 200),
      title: safeStr(o.title, 600),
      content: safeStr(o.content, 4200),
      subject: safeStr(o.subject, 30) || null,
      chapterRef: safeStr(o.chapterRef, 120) || null,
      topicRef: safeStr(o.topicRef, 120) || null,
      subtopicRef: safeStr(o.subtopicRef, 120) || null,
      createdAt: safeStr(o.createdAt, 80),
      savedAt: safeStr(o.savedAt, 80),
    };
  });
}

function classifyGyanAnswerKind(profiles: { name: string | null; role: string | null } | null): {
  kind: "ai" | "teacher" | "student";
  label: string;
} {
  const pseudo: ExpandedAnswer = {
    id: "",
    body: "",
    upvotes: 0,
    downvotes: 0,
    is_accepted: false,
    created_at: "",
    user_id: "",
    profiles: profiles ? { ...profiles, avatar_url: null } : null,
  };
  if (isAiTutorAnswer(pseudo)) return { kind: "ai", label: "AI tutor" };
  if (profiles?.role === "teacher") return { kind: "teacher", label: "Teacher" };
  return { kind: "student", label: "Student" };
}

/** Cap joined rows returned for admin UI (full total still in playHistoryTotal). Sessions group within this cap. */
const MAX_PLAY_HISTORY_RECENT = 800;

const STUDY_DAY_LOOKBACK_DAYS = 89;
const CHAPTER_NEEDS_ATTENTION_MAX_PCT = 10;

function normalizeCurrText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function shouldSkipCurrTopicNode(
  subject: string,
  classLevel: number,
  chapterTitle: string,
  topicTitle: string
): boolean {
  // Data cleanup parity with curriculumService.ts
  if (
    subject === "chemistry" &&
    classLevel === 12 &&
    chapterTitle.trim().toLowerCase() === "alcohols, phenols and ethers" &&
    topicTitle.trim().toLowerCase() === "reactions"
  ) {
    return true;
  }
  return false;
}

function mapCurrExamRelevance(
  arr: string[] | null
): Array<"JEE" | "KCET" | "JEE_Mains" | "JEE_Advance" | "other"> {
  if (!arr?.length) return [];
  const allowed = new Set(["JEE", "KCET", "JEE_Mains", "JEE_Advance", "other"]);
  const out: Array<"JEE" | "KCET" | "JEE_Mains" | "JEE_Advance" | "other"> = [];
  for (const value of arr) {
    const trimmed = value.trim();
    if (!allowed.has(trimmed)) continue;
    if (!out.includes(trimmed as (typeof out)[number])) out.push(trimmed as (typeof out)[number]);
  }
  return out;
}

function getCurrTopicOrderOverride(
  subject: string,
  classLevel: number,
  chapterTitle: string,
  topicTitle: string
): number | null {
  if (
    subject === "chemistry" &&
    classLevel === 12 &&
    chapterTitle.trim().toLowerCase() === "alcohols, phenols and ethers"
  ) {
    const t = topicTitle.trim().toLowerCase();
    if (t === "preparation") return 1;
    if (t === "preparation & acidity") return 2;
    if (t === "properties & reactions") return 3;
  }
  return null;
}

function compareCurrTopicsForChapter(
  subject: string,
  classLevel: number,
  chapterTitle: string,
  a: { title: string; sort_order: number | null },
  b: { title: string; sort_order: number | null }
): number {
  const aTitle = normalizeCurrText(a.title);
  const bTitle = normalizeCurrText(b.title);
  const aOverride = getCurrTopicOrderOverride(subject, classLevel, chapterTitle, aTitle);
  const bOverride = getCurrTopicOrderOverride(subject, classLevel, chapterTitle, bTitle);
  if (aOverride !== null || bOverride !== null) {
    return (aOverride ?? Number.MAX_SAFE_INTEGER) - (bOverride ?? Number.MAX_SAFE_INTEGER);
  }
  return (a.sort_order ?? 0) - (b.sort_order ?? 0);
}

const curriculumUnitsSelect = `
  id,
  subject,
  class_level,
  unit_label,
  unit_title,
  exam_relevance,
  sort_order,
  curriculum_chapters (
    id,
    title,
    sort_order,
    curriculum_topics (
      id,
      title,
      sort_order,
      curriculum_subtopics (
        name,
        sort_order
      )
    )
  )
`;

async function fetchFullCurriculumFromSupabaseAdmin(
  admin: NonNullable<ReturnType<typeof createAdminClient>>
): Promise<TopicNode[] | null> {
  const { data, error } = await admin
    .from("curriculum_units")
    .select(curriculumUnitsSelect)
    .order("sort_order", { ascending: true });

  if (error) {
    console.warn("[admin/student-insights] curriculum_units error:", error.message, error.code);
    return null;
  }
  if (!data) return null;

  const nodes: TopicNode[] = [];
  for (const unit of data as unknown as Array<{
    id: string;
    subject: string;
    class_level: number;
    unit_label: string;
    unit_title: string;
    exam_relevance: string[] | null;
    sort_order: number | null;
    curriculum_chapters?: Array<{
      id: string;
      title: string;
      sort_order: number | null;
      curriculum_topics?: Array<{
        id: string;
        title: string;
        sort_order: number | null;
        curriculum_subtopics?: Array<{ name: string; sort_order: number | null }>;
      }>;
    }>;
  }>) {
    const subject = normalizeCurrText(unit.subject);
    const classLevel = unit.class_level;
    const unitLabel = normalizeCurrText(unit.unit_label);
    const unitTitle = normalizeCurrText(unit.unit_title);
    if (!subject || !Number.isFinite(classLevel) || !unitLabel || !unitTitle) continue;
    const examRelevance = mapCurrExamRelevance(unit.exam_relevance ?? null);

    const chapters = [...(unit.curriculum_chapters ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
    );
    for (const chapter of chapters) {
      const chapterTitle = normalizeCurrText(chapter.title);
      if (!chapterTitle) continue;
      const topics = [...(chapter.curriculum_topics ?? [])].sort((a, b) =>
        compareCurrTopicsForChapter(subject, classLevel, chapterTitle, a, b)
      );
      for (const topic of topics) {
        const topicTitle = normalizeCurrText(topic.title);
        if (!topicTitle) continue;
        if (shouldSkipCurrTopicNode(subject, classLevel, chapterTitle, topicTitle)) continue;
        const subtopics = (topic.curriculum_subtopics ?? [])
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
          .map((s) => normalizeCurrText(s.name))
          .filter(Boolean)
          .map((name) => ({ name }));

        nodes.push({
          subject: subject as TopicNode["subject"],
          classLevel: classLevel as TopicNode["classLevel"],
          topic: topicTitle,
          chapterTitle,
          unitLabel,
          unitTitle,
          subtopics,
          examRelevance,
        });
      }
    }
  }

  return nodes;
}

function addDaysIsoUtc(iso: string, deltaDays: number): string {
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
    return new Date().toISOString().slice(0, 10);
  }
  const [y, m, d] = parts;
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

const STREAK_ACTIVE_MS_NOTE =
  "Streak counts calendar days where user_study_day_totals.active_ms > 0 (same anchor rules as the student app via computeStudyStreakFromDayMs). active_ms increases when topic quizzes are submitted (server credits answered questions × 3 minutes) and when play flows POST study-day bumps. Calendar day strings are client-supplied when events run.";
const STUDY_PRESENCE_MS_NOTE =
  "presence_ms is foreground on-site dwell (site presence), comparable to student heatmap cells — separate from streak active_ms credits.";

/** Avoid huge JSON payloads while keeping admin markdown/LaTeX useful. */
const MAX_COMMUNITY_BODY_CHARS = 24000;
const MAX_COMMUNITY_TITLE_CHARS = 4000;

type PlayQuestionJoin = {
  domain: string;
  category: string;
  content: Json;
  options: Json;
  correct_answer_index: number;
  explanation: string | null;
};

type PlayHistoryJoinedRow = {
  id: string;
  question_id: string;
  is_correct: boolean;
  time_taken_ms: number | null;
  selected_answer_index: number | null;
  pool_key: string | null;
  created_at: string;
  play_questions: PlayQuestionJoin | PlayQuestionJoin[] | null;
};

function trunc(text: string | null | undefined, max: number): string {
  const s = (text ?? "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

function jsonLen(value: Json | null | undefined): number {
  if (value == null) return 0;
  if (Array.isArray(value)) return value.length;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length;
  return 0;
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isAdminUser(ctx.supabase, ctx.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await context.params;
    const userId = id?.trim();
    if (!userId) return NextResponse.json({ error: "Invalid user id" }, { status: 400 });

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });
    }

    const reqUrl = new URL(request.url);
    const streakTodayParam = reqUrl.searchParams.get("streakToday")?.trim();
    const isoDayRe = /^\d{4}-\d{2}-\d{2}$/;
    const streakTodayKey =
      streakTodayParam && isoDayRe.test(streakTodayParam)
        ? streakTodayParam
        : new Date().toISOString().slice(0, 10);
    const studyDayRangeFrom = addDaysIsoUtc(streakTodayKey, -STUDY_DAY_LOOKBACK_DAYS);

    const [authRes, profileRes, savedItemsRes] = await Promise.all([
      admin.auth.admin.getUserById(userId),
      admin
        .from("profiles")
        .select("id, role, name, subtopic_engagement, bits_test_attempts, daily_checklist_state")
        .eq("id", userId)
        .maybeSingle(),
      // Read saved items from the new table instead of JSONB arrays
      admin
        .from("user_saved_items")
        .select("item_type, content_id, subject, status, saved_at, data")
        .eq("user_id", userId)
        .order("created_at", { ascending: false }),
    ]);

    if (authRes.error || !authRes.data.user) {
      return NextResponse.json(
        { error: authRes.error?.message || "User not found" },
        { status: 404 }
      );
    }
    if (profileRes.error) {
      return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
    }

    const profile = profileRes.data;
    const role = profile?.role ?? null;
    const isStudent = role === "student";

    // Build saved arrays from user_saved_items table (replaces JSONB columns)
    const savedItems = savedItemsRes.data ?? [];
    const savedBitsRaw: Record<string, unknown>[] = [];
    const savedFormulasRaw: Record<string, unknown>[] = [];
    const savedRevisionCardsRaw: Record<string, unknown>[] = [];
    const savedRevisionUnitsRaw: Record<string, unknown>[] = [];
    const savedCommunityPostsRaw: Record<string, unknown>[] = [];

    for (const row of savedItems) {
      const d = row.data as Record<string, unknown>;
      switch (row.item_type) {
        case "saved_bit":
          savedBitsRaw.push(d);
          break;
        case "saved_formula":
          savedFormulasRaw.push(d);
          break;
        case "saved_revision_card":
          savedRevisionCardsRaw.push(d);
          break;
        case "saved_revision_unit":
          savedRevisionUnitsRaw.push(d);
          break;
        case "saved_community_post":
          savedCommunityPostsRaw.push(d);
          break;
      }
    }

    const learningMap = buildSubtopicInsightRows(profile?.subtopic_engagement ?? null);

    const [
      magicRes,
      progressRes,
      doubtsRes,
      answersCountRes,
      communityPostsCountRes,
      rawPostsRes,
      rawCommentsRes,
      communityCommentsCountRes,
      playRecentRes,
      playCountRes,
      playStatsRes,
      gauntletRes,
      referRes,
      chatRes,
      studyDayTotalsRes,
    ] = await Promise.all([
      admin
        .from("magic_wall_basket_items")
        .select(
          "id, topic_key, board, subject, class_level, exam_type, unit_name, chapter_title, topic_name, source, created_at, updated_at"
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
      admin
        .from("classroom_assignment_task_progress")
        .select(
          `
          id,
          post_id,
          task_id,
          completed_at,
          posts (
            title,
            type,
            classroom_id
          )
        `
        )
        .eq("user_id", userId)
        .order("completed_at", { ascending: false })
        .limit(MAX_CLASSROOM_PROGRESS_ROWS),
      admin
        .from("doubts")
        .select(
          `
          id,
          title,
          body,
          subject,
          is_resolved,
          views,
          created_at,
          upvotes,
          downvotes,
          gyan_curriculum_nodes (
            chapter_label,
            topic_label,
            subtopic_label
          )
        `
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_DOUBTS_LIST),
      admin.from("doubt_answers").select("*", { head: true, count: "exact" }).eq("user_id", userId),
      admin
        .from("lessons_raw_posts")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", userId),
      admin
        .from("lessons_raw_posts")
        .select(
          `
          id,
          kind,
          title,
          content,
          tags,
          subject,
          source_type,
          source_payload,
          created_at,
          updated_at,
          subtopic_ref,
          topic_ref,
          board_ref,
          grade_ref,
          unit_ref,
          chapter_ref,
          upvote_count,
          downvote_count,
          comment_count,
          boost_count
        `
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_COMMUNITY_ITEMS),
      admin
        .from("lessons_raw_post_comments")
        .select("id, post_id, body, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_COMMUNITY_ITEMS),
      admin
        .from("lessons_raw_post_comments")
        .select("id", { head: true, count: "exact" })
        .eq("user_id", userId),
      admin
        .from("play_history")
        .select(
          `
          id,
          question_id,
          is_correct,
          time_taken_ms,
          selected_answer_index,
          pool_key,
          created_at,
          play_questions (
            domain,
            category,
            content,
            options,
            correct_answer_index,
            explanation
          )
        `
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_PLAY_HISTORY_RECENT),
      admin.from("play_history").select("*", { head: true, count: "exact" }).eq("user_id", userId),
      admin.from("user_play_stats").select("*").eq("user_id", userId),
      admin
        .from("daily_gauntlet_attempts")
        .select("id, gauntlet_date, total_time_ms, correct_count, completed_at")
        .eq("user_id", userId)
        .order("gauntlet_date", { ascending: false })
        .limit(90),
      admin
        .from("refer_challenge_claims")
        .select(
          "user_id, claim_date, challenge_key, win_claimed, share_claimed, win_claimed_at, share_claimed_at, updated_at"
        )
        .eq("user_id", userId)
        .order("claim_date", { ascending: false })
        .limit(120),
      admin
        .from("subject_topic_chat_messages")
        .select("id, context_key, role, content, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(MAX_CHAT_MESSAGES),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- table not in generated Database types yet
      (admin as any)
        .from("user_study_day_totals")
        .select("day, active_ms, presence_ms, updated_at")
        .eq("user_id", userId)
        .gte("day", studyDayRangeFrom)
        .lte("day", streakTodayKey)
        .order("day", { ascending: true }),
    ]);

    const errs = [
      magicRes.error,
      progressRes.error,
      doubtsRes.error,
      answersCountRes.error,
      communityPostsCountRes.error,
      rawPostsRes.error,
      rawCommentsRes.error,
      communityCommentsCountRes.error,
      playRecentRes.error,
      playCountRes.error,
      playStatsRes.error,
      gauntletRes.error,
      referRes.error,
      chatRes.error,
    ].filter(Boolean);
    if (errs.length > 0) {
      return NextResponse.json({ error: errs[0]!.message }, { status: 500 });
    }

    if (studyDayTotalsRes.error) {
      console.warn("[student-insights] user_study_day_totals:", studyDayTotalsRes.error.message);
    }

    const gauntletDates = (gauntletRes.data ?? []).map((r) => r.gauntlet_date);
    const arenaStreakDays = computeStreakDays(gauntletDates);

    const playHistoryJoined = (playRecentRes.data ?? []) as PlayHistoryJoinedRow[];
    const playHistoryRecent = playHistoryJoined.map((row) => {
      const joined = row.play_questions;
      const pq = joined == null ? null : Array.isArray(joined) ? (joined[0] ?? null) : joined;
      const options = pq ? parsePlayQuestionOptions(pq.options) : [];
      const stemPlain = pq ? playQuestionStemPlain(pq.content) : "";
      const chosenFull =
        row.selected_answer_index != null
          ? formatMcqChoiceLabel(row.selected_answer_index, options, 400)
          : "";
      const correctFull = pq ? formatMcqChoiceLabel(pq.correct_answer_index, options, 400) : "";
      return {
        id: row.id,
        question_id: row.question_id,
        is_correct: row.is_correct,
        time_taken_ms: row.time_taken_ms,
        selected_answer_index: row.selected_answer_index,
        pool_key: row.pool_key,
        created_at: row.created_at,
        session_label: poolKeyLabel(row.pool_key),
        stem_preview: trunc(stemPlain, 200),
        chosen_preview:
          chosenFull ||
          (row.selected_answer_index == null ? null : `Index ${row.selected_answer_index}`),
        correct_preview: correctFull || null,
        question: pq
          ? {
              domain: pq.domain,
              category: pq.category,
              content: pq.content,
              options,
              correct_answer_index: pq.correct_answer_index,
              explanation: pq.explanation,
            }
          : null,
      };
    });

    const playSessionsFull = buildPlaySessionsFromAttempts(playHistoryRecent);
    const playSessions = playSessionsFull.map((s) => ({
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
      attemptCount: s.attemptCount,
      correctCount: s.correctCount,
      wrongCount: s.wrongCount,
      distinctPoolKeys: s.distinctPoolKeys,
      attemptIds: s.attempts.map((a) => a.id),
    }));

    const doubts = doubtsRes.data ?? [];
    const doubtIds = doubts.map((d) => d.id);

    type DoubtAnswerJoinRow = {
      id: string;
      doubt_id: string;
      user_id: string;
      body: string;
      upvotes: number;
      downvotes: number;
      is_accepted: boolean;
      hidden: boolean;
      created_at: string;
      profiles:
        | { name: string | null; role: string | null }
        | { name: string | null; role: string | null }[]
        | null;
    };

    let doubtAnswersRows: DoubtAnswerJoinRow[] = [];
    if (doubtIds.length > 0) {
      const ansRes = await admin
        .from("doubt_answers")
        .select(
          `
          id,
          doubt_id,
          user_id,
          body,
          upvotes,
          downvotes,
          is_accepted,
          hidden,
          created_at,
          profiles!doubt_answers_user_id_fkey ( name, role )
        `
        )
        .in("doubt_id", doubtIds)
        .eq("hidden", false);
      if (ansRes.error) {
        return NextResponse.json({ error: ansRes.error.message }, { status: 500 });
      }
      doubtAnswersRows = (ansRes.data ?? []) as DoubtAnswerJoinRow[];
    }

    const answersByDoubtId = new Map<string, DoubtAnswerJoinRow[]>();
    for (const row of doubtAnswersRows) {
      const list = answersByDoubtId.get(row.doubt_id) ?? [];
      list.push(row);
      answersByDoubtId.set(row.doubt_id, list);
    }
    for (const [did, list] of answersByDoubtId.entries()) {
      list.sort((a, b) => {
        if (a.is_accepted !== b.is_accepted) return a.is_accepted ? -1 : 1;
        if (b.upvotes !== a.upvotes) return b.upvotes - a.upvotes;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      answersByDoubtId.set(did, list.slice(0, MAX_ANSWERS_PER_DOUBT));
    }

    type DoubtRowWithCurriculum = (typeof doubts)[number] & {
      gyan_curriculum_nodes?:
        | {
            chapter_label: string;
            topic_label: string;
            subtopic_label: string | null;
          }
        | {
            chapter_label: string;
            topic_label: string;
            subtopic_label: string | null;
          }[]
        | null;
    };

    const doubtsPayload = (doubts as DoubtRowWithCurriculum[]).map((d) => {
      const nodesRaw = d.gyan_curriculum_nodes;
      const node =
        nodesRaw == null ? null : Array.isArray(nodesRaw) ? (nodesRaw[0] ?? null) : nodesRaw;
      const curriculum = node
        ? {
            chapter: node.chapter_label,
            topic: node.topic_label,
            subtopic: node.subtopic_label,
          }
        : null;

      const answersForDoubt = answersByDoubtId.get(d.id) ?? [];
      const answers = answersForDoubt.map((a) => {
        const profRaw = a.profiles;
        const prof =
          profRaw == null ? null : Array.isArray(profRaw) ? (profRaw[0] ?? null) : profRaw;
        const { kind, label } = classifyGyanAnswerKind(prof);
        return {
          id: a.id,
          body: trunc(a.body, MAX_ANSWER_BODY_CHARS),
          createdAt: a.created_at,
          authorName: prof?.name ?? null,
          authorRole: prof?.role ?? null,
          isAccepted: Boolean(a.is_accepted),
          upvotes: Number(a.upvotes ?? 0),
          downvotes: Number(a.downvotes ?? 0),
          kind,
          kindLabel: label,
        };
      });

      return {
        id: d.id,
        title: trunc(d.title, MAX_DOUBT_TITLE_CHARS),
        body: trunc(d.body, MAX_DOUBT_BODY_CHARS),
        listPreview: trunc(d.body, 220),
        subject: d.subject,
        isResolved: Boolean(d.is_resolved),
        views: Number(d.views ?? 0),
        upvotes: Number(d.upvotes ?? 0),
        downvotes: Number(d.downvotes ?? 0),
        createdAt: d.created_at,
        curriculum,
        answers,
      };
    });

    const studyDayList = (!studyDayTotalsRes.error ? studyDayTotalsRes.data : null) ?? [];
    const normalizedStudyDays = (
      studyDayList as unknown as Array<{
        day: string;
        active_ms?: number | null;
        presence_ms?: number | null;
        updated_at?: string | null;
      }>
    ).map((r) => ({
      day: r.day,
      active_ms: typeof r.active_ms === "number" ? Math.max(0, r.active_ms) : 0,
      presence_ms: typeof r.presence_ms === "number" ? Math.max(0, r.presence_ms) : 0,
      updated_at: r.updated_at ?? null,
    }));
    const msByDay = new Map<string, number>();
    for (const r of normalizedStudyDays) {
      msByDay.set(r.day, r.active_ms);
    }
    const streakSummaryClient = computeStudyStreakFromDayMs(msByDay, streakTodayKey);

    const bitsRawProfile = profile?.bits_test_attempts ?? null;
    const bitsObjKeys =
      bitsRawProfile && typeof bitsRawProfile === "object" && !Array.isArray(bitsRawProfile)
        ? Object.keys(bitsRawProfile as Record<string, unknown>)
        : [];
    const bitsKeySet = new Set(bitsObjKeys);
    const bitsKeyedRows = parseBitsTestAttemptsKeyed(bitsRawProfile);
    const engagementDraftRowsForQuiz = parseEngagementDraftDashboardContributions(
      profile?.subtopic_engagement ?? null,
      bitsKeySet
    );
    const bitsQuizInsight = buildBitsQuizRollupForAdmin(bitsKeyedRows, engagementDraftRowsForQuiz);

    const savedContent = {
      savedBits: sanitizeSavedBits(savedBitsRaw),
      savedFormulas: sanitizeSavedFormulas(savedFormulasRaw),
      savedRevisionCards: sanitizeSavedRevisionCards(savedRevisionCardsRaw),
      savedRevisionUnits: sanitizeSavedRevisionUnits(savedRevisionUnitsRaw),
      savedCommunityPosts: sanitizeSavedCommunityPosts(savedCommunityPostsRaw),
      capsNote:
        `Saved lists are capped for admin UI payload size. ` +
        `bits<=${MAX_SAVED_BITS}, formulas<=${MAX_SAVED_FORMULAS}, instacueCards<=${MAX_SAVED_REVISION_CARDS}, ` +
        `revisionUnits<=${MAX_SAVED_REVISION_UNITS}, communityPosts<=${MAX_SAVED_COMMUNITY_POSTS}.`,
    };

    const taxonomyNodes = await fetchFullCurriculumFromSupabaseAdmin(admin);
    let chapterAccuracyRows: ChapterCompletionRow[] = [];
    let chapterNeedsAttention: ChapterCompletionRow[] = [];
    let chapterAccuracyNote: string | null = null;
    if (taxonomyNodes?.length) {
      chapterAccuracyRows = buildChapterCompletionRowsByRecentActivity(
        taxonomyNodes,
        parseBitsTestAttemptsStore(bitsRawProfile),
        bitsObjKeys,
        profile?.subtopic_engagement ?? null,
        12,
        { progressSource: "lesson_marked_only" }
      );
      chapterNeedsAttention = chapterAccuracyRows.filter(
        (r) => r.completionPct <= CHAPTER_NEEDS_ATTENTION_MAX_PCT && r.completed > 0
      );
    } else {
      chapterAccuracyNote =
        "Curriculum taxonomy could not be loaded from Supabase; chapter rollup unavailable.";
    }

    const since90 = new Date(Date.now() - 90 * 86400000).toISOString();
    const dwellRes = await admin
      .from("student_learning_dwell_events")
      .select("board, subject, class_level, topic, subtopic_name, level, panel, delta_ms")
      .eq("user_id", userId)
      .gte("occurred_at", since90)
      .limit(25000);

    if (dwellRes.error) {
      return NextResponse.json({ error: dwellRes.error.message }, { status: 500 });
    }

    const dwellRollup = rollupDwellEvents(dwellRes.data ?? []);
    const learningRowsWithDwell = mergeDwellIntoSubtopicRows(learningMap.rows, dwellRollup);

    const classroomRows = (progressRes.data ?? []).map((row: Record<string, unknown>) => {
      const postsRaw = row.posts as
        | { title: string | null; type: string | null; classroom_id: string | null }
        | { title: string | null; type: string | null; classroom_id: string | null }[]
        | null
        | undefined;
      const post = Array.isArray(postsRaw) ? postsRaw[0] : postsRaw;
      return {
        id: row.id as string,
        postId: row.post_id as string,
        taskId: row.task_id as string,
        completedAt: row.completed_at as string,
        postTitle: post?.title ?? null,
        postType: post?.type ?? null,
        classroomId: post?.classroom_id ?? null,
      };
    });

    const dwellTotalsMs = {
      theory: 0,
      bits: 0,
      numerals: 0,
      instacue: 0,
      all: 0,
    };
    for (const row of dwellRollup.values()) {
      dwellTotalsMs.theory += row.theory;
      dwellTotalsMs.bits += row.bits;
      dwellTotalsMs.numerals += row.numerals;
      dwellTotalsMs.instacue += row.instacue;
    }
    dwellTotalsMs.all =
      dwellTotalsMs.theory + dwellTotalsMs.bits + dwellTotalsMs.numerals + dwellTotalsMs.instacue;

    return NextResponse.json(
      {
        schemaNote: STUDENT_DWELL_TELEMETRY_NOTE,
        generatedAt: new Date().toISOString(),
        userId,
        role,
        isStudent,
        streakTodayKeyUsed: streakTodayKey,
        studyDays: {
          days: normalizedStudyDays,
          summary: streakSummaryClient,
          streakActiveMsNote: STREAK_ACTIVE_MS_NOTE,
          presenceMsNote: STUDY_PRESENCE_MS_NOTE,
        },
        chapterAccuracy: {
          rows: chapterAccuracyRows,
          needsAttention: chapterNeedsAttention,
          taxonomyNote: chapterAccuracyNote,
          progressSourceNote:
            "Same idea as the student Subject accuracy card: only subtopics with Lessons/Progress Mark as complete persisted (lessonChecklistMarkedCompleteAt). Chapter % = marked subtopics ÷ total curriculum subtopics in that chapter; ordering follows student dashboard (chapters with ≥1 mark first, newest activity first).",
        },
        bitsQuiz: {
          submittedAttemptRowCount: bitsQuizInsight.attemptCount,
          draftGradedEngagementRows: engagementDraftRowsForQuiz.length,
          subjectRollup: bitsQuizInsight.subjectRollup,
          attemptDetails: bitsQuizInsight.attemptDetails,
          rollupNote:
            "Matches Performance topic-quiz slice: profiles.bits_test_attempts rows plus in-progress graded rows in subtopic_engagement (drafts). Play arena attempts stay under Play / Arena. Retakes overwrite the same storage key; advanced sets may use distinct keys (||set:N).",
        },
        profileLearning: {
          dailyChecklistState: profile?.daily_checklist_state ?? null,
          bitsTestAttemptsKeys: jsonLen(profile?.bits_test_attempts as Json | null),
          savedBitsCount: savedBitsRaw.length,
          savedFormulasCount: savedFormulasRaw.length,
          savedRevisionCardsCount: savedRevisionCardsRaw.length,
          savedRevisionUnitsCount: savedRevisionUnitsRaw.length,
          savedCommunityPostsCount: savedCommunityPostsRaw.length,
        },
        savedContent,
        dwellTotalsLast90DaysMs: dwellTotalsMs,
        learningMap: {
          rows: learningRowsWithDwell,
          totalKeysInStore: learningMap.totalKeysInStore,
          capped: learningMap.capped,
        },
        magicWall: {
          items: magicRes.data ?? [],
          count: (magicRes.data ?? []).length,
        },
        classroomTasks: {
          rows: classroomRows,
          count: classroomRows.length,
        },
        gyanDoubts: {
          recent: doubtsPayload,
          recentCount: doubtsPayload.length,
          totals: {
            answersSubmitted: answersCountRes.count ?? 0,
          },
        },
        community: {
          totals: {
            postsInDb: communityPostsCountRes.count ?? 0,
            commentsInDb: communityCommentsCountRes.count ?? 0,
            postsLoaded: (rawPostsRes.data ?? []).length,
            commentsLoaded: (rawCommentsRes.data ?? []).length,
            postsCapped: (rawPostsRes.data ?? []).length >= MAX_COMMUNITY_ITEMS,
            commentsCapped: (rawCommentsRes.data ?? []).length >= MAX_COMMUNITY_ITEMS,
          },
          posts: (rawPostsRes.data ?? []).map((p) => ({
            id: p.id,
            kind: p.kind,
            title: trunc(p.title, MAX_COMMUNITY_TITLE_CHARS),
            content: trunc(p.content, MAX_COMMUNITY_BODY_CHARS),
            tags: p.tags ?? [],
            subject: p.subject,
            sourceType: p.source_type,
            topicRef: p.topic_ref,
            subtopicRef: p.subtopic_ref,
            boardRef: p.board_ref,
            gradeRef: p.grade_ref,
            unitRef: p.unit_ref,
            chapterRef: p.chapter_ref,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
            upvoteCount: Number(p.upvote_count ?? 0),
            downvoteCount: Number(p.downvote_count ?? 0),
            commentCount: Number(p.comment_count ?? 0),
            boostCount: Number(p.boost_count ?? 0),
          })),
          comments: (rawCommentsRes.data ?? []).map((c) => ({
            id: c.id,
            postId: c.post_id,
            body: trunc(c.body, MAX_COMMUNITY_BODY_CHARS),
            createdAt: c.created_at,
          })),
        },
        subjectTopicChat: {
          messages: (chatRes.data ?? []).map((m) => ({
            id: m.id,
            contextKey: m.context_key,
            role: m.role,
            /** Admin review: much larger than old 320-char preview; capped below DB max per row. */
            body: trunc(m.content, 6000),
            createdAt: m.created_at,
          })),
        },
        playArena: {
          playHistoryTotal: playCountRes.count ?? 0,
          playHistoryRecent,
          playSessionsInferenceNote: PLAY_SESSION_INFERENCE_NOTE,
          playSessions,
          userPlayStats: playStatsRes.data ?? [],
          dailyGauntletAttempts: gauntletRes.data ?? [],
          arenaStreakDays,
        },
        referEarn: {
          claims: referRes.data ?? [],
        },
      },
      {
        headers: {
          "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
