/**
 * Topic hub JSON generation — Google AI Studio (API key) OR Vertex AI via @google/genai.
 * Vertex uses the same SDK as AI Studio with `vertexai: true` + project + location (recommended over deprecated @google-cloud/vertexai).
 * When GEMINI_USE_VERTEX=true, stay on the Vertex path and do not fail over to the free-tier API key backend.
 */

import { ApiError, GoogleGenAI, Type } from "@google/genai";

export type GeminiUsageStats = {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
};

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Cause chain (e.g. fetch failed → ECONNRESET) for Node / undici. */
function errorTextDeep(e: unknown): string {
  const parts: string[] = [];
  let cur: unknown = e;
  let depth = 0;
  while (cur && depth < 6) {
    if (cur instanceof Error) {
      parts.push(cur.message, String((cur as NodeJS.ErrnoException).code ?? ""));
      cur = (cur as Error & { cause?: unknown }).cause;
    } else {
      parts.push(String(cur));
      break;
    }
    depth += 1;
  }
  return parts.join(" ");
}

/** Vertex / Gemini burst limits — retry with backoff (especially 429 RESOURCE_EXHAUSTED). */
function isRetryableGeminiError(e: unknown): boolean {
  if (e instanceof ApiError) {
    const s = e.status;
    return s === 429 || s === 500 || s === 502 || s === 503;
  }
  const blob = errorTextDeep(e);
  if (
    /ECONNRESET|ETIMEDOUT|ECONNABORTED|EPIPE|ENOTFOUND|EAI_AGAIN|UND_ERR_(CONNECT_TIMEOUT|BODY_TIMEOUT|SOCKET)/i.test(
      blob
    ) ||
    /\bfetch failed\b/i.test(blob)
  ) {
    return true;
  }
  return /429|RESOURCE_EXHAUSTED|resource exhausted|503|UNAVAILABLE|502|500/i.test(blob);
}

function geminiRetryWaitMs(attemptIndex: number, status: number | undefined): number {
  const quota = status === 429;
  const base = quota ? 14_000 : 5_000;
  const cap = 120_000;
  const exp = Math.min(cap, base * 2 ** attemptIndex);
  const jitter = Math.floor(Math.random() * 2_500);
  return exp + jitter;
}

async function generateContentWithRetries(
  client: GoogleGenAI,
  modelId: string,
  userPrompt: string,
  config: {
    systemInstruction: string;
    responseMimeType: "application/json";
    responseSchema: unknown;
    temperature: number;
    maxOutputTokens?: number;
  },
  maxAttempts = 6
): Promise<{ raw: string; usage: GeminiUsageStats }> {
  let last: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await client.models.generateContent({
        model: modelId,
        contents: userPrompt,
        config,
      });
      const raw = response.text;
      if (!raw) throw new Error("Empty model response");
      const usage = response.usageMetadata;
      return {
        raw,
        usage: {
          promptTokenCount: Number(usage?.promptTokenCount ?? 0),
          candidatesTokenCount: Number(usage?.candidatesTokenCount ?? 0),
          totalTokenCount: Number(usage?.totalTokenCount ?? 0),
        },
      };
    } catch (e) {
      last = e;
      const retryable = isRetryableGeminiError(e) && attempt < maxAttempts;
      if (!retryable) throw e;
      const status = e instanceof ApiError ? e.status : undefined;
      const wait = geminiRetryWaitMs(attempt - 1, status);
      console.warn(
        `[geminiTopicGenerate] attempt ${attempt}/${maxAttempts} failed (${status ?? "?"}) — retrying in ${Math.round(wait / 1000)}s`,
        e instanceof Error ? e.message : String(e)
      );
      await sleepMs(wait);
    }
  }
  throw last instanceof Error ? last : new Error("Gemini call failed after retries");
}

export function isVertexForTopicAgentEnabled(): boolean {
  const v = process.env.GEMINI_USE_VERTEX?.trim().toLowerCase();
  return (v === "true" || v === "1") && Boolean(process.env.GOOGLE_CLOUD_PROJECT?.trim());
}

/**
 * Preview models listed in Vertex docs as "Global" only resolve under location `global`.
 * Using e.g. us-central1 returns 404 Publisher Model not found for the same model id.
 * @see https://cloud.google.com/vertex-ai/generative-ai/docs/models/gemini/3-1-pro
 */
const VERTEX_GLOBAL_ONLY_MODEL_IDS = new Set([
  "gemini-3.1-pro-preview",
  "gemini-3.1-pro-preview-customtools",
  /** Gemini 3 / 3.1 Flash family on Vertex is global-only (not us-central1). */
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
]);

/**
 * Vertex location for Gemini calls. For global-only model ids, always `global` regardless of
 * GOOGLE_CLOUD_LOCATION (quotas are still project-scoped in Cloud Console).
 */
