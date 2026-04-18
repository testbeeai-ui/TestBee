import { NextResponse } from "next/server";
import { getSupabaseAndUser } from "@/lib/apiAuth";
import type { Json } from "@/integrations/supabase/types";
import type {
  SubtopicEngagementBitsGraded,
  SubtopicEngagementFormulaDraft,
  SubtopicEngagementSnapshot,
} from "@/lib/subtopicEngagementService";
import { makeSubtopicEngagementStorageKey } from "@/lib/subtopicEngagementStorageKey";
import type { Board, Subject } from "@/types";
import type { DifficultyLevel } from "@/lib/slugs";

type ProfileEngagementRow = { subtopic_engagement?: Json | null };

const ALLOWED_LEVELS = new Set(["basics", "intermediate", "advanced"]);
const MAX_ENGAGEMENT_KEYS = 300;

function sanitize(value: unknown, maxLen = 300): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\x00-\x1F\x7F]/g, " ").replace(/\s+/g, " ").trim().slice(0, maxLen);
}

function normalizeKeyPart(value: unknown, maxLen = 300): string {
  return sanitize(value, maxLen).toLowerCase();
}

function parseEngagementStore(raw: unknown): Record<string, SubtopicEngagementSnapshot> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, SubtopicEngagementSnapshot> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const row = value as Record<string, unknown>;
    if (Number(row.v) !== 1) continue;
    const bitsSignature = sanitize(row.bitsSignature, 200);
    const updatedAt = sanitize(row.updatedAt, 80);
    if (!bitsSignature || !updatedAt) continue;
    const snap: SubtopicEngagementSnapshot = {
      v: 1,
      bitsSignature,
      updatedAt,
    };
    if (row.bits === null) snap.bits = null;
    else if (row.bits && typeof row.bits === "object" && !Array.isArray(row.bits)) {
      const b = row.bits as Record<string, unknown>;
      const currentIdx = Number(b.currentIdx);
      const visited = Array.isArray(b.visitedIndices)
        ? (b.visitedIndices as unknown[]).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n >= 0)
        : [];
      const sel = b.selectedAnswers && typeof b.selectedAnswers === "object" && !Array.isArray(b.selectedAnswers)
        ? (b.selectedAnswers as Record<string, unknown>)
        : {};
      const selectedAnswers: Record<string, number> = {};
      for (const [k, v] of Object.entries(sel)) {
        const idx = Number(v);
        if (!Number.isInteger(idx) || idx < 0 || idx > 3) continue;
        selectedAnswers[String(k)] = idx;
      }
      const bitsBase = {
        currentIdx: Number.isFinite(currentIdx) ? Math.max(0, Math.trunc(currentIdx)) : 0,
        selectedAnswers,
        visitedIndices: visited,
      };
      const gr = b.graded;
      let graded: SubtopicEngagementBitsGraded | undefined;
      if (gr && typeof gr === "object" && !Array.isArray(gr)) {
        const g = gr as Record<string, unknown>;
        const answered = Number.isFinite(Number(g.answered)) ? Math.max(0, Math.min(10_000, Math.trunc(Number(g.answered)))) : 0;
        const correct = Number.isFinite(Number(g.correct)) ? Math.max(0, Math.min(10_000, Math.trunc(Number(g.correct)))) : 0;
        const wrong = Number.isFinite(Number(g.wrong)) ? Math.max(0, Math.min(10_000, Math.trunc(Number(g.wrong)))) : 0;
        const totalQuestions = Number.isFinite(Number(g.totalQuestions))
          ? Math.max(0, Math.min(10_000, Math.trunc(Number(g.totalQuestions))))
          : 0;
        if (answered > 0 || correct > 0 || wrong > 0) {
          graded = { answered, correct, wrong, totalQuestions };
        }
      }
      snap.bits = graded ? { ...bitsBase, graded } : bitsBase;
    }
    if (row.formulaByIdx && typeof row.formulaByIdx === "object" && !Array.isArray(row.formulaByIdx)) {
      const fbi: Record<string, SubtopicEngagementFormulaDraft> = {};
      for (const [fi, pack] of Object.entries(row.formulaByIdx as Record<string, unknown>)) {
        if (!pack || typeof pack !== "object" || Array.isArray(pack)) continue;
        const p = pack as Record<string, unknown>;
        const qIdx = Number(p.qIdx);
        const ans =
          p.answers && typeof p.answers === "object" && !Array.isArray(p.answers)
            ? (p.answers as Record<string, unknown>)
            : {};
        const answers: Record<string, number> = {};
        for (const [k, v] of Object.entries(ans)) {
          const idx = Number(v);
          if (!Number.isInteger(idx) || idx < 0 || idx > 3) continue;
          answers[String(k)] = idx;
        }
        fbi[fi] = {
          qIdx: Number.isFinite(qIdx) ? Math.max(0, Math.trunc(qIdx)) : 0,
          answers,
        };
      }
      if (Object.keys(fbi).length) snap.formulaByIdx = fbi;
    }
    if (row.instaCue === null) snap.instaCue = null;
    else if (row.instaCue && typeof row.instaCue === "object" && !Array.isArray(row.instaCue)) {
      const ic = row.instaCue as Record<string, unknown>;
      const nav = Array.isArray(ic.navVisited)
        ? (ic.navVisited as unknown[]).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n >= 0)
        : [];
      const flipped = Array.isArray(ic.flipped)
        ? (ic.flipped as unknown[]).map((x) => Number(x)).filter((n) => Number.isInteger(n) && n >= 0)
        : [];
      snap.instaCue = { navVisited: nav, flipped };
    }
    if (Array.isArray(row.conceptsPages)) {
      snap.conceptsPages = (row.conceptsPages as unknown[])
        .map((x) => Number(x))
        .filter((n) => Number.isInteger(n) && n >= 0);
    }
    const lessonDone = sanitize(row.lessonChecklistMarkedCompleteAt, 100);
    if (lessonDone) snap.lessonChecklistMarkedCompleteAt = lessonDone;
    if (row.lessonFocusTimer === null) {
      snap.lessonFocusTimer = null;
    } else if (row.lessonFocusTimer && typeof row.lessonFocusTimer === "object" && !Array.isArray(row.lessonFocusTimer)) {
      const lt = row.lessonFocusTimer as Record<string, unknown>;
      const sec = Number(lt.secondsRemaining);
      const running = Boolean(lt.running);
      if (Number.isFinite(sec)) {
        snap.lessonFocusTimer = {
          secondsRemaining: Math.max(0, Math.min(60 * 60, Math.round(sec))),
          running,
        };
      }
    }
    out[key] = snap;
  }
  return out;
}

