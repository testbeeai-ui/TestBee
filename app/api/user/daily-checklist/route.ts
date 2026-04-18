import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import { parseBitsTestAttemptsStore } from "@/lib/parseBitsTestAttemptsStore";
import {
  parseDailyChecklistState,
  mergeDayState,
  parseIsoDay,
  appendSubtopicBCompleteKey,
  removeSubtopicBCompleteKey,
  type DailyChecklistApiResponse,
} from "@/lib/dailyChecklistState";
import type { Subject } from "@/types";

const FIVE_MIN_MS = 5 * 60 * 1000;
const MIN_SAVED_CARDS_INSTACUE = 32;

function parseIsoInstant(s: string | null): number | null {
  if (!s || typeof s !== "string") return null;
  const t = Date.parse(s.trim());
  return Number.isFinite(t) ? t : null;
}

function countInstacueCardsSavedInRange(rawCards: unknown, dayStartMs: number, dayEndMs: number): number {
  if (!Array.isArray(rawCards)) return 0;
  let n = 0;
  for (const c of rawCards) {
    if (!c || typeof c !== "object" || Array.isArray(c)) continue;
    const at = (c as { savedAt?: unknown }).savedAt;
    if (typeof at !== "string") continue;
    const ms = Date.parse(at.trim());
    if (!Number.isFinite(ms)) continue;
    if (ms >= dayStartMs && ms < dayEndMs) n++;
  }
  return n;
}

function revisionCardsHaveAnySavedAt(rawCards: unknown): boolean {
  if (!Array.isArray(rawCards)) return false;
  for (const c of rawCards) {
    if (!c || typeof c !== "object" || Array.isArray(c)) continue;
    const at = (c as { savedAt?: unknown }).savedAt;
    if (typeof at === "string" && at.trim() && Number.isFinite(Date.parse(at.trim()))) return true;
  }
  return false;
}

function engagementHasLessonCompleteInRange(
  raw: unknown,
  dayStartMs: number,
  dayEndMs: number
): boolean {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  for (const v of Object.values(raw as Record<string, unknown>)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const row = v as Record<string, unknown>;
    if (Number(row.v) !== 1) continue;
    const at = row.lessonChecklistMarkedCompleteAt;
    if (typeof at !== "string") continue;
    const ms = Date.parse(at);
    if (!Number.isFinite(ms)) continue;
    if (ms >= dayStartMs && ms < dayEndMs) return true;
  }
  return false;
}

