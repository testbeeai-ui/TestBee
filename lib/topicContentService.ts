import { supabase } from "@/integrations/supabase/client";
import type { DifficultyLevel } from "@/lib/slugs";
import type { Board, Subject } from "@/types";

const API_GET = "/api/topic-content";
const API_GENERATE = "/api/agent/generate-topic";

/** topic = per-topic hub (e.g. Coulomb's Law); chapter = Explore whole-chapter landing (topic param = chapter title). */
export type TopicHubScope = "topic" | "chapter";

export type TopicContentParams = {
  board: Board;
  subject: Subject;
  classLevel: 11 | 12;
  topic: string;
  level: DifficultyLevel;
  /** Defaults to topic (per-topic hub). */
  hubScope?: TopicHubScope;
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

export type TopicContentFetchOptions = {
  includeLatestRun?: boolean;
};

export type TopicRunMetadata = {
  runType: string;
  ragChunkCount: number;
  modelId: string;
  createdAt: string;
};

export type TopicSubtopicPreview = {
  subtopicName: string;
  preview: string;
};

function normalizeSubtopicPreviews(value: unknown): TopicSubtopicPreview[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as Record<string, unknown>;
      const subtopicName = String(row.subtopicName ?? row.subtopic_name ?? "").trim();
      const preview = typeof row.preview === "string" ? row.preview.trim() : "";
      if (!subtopicName || !preview) return null;
      return { subtopicName, preview };
    })
    .filter((row): row is TopicSubtopicPreview => Boolean(row))
    .slice(0, 80);
}

function buildQuery(params: TopicContentParams, options?: TopicContentFetchOptions): string {
  const hubScope = params.hubScope === "chapter" ? "chapter" : "topic";
  const search = new URLSearchParams({
    board: params.board,
    subject: params.subject,
    classLevel: String(params.classLevel),
    topic: params.topic,
    level: params.level,
    hubScope,
  });
  if (options?.includeLatestRun) {
    search.set("includeLatestRun", "1");
  }
  return `${API_GET}?${search.toString()}`;
}

export type TopicContentResponse = {
  whyStudy: string;
  whatLearn: string;
  realWorld: string;
  subtopicPreviews: TopicSubtopicPreview[];
  exists: boolean;
  canEdit: boolean;
  lastRun?: TopicRunMetadata | null;
};

export async function fetchTopicContent(
  params: TopicContentParams,
  options?: TopicContentFetchOptions
): Promise<TopicContentResponse> {
  const headers = await getAuthHeaders();
  const res = await fetch(buildQuery(params, options), { headers });
  if (!res.ok) {
    if (res.status === 401) {
      return {
        whyStudy: "",
        whatLearn: "",
        realWorld: "",
        subtopicPreviews: [],
        exists: false,
        canEdit: false,
      };
    }
    throw new Error("Failed to fetch topic content");
  }
  const data = (await res.json()) as Partial<TopicContentResponse> & {
    lastRun?: TopicRunMetadata | null;
  };
  const lastRun =
    data.lastRun != null && typeof data.lastRun === "object"
      ? {
          runType: typeof data.lastRun.runType === "string" ? data.lastRun.runType : "",
          ragChunkCount:
            typeof data.lastRun.ragChunkCount === "number" ? data.lastRun.ragChunkCount : 0,
          modelId: typeof data.lastRun.modelId === "string" ? data.lastRun.modelId : "",
          createdAt: typeof data.lastRun.createdAt === "string" ? data.lastRun.createdAt : "",
        }
      : options?.includeLatestRun
        ? null
        : undefined;
  return {
    whyStudy: typeof data.whyStudy === "string" ? data.whyStudy : "",
    whatLearn: typeof data.whatLearn === "string" ? data.whatLearn : "",
    realWorld: typeof data.realWorld === "string" ? data.realWorld : "",
    subtopicPreviews: normalizeSubtopicPreviews(data.subtopicPreviews),
    exists: data.exists === true,
    canEdit: data.canEdit === true,
    ...(options?.includeLatestRun ? { lastRun } : {}),
  };
}

export type TopicFeedbackPayload = {
  liked?: string;
  disliked?: string;
  instructions?: string;
};

export type GenerateTopicBody = TopicContentParams & {
  unitLabel?: string | null;
  unitTitle?: string | null;
  chapterTitle?: string | null;
  subtopicNames: string[];
  /** When hubScope is chapter, list syllabus topic titles in that chapter (for prompts). */
  memberTopicTitles?: string[];
  mode?: "generate" | "regenerate";
  feedback?: TopicFeedbackPayload;
  /** Admin-only: server returns full pipeline + prompts + RAG details */
  includeTrace?: boolean;
};

