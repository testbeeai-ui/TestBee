import { supabase } from "@/integrations/supabase/client";
import type { DifficultyLevel } from "@/lib/slugs";
import type { Board, Subject } from "@/types";
import type { DeepDiveReference } from "@/data/deepDiveContent";
import type { TopicAgentTrace } from "@/lib/topicContentService";

const API = "/api/subtopic-content";
const API_GENERATE = "/api/agent/generate-subtopic";
const API_GENERATE_INSTACUE = "/api/agent/generate-instacue";
const API_GENERATE_BITS = "/api/agent/generate-bits";
const API_GENERATE_FORMULAS = "/api/agent/generate-formulas";
const API_UPDATE_FORMULAS = "/api/subtopic-content/formulas";

type SubtopicContentParams = {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  topic: string;
  subtopicName: string;
  level: DifficultyLevel;
};

export type ArtifactInstaCueCard = {
  type: string;
  frontContent: string;
  backContent: string;
};

export type ArtifactBitsQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  solution: string;
};

export type ArtifactFormula = {
  name: string;
  formulaLatex: string;
  description: string;
  bitsQuestions: ArtifactBitsQuestion[];
};

export type SubtopicContentResponse = {
  theory: string;
  references: DeepDiveReference[];
  didYouKnow: string;
  instacueCards: ArtifactInstaCueCard[];
  bitsQuestions: ArtifactBitsQuestion[];
  practiceFormulas: ArtifactFormula[];
  exists: boolean;
  canEdit: boolean;
};

async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {};
  if (typeof window !== "undefined") {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }
  }
  return headers;
}

function buildQuery(params: SubtopicContentParams): string {
  const search = new URLSearchParams({
    board: params.board,
    subject: params.subject,
    classLevel: String(params.classLevel),
    topic: params.topic,
    subtopicName: params.subtopicName,
    level: params.level,
  });
  return `${API}?${search.toString()}`;
}

function parseReferences(data: unknown): DeepDiveReference[] {
  if (!Array.isArray(data)) return [];
  const out: DeepDiveReference[] = [];
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    if (o.type !== "video" && o.type !== "reading") continue;
    const title = typeof o.title === "string" ? o.title : "";
    const url = typeof o.url === "string" ? o.url : "";
    if (!title || !url) continue;
    const description = typeof o.description === "string" ? o.description : undefined;
    out.push({ type: o.type, title, url, ...(description ? { description } : {}) });
  }
  return out;
}

export async function fetchSubtopicContent(params: SubtopicContentParams): Promise<SubtopicContentResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(buildQuery(params), { headers, cache: "no-store" });
  const empty: SubtopicContentResponse = {
    theory: "", references: [], didYouKnow: "",
    instacueCards: [], bitsQuestions: [], practiceFormulas: [],
    exists: false, canEdit: false,
  };
  if (!res.ok) {
    if (res.status === 401) return empty;
    throw new Error("Failed to fetch subtopic content");
  }
  const data = (await res.json()) as Record<string, unknown>;
  return {
    theory: typeof data.theory === "string" ? data.theory : "",
    references: parseReferences(data.references),
    didYouKnow: typeof data.didYouKnow === "string" ? data.didYouKnow : "",
    instacueCards: Array.isArray(data.instacueCards) ? data.instacueCards as ArtifactInstaCueCard[] : [],
    bitsQuestions: Array.isArray(data.bitsQuestions) ? data.bitsQuestions as ArtifactBitsQuestion[] : [],
    practiceFormulas: Array.isArray(data.practiceFormulas) ? data.practiceFormulas as ArtifactFormula[] : [],
    exists: data.exists === true,
    canEdit: data.canEdit === true,
  };
}

export async function upsertSubtopicContent(
  params: SubtopicContentParams & {
    theory: string;
    references: DeepDiveReference[];
    didYouKnow: string;
  }
): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(API, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      ...params,
      references: params.references,
      didYouKnow: params.didYouKnow,
    }),
  });
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Unauthorized");
    }
    if (res.status === 403) {
      throw new Error("Forbidden");
    }
    throw new Error("Failed to save subtopic content");
  }
}