export function vertexLocationOrDefault(vertexModelId?: string): string {
  const env = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "";
  const id = vertexModelId?.trim().toLowerCase() ?? "";
  if (id && VERTEX_GLOBAL_ONLY_MODEL_IDS.has(id)) {
    if (env && env !== "global") {
      console.warn(
        `[geminiTopicGenerate] Model "${vertexModelId}" is only published on Vertex location "global"; ignoring GOOGLE_CLOUD_LOCATION=${JSON.stringify(env)}.`
      );
    }
    return "global";
  }
  return env || "global";
}

function topicHubResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      why_study: {
        type: Type.STRING,
        description:
          "Markdown: level-structured topic master guide with educator headings (core concept, terminology, formula framework, exam patterns, mistakes, solving approach, revision checklist).",
      },
      what_learn: { type: Type.STRING, description: "Markdown: what you will learn" },
      real_world: { type: Type.STRING, description: "Markdown: real-world importance" },
      subtopic_previews: {
        type: Type.ARRAY,
        description: "Array of level-wise previews for each subtopic in syllabus order.",
        items: {
          type: Type.OBJECT,
          properties: {
            subtopic_name: { type: Type.STRING },
            preview: {
              type: Type.STRING,
              description: "Markdown: detailed content for the subtopic. For advanced level, this must be exhaustive and long.",
            },
          },
          required: ["subtopic_name", "preview"],
        },
      },
    },
    required: ["why_study", "what_learn", "real_world", "subtopic_previews"],
  };
}

function subtopicDeepDiveResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      theory: { type: Type.STRING, description: "Markdown: full deep-dive lesson for one subtopic." },
      did_you_know: { type: Type.STRING, description: "Short curiosity hook/fact." },
      references: {
        type: Type.ARRAY,
        description: "Suggested video/reading resources.",
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            title: { type: Type.STRING },
            url: { type: Type.STRING },
            description: { type: Type.STRING },
          },
          required: ["type", "title", "url"],
        },
      },
    },
    required: ["theory", "did_you_know", "references"],
  };
}

async function generateContentJson(
  client: GoogleGenAI,
  modelId: string,
  userPrompt: string,
  systemInstruction: string,
  temperature: number,
  maxOutputTokens?: number
): Promise<{ raw: string; usage: GeminiUsageStats }> {
  const config: {
    systemInstruction: string;
    responseMimeType: "application/json";
    responseSchema: ReturnType<typeof topicHubResponseSchema>;
    temperature: number;
    maxOutputTokens?: number;
  } = {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema: topicHubResponseSchema(),
    temperature,
  };
  if (typeof maxOutputTokens === "number") {
    config.maxOutputTokens = maxOutputTokens;
  }

  return generateContentWithRetries(client, modelId, userPrompt, config);
}

async function generateSubtopicContentJson(
  client: GoogleGenAI,
  modelId: string,
  userPrompt: string,
  systemInstruction: string,
  temperature: number,
  maxOutputTokens?: number
): Promise<{ raw: string; usage: GeminiUsageStats }> {
  const config: {
    systemInstruction: string;
    responseMimeType: "application/json";
    responseSchema: ReturnType<typeof subtopicDeepDiveResponseSchema>;
    temperature: number;
    maxOutputTokens?: number;
  } = {
    systemInstruction,
    responseMimeType: "application/json",
    responseSchema: subtopicDeepDiveResponseSchema(),
    temperature,
  };
  if (typeof maxOutputTokens === "number") {
    config.maxOutputTokens = maxOutputTokens;
  }

  // Same as artifacts: long JSON deep-dives often hit transient ECONNRESET / 503 from Vertex or the edge.
  return generateContentWithRetries(client, modelId, userPrompt, config);
}

export type TopicGeminiBackend = "api_key" | "vertex";

export async function generateTopicHubJson(params: {
  apiKey: string | undefined;
  modelId: string;
  userPrompt: string;
  systemInstruction: string;
  temperature: number;
  maxOutputTokens?: number;
}): Promise<{ raw: string; backend: TopicGeminiBackend; usage: GeminiUsageStats }> {
  if (isVertexForTopicAgentEnabled()) {
    const project = process.env.GOOGLE_CLOUD_PROJECT!.trim();
    const location = vertexLocationOrDefault(params.modelId);

    const ai = new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });

    const out = await generateContentJson(
      ai,
      params.modelId,
      params.userPrompt,
      params.systemInstruction,
      params.temperature,
      params.maxOutputTokens
    );
    return { raw: out.raw, backend: "vertex", usage: out.usage };
  }

  const key = params.apiKey?.trim();
  if (!key) {
    throw new Error(
      "Gemini API key is not set (use GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY for the AI Studio path), or set GEMINI_USE_VERTEX=true with GOOGLE_CLOUD_PROJECT and Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or gcloud auth application-default login)."
    );
  }

  const ai = new GoogleGenAI({ apiKey: key });
  const out = await generateContentJson(
    ai,
    params.modelId,
    params.userPrompt,
    params.systemInstruction,
    params.temperature,
    params.maxOutputTokens
  );
  return { raw: out.raw, backend: "api_key", usage: out.usage };
}