/** GET ?today=YYYY-MM-DD&dayStart=ISO&dayEnd=ISO&subjects=physics,chemistry,math */
export async function GET(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const today = parseIsoDay(url.searchParams.get("today"));
  const dayStartMs = parseIsoInstant(url.searchParams.get("dayStart"));
  const dayEndMs = parseIsoInstant(url.searchParams.get("dayEnd"));
  const subjectsParam = url.searchParams.get("subjects")?.trim() ?? "";

  if (!today || dayStartMs == null || dayEndMs == null || dayEndMs <= dayStartMs) {
    return NextResponse.json(
      { error: "today (YYYY-MM-DD), dayStart, and dayEnd (ISO) query params are required" },
      { status: 400 }
    );
  }

  const dashboardSubjects = subjectsParam
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter((s): s is Subject => ["physics", "chemistry", "math", "biology"].includes(s));
  if (!dashboardSubjects.length) {
    return NextResponse.json({ error: "subjects query param must list at least one subject" }, { status: 400 });
  }

  const sb = auth.supabase as any;
  const uid = auth.user.id;

  const [profileRes, gauntletRes, savesRes, votesRes, answersRes] = await Promise.all([
    sb
      .from("profiles")
      .select("bits_test_attempts, subtopic_engagement, saved_revision_cards, daily_checklist_state")
      .eq("id", uid)
      .maybeSingle(),
    sb
      .from("daily_gauntlet_attempts")
      .select("id")
      .eq("user_id", uid)
      .eq("gauntlet_date", today)
      .eq("domain", "academic")
      .maybeSingle(),
    sb
      .from("doubt_saves")
      .select("doubt_id", { count: "exact", head: true })
      .eq("user_id", uid)
      .gte("created_at", new Date(dayStartMs).toISOString())
      .lt("created_at", new Date(dayEndMs).toISOString()),
    sb
      .from("doubt_votes")
      .select("id, target_type, target_id, created_at")
      .eq("user_id", uid)
      .gte("created_at", new Date(dayStartMs).toISOString())
      .lt("created_at", new Date(dayEndMs).toISOString()),
    sb
      .from("doubt_answers")
      .select("id, doubt_id, created_at")
      .eq("user_id", uid)
      .gte("created_at", new Date(dayStartMs).toISOString())
      .lt("created_at", new Date(dayEndMs).toISOString()),
  ]);

  if (profileRes.error) {
    console.error("[daily-checklist GET] profile", profileRes.error.message);
    return NextResponse.json({ error: profileRes.error.message }, { status: 500 });
  }
  if (savesRes.error) {
    console.error("[daily-checklist GET] doubt_saves", savesRes.error.message);
    return NextResponse.json({ error: savesRes.error.message }, { status: 500 });
  }
  if (votesRes.error) {
    console.error("[daily-checklist GET] doubt_votes", votesRes.error.message);
    return NextResponse.json({ error: votesRes.error.message }, { status: 500 });
  }
  if (answersRes.error) {
    console.error("[daily-checklist GET] doubt_answers", answersRes.error.message);
    return NextResponse.json({ error: answersRes.error.message }, { status: 500 });
  }
  if (gauntletRes.error) {
    console.error("[daily-checklist GET] daily_gauntlet_attempts", gauntletRes.error.message);
  }
  const profile = profileRes.data as {
    bits_test_attempts?: unknown;
    subtopic_engagement?: unknown;
    saved_revision_cards?: unknown;
    daily_checklist_state?: unknown;
  } | null;

  const bitsRows = parseBitsTestAttemptsStore(profile?.bits_test_attempts ?? null);
  const subjectsWithBitsToday = new Set<Subject>();
  for (const r of bitsRows) {
    const ms = r.submittedAtMs;
    if (ms == null || ms < dayStartMs || ms >= dayEndMs) continue;
    subjectsWithBitsToday.add(r.subject);
  }
  const bitsAllSubjectsDone = dashboardSubjects.every((s) => subjectsWithBitsToday.has(s));

  const checklistState = parseDailyChecklistState(profile?.daily_checklist_state ?? null);
  const dayState = checklistState[today] ?? {};
  const bKeysToday = dayState.subtopicBCompleteKeys ?? [];
  const lessonRuleFromDailyKeys = bKeysToday.length > 0;
  const lessonRuleFromEngagement = engagementHasLessonCompleteInRange(
    profile?.subtopic_engagement ?? null,
    dayStartMs,
    dayEndMs
  );
  /** Deduped keys (Mark as complete → credit; Reset → revoke) plus legacy timestamp on engagement for older rows. */
  const lessonRule = lessonRuleFromDailyKeys || lessonRuleFromEngagement;

  /** Only real subtopic work: topic quiz submits today across all subjects, or Lessons/Progress Mark as complete (credited once per subtopic per day until Reset). */
  const subtopicRoutineDone = bitsAllSubjectsDone || lessonRule;

  const focusMs = typeof dayState.doubtsFocusMs === "number" ? Math.max(0, dayState.doubtsFocusMs) : 0;

  const savesToday = typeof savesRes.count === "number" ? savesRes.count : 0;

  const voteRows = (votesRes.data ?? []) as { target_type: string; target_id: string }[];
  const doubtIdsFromVotes = voteRows.filter((v) => v.target_type === "doubt").map((v) => v.target_id);
  const answerIdsFromVotes = voteRows.filter((v) => v.target_type === "answer").map((v) => v.target_id);

  const answerRows = (answersRes.data ?? []) as { doubt_id: string }[];
  const doubtIdsFromAnswers = answerRows.map((a) => a.doubt_id);

  const doubtsForVoteTargets =
    doubtIdsFromVotes.length > 0
      ? await sb.from("doubts").select("id, user_id").in("id", doubtIdsFromVotes)
      : { data: [] as { id: string; user_id: string }[] };
  const doubtAuthorById = new Map<string, string>();
  for (const d of (doubtsForVoteTargets.data ?? []) as { id: string; user_id: string }[]) {
    doubtAuthorById.set(d.id, d.user_id);
  }

  let communityActionsToday = 0;
  for (const id of doubtIdsFromVotes) {
    if (doubtAuthorById.get(id) && doubtAuthorById.get(id) !== uid) {
      communityActionsToday++;
    }
  }
  if (answerIdsFromVotes.length > 0) {
    const { data: ansAuthors } = await sb.from("doubt_answers").select("id, user_id").in("id", answerIdsFromVotes);
    for (const a of (ansAuthors ?? []) as { id: string; user_id: string }[]) {
      if (a.user_id !== uid) communityActionsToday++;
    }
  }
  if (doubtIdsFromAnswers.length > 0) {
    const { data: doubtsForMyAnswers } = await sb.from("doubts").select("id, user_id").in("id", doubtIdsFromAnswers);
    const authorByDoubt = new Map((doubtsForMyAnswers ?? []).map((d: { id: string; user_id: string }) => [d.id, d.user_id]));
    for (const a of answerRows) {
      if (authorByDoubt.get(a.doubt_id) && authorByDoubt.get(a.doubt_id) !== uid) {
        communityActionsToday++;
      }
    }
  }

  const cards = Array.isArray(profile?.saved_revision_cards) ? profile.saved_revision_cards : [];
  const savedRevisionCardsDeckTotal = cards.length;
  const savedToday = countInstacueCardsSavedInRange(cards, dayStartMs, dayEndMs);
  const usesDailySavedAt = revisionCardsHaveAnySavedAt(cards);
  const savedRevisionCardCount = usesDailySavedAt ? savedToday : savedRevisionCardsDeckTotal;
  const instacueSessionDone =
    savedRevisionCardCount >= MIN_SAVED_CARDS_INSTACUE && dayState.instacueSessionAck === true;

  const gyanPlusDone = focusMs >= FIVE_MIN_MS && savesToday >= 1 && communityActionsToday >= 1;

  const body: DailyChecklistApiResponse = {
    today,
    dailyDoseDone: Boolean(!gauntletRes.error && gauntletRes.data?.id),
    subtopicRoutineDone,
    gyanPlusDone,
    instacueSessionDone,
    gyanPlusProgress: {
      focusMs,
      savesToday,
      communityActionsToday,
    },
    savedRevisionCardCount,
    savedRevisionCardsDeckTotal,
  };

  return NextResponse.json(body);
}