export type GenerateSubtopicBody = SubtopicContentParams & {
  chapterTitle?: string;
  /** Existing preview from the topic hub to seed the generation. */
  preview?: string;
  /** Admin-only: return full run trace payload */
  includeTrace?: boolean;
};

export type GenerateSubtopicResponse = {
  ok: boolean;
  theory: string;
  didYouKnow: string;
  references: DeepDiveReference[];
  ragChunks?: number;
  modelId?: string;
  trace?: TopicAgentTrace;
};

export async function generateSubtopicContent(
  body: GenerateSubtopicBody
): Promise<GenerateSubtopicResponse> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(API_GENERATE, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      board: body.board,
      subject: body.subject,
      classLevel: body.classLevel,
      topic: body.topic,
      subtopicName: body.subtopicName,
      level: body.level,
      chapterTitle: body.chapterTitle,
      preview: body.preview,
      includeTrace: body.includeTrace === true,
    }),
  });
  const data = (await res.json()) as Partial<GenerateSubtopicResponse> & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Deep dive generation failed");
  }
  return {
    ok: true,
    theory: typeof data.theory === "string" ? data.theory : "",
    didYouKnow: typeof data.didYouKnow === "string" ? data.didYouKnow : "",
    references: parseReferences(data.references),
    ragChunks: typeof data.ragChunks === "number" ? data.ragChunks : undefined,
    modelId: typeof data.modelId === "string" ? data.modelId : undefined,
    trace:
      data.trace && typeof data.trace === "object"
        ? (data.trace as TopicAgentTrace)
        : undefined,
  };
}

// ---------- Artifact generation (InstaCue / Bits / Formulas) ----------

type ArtifactGenerateBody = SubtopicContentParams & { includeTrace?: boolean };

export type ArtifactGenerateResponse<T> = {
  ok: boolean;
  items: T[];
  modelId?: string;
  trace?: TopicAgentTrace;
};

async function callArtifactApi<T>(
  endpoint: string,
  body: ArtifactGenerateBody
): Promise<ArtifactGenerateResponse<T>> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      board: body.board,
      subject: body.subject,
      classLevel: body.classLevel,
      topic: body.topic,
      subtopicName: body.subtopicName,
      level: body.level,
      includeTrace: body.includeTrace === true,
    }),
  });
  const data = (await res.json()) as Record<string, unknown> & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Artifact generation failed");
  }
  return {
    ok: true,
    items: Array.isArray(data.items) ? (data.items as T[]) : [],
    modelId: typeof data.modelId === "string" ? data.modelId : undefined,
    trace:
      data.trace && typeof data.trace === "object"
        ? (data.trace as TopicAgentTrace)
        : undefined,
  };
}

export function generateInstaCueCards(
  body: ArtifactGenerateBody
): Promise<ArtifactGenerateResponse<ArtifactInstaCueCard>> {
  return callArtifactApi<ArtifactInstaCueCard>(API_GENERATE_INSTACUE, body);
}

export function generateBitsQuestions(
  body: ArtifactGenerateBody
): Promise<ArtifactGenerateResponse<ArtifactBitsQuestion>> {
  return callArtifactApi<ArtifactBitsQuestion>(API_GENERATE_BITS, body);
}

export function generateFormulaPractice(
  body: ArtifactGenerateBody
): Promise<ArtifactGenerateResponse<ArtifactFormula>> {
  return callArtifactApi<ArtifactFormula>(API_GENERATE_FORMULAS, body);
}

export async function saveFormulaPractice(
  body: SubtopicContentParams & { practiceFormulas: ArtifactFormula[] }
): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(API_UPDATE_FORMULAS, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      board: body.board,
      subject: body.subject,
      classLevel: body.classLevel,
      topic: body.topic,
      subtopicName: body.subtopicName,
      level: body.level,
      practiceFormulas: body.practiceFormulas,
    }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error || "Failed to save practice formulas");
}