/** Admin-only payload from POST /api/agent/generate-topic when includeTrace is true */
export type TopicAgentTrace = {
  generatedAt?: string;
  pipelineSteps?: string[];
  gemini?: {
    modelId?: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
    outputSchema?: { type?: string; required?: string[]; keys?: string[] };
  };
  rag?: {
    sidecarConfigured?: boolean;
    skippedAsGeneric?: boolean;
    intent?: string;
    baseQuery?: string;
    augmentedQuery?: string;
    http?: string;
    requestJson?: Record<string, unknown>;
    chunksReturned?: number;
    outcomeSummary?: string;
    formattedContextEmbeddedInPrompt?: string;
    formattedContextTruncated?: boolean;
  };
  prompts?: {
    systemInstruction?: string;
    systemInstructionTruncated?: boolean;
    userPrompt?: string;
    userPromptTruncated?: boolean;
  };
  feedbackCaptured?: {
    liked?: string;
    disliked?: string;
    instructions?: string;
  } | null;
};

export type GenerateTopicResponse = {
  ok: boolean;
  whyStudy: string;
  whatLearn: string;
  realWorld: string;
  subtopicPreviews: TopicSubtopicPreview[];
  ragChunks?: number;
  modelId?: string;
  runType?: string;
  runMeta?: TopicRunMetadata;
  trace?: TopicAgentTrace;
};

export async function generateTopicContent(body: GenerateTopicBody): Promise<GenerateTopicResponse> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(API_GENERATE, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      board: body.board,
      subject: body.subject,
      classLevel: body.classLevel,
      topic: body.topic,
      level: body.level,
      hubScope: body.hubScope === "chapter" ? "chapter" : "topic",
      unitLabel: body.unitLabel ?? undefined,
      unitTitle: body.unitTitle ?? undefined,
      chapterTitle: body.chapterTitle ?? undefined,
      subtopicNames: body.subtopicNames,
      memberTopicTitles: body.memberTopicTitles?.length ? body.memberTopicTitles : undefined,
      mode: body.mode ?? "generate",
      feedback: body.feedback,
      includeTrace: body.includeTrace === true,
    }),
  });
  const data = (await res.json()) as Partial<GenerateTopicResponse> & { error?: string; trace?: TopicAgentTrace };
  if (!res.ok) {
    throw new Error(data.error || "Generation failed");
  }
  const runMeta =
    data.runMeta != null && typeof data.runMeta === "object"
      ? {
          runType: typeof data.runMeta.runType === "string" ? data.runMeta.runType : "",
          ragChunkCount:
            typeof data.runMeta.ragChunkCount === "number" ? data.runMeta.ragChunkCount : 0,
          modelId: typeof data.runMeta.modelId === "string" ? data.runMeta.modelId : "",
          createdAt: typeof data.runMeta.createdAt === "string" ? data.runMeta.createdAt : "",
        }
      : undefined;
  return {
    ok: true,
    whyStudy: typeof data.whyStudy === "string" ? data.whyStudy : "",
    whatLearn: typeof data.whatLearn === "string" ? data.whatLearn : "",
    realWorld: typeof data.realWorld === "string" ? data.realWorld : "",
    subtopicPreviews: normalizeSubtopicPreviews(data.subtopicPreviews),
    ragChunks: typeof data.ragChunks === "number" ? data.ragChunks : undefined,
    modelId: typeof data.modelId === "string" ? data.modelId : undefined,
    runType: typeof data.runType === "string" ? data.runType : undefined,
    runMeta,
    trace: body.includeTrace && data.trace && typeof data.trace === "object" ? data.trace : undefined,
  };
}

export async function upsertTopicContent(
  body: TopicContentParams & {
    whyStudy: string;
    whatLearn: string;
    realWorld: string;
    subtopicPreviews?: TopicSubtopicPreview[];
  }
): Promise<void> {
  const authHeaders = await getAuthHeaders();
  const res = await fetch(API_GET, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({
      board: body.board,
      subject: body.subject,
      classLevel: body.classLevel,
      topic: body.topic,
      level: body.level,
      hubScope: body.hubScope === "chapter" ? "chapter" : "topic",
      whyStudy: body.whyStudy,
      whatLearn: body.whatLearn,
      realWorld: body.realWorld,
      subtopicPreviews: body.subtopicPreviews ?? [],
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    throw new Error(data.error || "Failed to save topic content");
  }
}