export async function generateSubtopicJson(params: {
  apiKey: string | undefined;
  modelId: string;
  userPrompt: string;
  systemInstruction: string;
  temperature: number;
  maxOutputTokens?: number;
}): Promise<{ raw: string; backend: TopicGeminiBackend; usage: GeminiUsageStats }> {
  if (isVertexForTopicAgentEnabled()) {
    const project = process.env.GOOGLE_CLOUD_PROJECT!.trim();
    const location = vertexLocationOrDefault(params.modelId);

    const ai = new GoogleGenAI({
      vertexai: true,
      project,
      location,
    });

    const out = await generateSubtopicContentJson(
      ai,
      params.modelId,
      params.userPrompt,
      params.systemInstruction,
      params.temperature,
      params.maxOutputTokens
    );
    return { raw: out.raw, backend: "vertex", usage: out.usage };
  }

  const key = params.apiKey?.trim();
  if (!key) {
    throw new Error(
      "Gemini API key is not set (use GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY for the AI Studio path), or set GEMINI_USE_VERTEX=true with GOOGLE_CLOUD_PROJECT and Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS or gcloud auth application-default login)."
    );
  }

  const ai = new GoogleGenAI({ apiKey: key });
  const out = await generateSubtopicContentJson(
    ai,
    params.modelId,
    params.userPrompt,
    params.systemInstruction,
    params.temperature,
    params.maxOutputTokens
  );
  return { raw: out.raw, backend: "api_key", usage: out.usage };
}

// ---------- Artifact schemas (InstaCue / Bits / Formulas) ----------

export function instaCueResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: "Array of InstaCue flashcards.",
        items: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING, description: "Card type: concept, formula, common_mistake, or trap." },
            frontContent: { type: Type.STRING, description: "The question or concept on the front of the card." },
            backContent: { type: Type.STRING, description: "The crisp answer or definition on the back." },
          },
          required: ["type", "frontContent", "backContent"],
        },
      },
    },
    required: ["items"],
  };
}

export function bitsResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: "Array of MCQ questions (Bits).",
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING, description: "The MCQ question text." },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Array of 4 answer options.",
            },
            correctAnswer: { type: Type.STRING, description: "The correct option text (must match one of the options exactly)." },
            solution: { type: Type.STRING, description: "Step-by-step solution explanation." },
          },
          required: ["question", "options", "correctAnswer", "solution"],
        },
      },
    },
    required: ["items"],
  };
}

export function formulasResponseSchema() {
  return {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description: "Array of formulas with practice questions.",
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Name of the formula (e.g. Newton's Second Law)." },
            formulaLatex: { type: Type.STRING, description: "The formula in LaTeX notation." },
            description: { type: Type.STRING, description: "Short description of what the formula represents." },
            bitsQuestions: {
              type: Type.ARRAY,
              description: "Practice MCQs that test application of this formula.",
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  solution: { type: Type.STRING },
                },
                required: ["question", "options", "correctAnswer", "solution"],
              },
            },
          },
          required: ["name", "formulaLatex", "description", "bitsQuestions"],
        },
      },
    },
    required: ["items"],
  };
}

export async function generateArtifactJson(params: {
  apiKey: string | undefined;
  modelId: string;
  userPrompt: string;
  systemInstruction: string;
  temperature: number;
  responseSchema: Record<string, unknown>;
  maxOutputTokens?: number;
}): Promise<{ raw: string; backend: TopicGeminiBackend; usage: GeminiUsageStats }> {
  const config: {
    systemInstruction: string;
    responseMimeType: "application/json";
    responseSchema: typeof params.responseSchema;
    temperature: number;
    maxOutputTokens?: number;
  } = {
    systemInstruction: params.systemInstruction,
    responseMimeType: "application/json",
    responseSchema: params.responseSchema,
    temperature: params.temperature,
  };
  if (typeof params.maxOutputTokens === "number") {
    config.maxOutputTokens = params.maxOutputTokens;
  }

  if (isVertexForTopicAgentEnabled()) {
    const project = process.env.GOOGLE_CLOUD_PROJECT!.trim();
    const location = vertexLocationOrDefault(params.modelId);
    const ai = new GoogleGenAI({ vertexai: true, project, location });
    const out = await generateContentWithRetries(
      ai,
      params.modelId,
      params.userPrompt,
      config,
      6
    );
    return { raw: out.raw, backend: "vertex", usage: out.usage };
  }

  const key = params.apiKey?.trim();
  if (!key) {
    throw new Error(
      "Gemini API key is not set (use GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY for the AI Studio path), or set GEMINI_USE_VERTEX=true with GOOGLE_CLOUD_PROJECT."
    );
  }
  const ai = new GoogleGenAI({ apiKey: key });
  const out = await generateContentWithRetries(ai, params.modelId, params.userPrompt, config);
  return { raw: out.raw, backend: "api_key", usage: out.usage };
}