type PatchBody =
  | { action: "instacue_ack"; today: string }
  | { action: "doubts_focus"; today: string; addMs: number }
  | { action: "subtopic_b_credit"; today: string; engagementKey: string }
  | { action: "subtopic_b_revoke"; today: string; engagementKey: string };

const MAX_ADD_MS = 120_000;
const MAX_DAY_FOCUS_MS = 86_400_000;

/** PATCH JSON: { action: 'instacue_ack', today } | { action: 'doubts_focus', today, addMs } */
export async function PATCH(req: NextRequest) {
  const auth = await getSupabaseAndUser(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: PatchBody;
  try {
    body = (await req.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const today = parseIsoDay(typeof body.today === "string" ? body.today : null);
  if (!today) {
    return NextResponse.json({ error: "today must be YYYY-MM-DD" }, { status: 400 });
  }

  const sb = auth.supabase as any;
  const uid = auth.user.id;

  const { data: profile, error: readErr } = await sb
    .from("profiles")
    .select("daily_checklist_state")
    .eq("id", uid)
    .maybeSingle();
  if (readErr) {
    console.error("[daily-checklist PATCH] read", readErr.message);
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const current = parseDailyChecklistState(profile?.daily_checklist_state ?? null);

  if (body.action === "instacue_ack") {
    const next = mergeDayState(current, today, { instacueSessionAck: true });
    const { error: wErr } = await sb.from("profiles").update({ daily_checklist_state: next }).eq("id", uid);
    if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "subtopic_b_credit" || body.action === "subtopic_b_revoke") {
    const engagementKey = typeof body.engagementKey === "string" ? body.engagementKey.trim() : "";
    if (!engagementKey || engagementKey.length > 900) {
      return NextResponse.json({ error: "engagementKey required" }, { status: 400 });
    }
    const next =
      body.action === "subtopic_b_credit"
        ? appendSubtopicBCompleteKey(current, today, engagementKey)
        : removeSubtopicBCompleteKey(current, today, engagementKey);
    const { error: wErr } = await sb.from("profiles").update({ daily_checklist_state: next }).eq("id", uid);
    if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "doubts_focus") {
    const addRaw = Number(body.addMs);
    const addMs = Number.isFinite(addRaw) ? Math.min(MAX_ADD_MS, Math.max(0, Math.trunc(addRaw))) : 0;
    if (addMs <= 0) {
      return NextResponse.json({ error: "addMs must be a positive number" }, { status: 400 });
    }
    const prior = current[today]?.doubtsFocusMs ?? 0;
    const cappedAdd = Math.min(addMs, Math.max(0, MAX_DAY_FOCUS_MS - prior));
    if (cappedAdd <= 0) {
      return NextResponse.json({ ok: true, capped: true });
    }
    const next = mergeDayState(current, today, { doubtsFocusMs: cappedAdd });
    const { error: wErr } = await sb.from("profiles").update({ daily_checklist_state: next }).eq("id", uid);
    if (wErr) return NextResponse.json({ error: wErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
