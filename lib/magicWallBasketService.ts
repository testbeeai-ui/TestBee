import { fetchWithClientAuth } from "@/lib/clientApiAuth";
import type { Board, ClassLevel, ExamType, Subject } from "@/types";

const API = "/api/magic-wall/basket";

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
    if (subject !== "physics" && subject !== "chemistry" && subject !== "math" && subject !== "biology") continue;
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
      subject,
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

export async function fetchMagicWallBasket(): Promise<MagicWallBasketItem[]> {
  const res = await fetchWithClientAuth(API, { cache: "no-store" });
  if (!res.ok) {
    if (res.status === 401) return [];
    throw new Error("Failed to fetch Magic Wall basket");
  }
  const data = (await res.json()) as { items?: unknown };
  return normalizeItems(data.items);
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