function trimStore(store: Record<string, SubtopicEngagementSnapshot>): Record<string, SubtopicEngagementSnapshot> {
  const entries = Object.entries(store);
  if (entries.length <= MAX_ENGAGEMENT_KEYS) return store;
  entries.sort((a, b) => {
    const at = Date.parse(a[1].updatedAt);
    const bt = Date.parse(b[1].updatedAt);
    return (Number.isFinite(bt) ? bt : 0) - (Number.isFinite(at) ? at : 0);
  });
  return Object.fromEntries(entries.slice(0, MAX_ENGAGEMENT_KEYS));
}

export async function GET(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;

    const { searchParams } = new URL(request.url);
    const board = sanitize(searchParams.get("board"), 40);
    const subject = sanitize(searchParams.get("subject"), 80).toLowerCase();
    const classLevel = Number(searchParams.get("classLevel"));
    const topic = sanitize(searchParams.get("topic"), 300);
    const subtopicName = sanitize(searchParams.get("subtopicName"), 300);
    const level = sanitize(searchParams.get("level"), 30).toLowerCase();

    if (
      !board ||
      !subject ||
      !topic ||
      !subtopicName ||
      Number.isNaN(classLevel) ||
      ![11, 12].includes(classLevel) ||
      !ALLOWED_LEVELS.has(level)
    ) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const key = makeSubtopicEngagementStorageKey({
      board: board as Board,
      subject: subject as Subject,
      classLevel: classLevel as 11 | 12,
      topic,
      subtopicName,
      level: level as DifficultyLevel,
    });
    const row = data as ProfileEngagementRow | null;
    const store = parseEngagementStore(row?.subtopic_engagement);
    return NextResponse.json({ engagement: store[key] ?? null });
  } catch (e) {
    console.error("subtopic-engagement GET error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSupabaseAndUser(request);
    if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { supabase, user } = ctx;
    const body = await request.json();

    const board = sanitize(body?.board, 40);
    const subject = sanitize(body?.subject, 80).toLowerCase();
    const classLevel = Number(body?.classLevel);
    const topic = sanitize(body?.topic, 300);
    const subtopicName = sanitize(body?.subtopicName, 300);
    const level = sanitize(body?.level, 30).toLowerCase();
    const snapshot = body?.snapshot as SubtopicEngagementSnapshot | undefined;

    if (
      !board ||
      !subject ||
      !topic ||
      !subtopicName ||
      Number.isNaN(classLevel) ||
      ![11, 12].includes(classLevel) ||
      !ALLOWED_LEVELS.has(level) ||
      !snapshot ||
      snapshot.v !== 1 ||
      !sanitize(snapshot.bitsSignature, 200) ||
      !sanitize(snapshot.updatedAt, 80)
    ) {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }

    const key = makeSubtopicEngagementStorageKey({
      board: board as Board,
      subject: subject as Subject,
      classLevel: classLevel as 11 | 12,
      topic,
      subtopicName,
      level: level as DifficultyLevel,
    });
    const { data: profile, error: readErr } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

    const profileRow = profile as ProfileEngagementRow | null;
    const current = parseEngagementStore(profileRow?.subtopic_engagement);
    const next = trimStore({ ...current, [key]: snapshot });
    const { error: writeErr } = await supabase
      .from("profiles")
      .update({ subtopic_engagement: next } as never)
      .eq("id", user.id);
    if (writeErr) return NextResponse.json({ error: writeErr.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("subtopic-engagement POST error", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
