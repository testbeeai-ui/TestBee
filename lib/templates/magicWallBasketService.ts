import { fetchWithClientAuth } from "@/lib/auth/clientApiAuth";
import type { MagicWallUsage } from "@/lib/subscription/magicWallQuota";
import type { Board, ClassLevel, ExamType, Subject } from "@/types";

const API = "/api/magic-wall/basket";

export type { MagicWallUsage };

export type MagicWallBasketItem = {
  id: string;
  topicKey: string;
  board: Board;
  subject: Subject;
  classLevel: ClassLevel;
  examType: ExamType | null;
  unitName: string;
  chapterTitle: string;
  topicName: string;
  createdAt: string;
  updatedAt: string;
};

export type MagicWallBasketInsert = {
  topicKey: string;
  board: Board;
  subject: Subject;
  classLevel: ClassLevel;
  examType: ExamType | null;
  unitName: string;
  chapterTitle: string;
  topicName: string;
};

export type MagicWallBasketResponse = {
  items: MagicWallBasketItem[];
  usage: MagicWallUsage | null;
};

export function normalizeKeyPart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[&]/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function makeTopicKey(input: {
  board: Board;
  subject: Subject;
  classLevel: ClassLevel;
  unitName: string;
  chapterTitle: string;
  topicName: string;
}): string {
  return [
    normalizeKeyPart(input.board),
    normalizeKeyPart(input.subject),
    String(input.classLevel),
    normalizeKeyPart(input.unitName),
    normalizeKeyPart(input.chapterTitle),
    normalizeKeyPart(input.topicName),
  ].join("||");
}

function normalizeItems(data: unknown): MagicWallBasketItem[] {
  if (!Array.isArray(data)) return [];
  const out: MagicWallBasketItem[] = [];
  for (const row of data) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    const topicKey = typeof o.topicKey === "string" ? o.topicKey : "";
    const board = o.board === "ICSE" ? "ICSE" : "CBSE";
    const subject = o.subject;
    if (subject !== "physics" && subject !== "chemistry" && subject !== "math") continue;
    const classLevel = Number(o.classLevel) === 12 ? 12 : 11;
    const examTypeRaw = o.examType;
    const examType =
      examTypeRaw === "JEE" ||
      examTypeRaw === "JEE_Mains" ||
      examTypeRaw === "JEE_Advance" ||
      examTypeRaw === "NEET" ||
      examTypeRaw === "KCET" ||
      examTypeRaw === "other"
        ? examTypeRaw
        : null;
    const unitName = typeof o.unitName === "string" ? o.unitName : "";
    const chapterTitle = typeof o.chapterTitle === "string" ? o.chapterTitle : "";
    const topicName = typeof o.topicName === "string" ? o.topicName : "";
    const createdAt = typeof o.createdAt === "string" ? o.createdAt : "";
    const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
    if (!id || !topicKey || !topicName) continue;
    out.push({
      id,
      topicKey,
      board,
      subject: subject as Subject,
      classLevel,
      examType,
      unitName,
      chapterTitle,
      topicName,
      createdAt,
      updatedAt,
    });
  }
  return out;
}

function normalizeUsage(data: unknown): MagicWallUsage | null {
  if (!data || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  const plan = o.plan;
  if (
    plan !== "free" &&
    plan !== "free_trial" &&
    plan !== "starter" &&
    plan !== "pro"
  ) {
    return null;
  }
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const numOrNull = (v: unknown) =>
    v === null ? null : typeof v === "number" && Number.isFinite(v) ? v : 0;
  const periodStart = typeof o.periodStart === "string" ? o.periodStart : "";
  const periodEnd = typeof o.periodEnd === "string" ? o.periodEnd : "";
  if (!periodStart || !periodEnd) return null;
  return {
    plan,
    maxActive: num(o.maxActive),
    monthlyLimit: num(o.monthlyLimit),
    monthlyUsed: num(o.monthlyUsed),
    monthlyRemaining: numOrNull(o.monthlyRemaining),
    activeCount: num(o.activeCount),
    activeSlotsRemaining: numOrNull(o.activeSlotsRemaining),
    newPicksAllowed: numOrNull(o.newPicksAllowed),
    periodStart,
    periodEnd,
  };
}

export async function fetchMagicWallBasket(): Promise<MagicWallBasketResponse> {
  const res = await fetchWithClientAuth(API, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401) return { items: [], usage: null };
    throw new Error("Failed to fetch Magic Wall basket");
  }
  const data = (await res.json()) as { items?: unknown; usage?: unknown };
  return {
    items: normalizeItems(data.items),
    usage: normalizeUsage(data.usage),
  };
}

export async function upsertMagicWallBasketItems(items: MagicWallBasketInsert[]): Promise<void> {
  if (items.length === 0) return;
  const res = await fetchWithClientAuth(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Failed to save Magic Wall basket items");
  }
}

export async function removeMagicWallBasketItems(topicKeys: string[]): Promise<void> {
  if (topicKeys.length === 0) return;
  const res = await fetchWithClientAuth(API, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topicKeys }),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Unauthorized");
    const body = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error || "Failed to remove Magic Wall basket items");
  }
}
