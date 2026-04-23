import type { ArtifactBitsQuestion } from "@/lib/subtopicContentService";

export type TeacherTestBankRow = {
  topic: string | null;
  subtopic_name: string | null;
  level: string | null;
  bits_questions: unknown;
};

export type TeacherTestQuestion = {
  id: string;
  topic: string;
  subtopicName: string;
  level: "basics" | "intermediate" | "advanced" | "unknown";
  question: string;
  options: string[];
  correctAnswerIndex: number | null;
  solution: string;
};

type Bucket = {
  key: string;
  topic: string;
  subtopicName: string;
  questions: TeacherTestQuestion[];
};

type BuildOptions = {
  rng?: () => number;
};

function normalizeLevel(raw: string | null): TeacherTestQuestion["level"] {
  const level = (raw ?? "").trim().toLowerCase();
  if (level === "basics" || level === "intermediate" || level === "advanced") return level;
  return "unknown";
}

function normalizeText(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function parseCorrectAnswerIndex(raw: unknown, options: string[]): number | null {
  if (!Array.isArray(options) || options.length === 0) return null;
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw < options.length) {
    return raw;
  }
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;

  const n = Number.parseInt(t, 10);
  if (Number.isFinite(n)) {
    if (n >= 1 && n <= options.length) return n - 1;
    if (n >= 0 && n < options.length) return n;
  }

  const upper = t.toUpperCase();
  if (/^[A-D]$/.test(upper)) {
    const idx = upper.charCodeAt(0) - 65;
    return idx >= 0 && idx < options.length ? idx : null;
  }

  const byOption = options.findIndex((opt) => opt.trim().toLowerCase() === t.toLowerCase());
  return byOption >= 0 ? byOption : null;
}

function parseArtifactBitsQuestion(raw: unknown): ArtifactBitsQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const v = raw as {
    question?: unknown;
    options?: unknown;
    correctAnswer?: unknown;
    solution?: unknown;
  };
  const question = normalizeText(v.question);
  const options = Array.isArray(v.options)
    ? v.options.map((opt) => normalizeText(opt)).filter(Boolean)
    : [];
  const correctAnswer =
    typeof v.correctAnswer === "string" || typeof v.correctAnswer === "number"
      ? String(v.correctAnswer)
      : "";
  const solution = normalizeText(v.solution);
  if (!question || options.length < 2) return null;
  return { question, options, correctAnswer, solution };
}

function fisherYatesShuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function dedupeByStem(questions: TeacherTestQuestion[]): TeacherTestQuestion[] {
  const seen = new Set<string>();
  const out: TeacherTestQuestion[] = [];
  for (const q of questions) {
    const key = q.question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

function buildBuckets(rows: TeacherTestBankRow[]): Bucket[] {
  const map = new Map<string, Bucket>();

  for (const row of rows) {
    const topic = normalizeText(row.topic);
    const subtopicName = normalizeText(row.subtopic_name);
    const key = `${topic.toLowerCase()}::${subtopicName.toLowerCase()}`;
    if (!topic || !subtopicName || !key) continue;

    const bitsArray = Array.isArray(row.bits_questions) ? row.bits_questions : [];
    const bucket = map.get(key) ?? { key, topic, subtopicName, questions: [] };

    for (const rawQuestion of bitsArray) {
      const parsed = parseArtifactBitsQuestion(rawQuestion);
      if (!parsed) continue;
      const correctAnswerIndex = parseCorrectAnswerIndex(parsed.correctAnswer, parsed.options);
      bucket.questions.push({
        id: "", // Will be assigned after deduplication
        topic,
        subtopicName,
        level: normalizeLevel(row.level),
        question: parsed.question,
        options: parsed.options,
        correctAnswerIndex,
        solution: parsed.solution,
      });
    }

    map.set(key, bucket);
  }

  const buckets = [...map.values()]
    .map((bucket) => ({
      ...bucket,
      questions: dedupeByStem(bucket.questions).map((q, idx) => ({
        ...q,
        id: `${bucket.key}::${idx + 1}`,
      })),
    }))
    .filter((bucket) => bucket.questions.length > 0);
  return buckets;
}

function allocatePerBucket(
  buckets: Bucket[],
  totalQuestions: number
): { quotaByBucket: number[]; requested: number } {
  const requested = Math.max(0, Math.floor(totalQuestions));
  if (buckets.length === 0 || requested === 0) {
    return { quotaByBucket: buckets.map(() => 0), requested };
  }
  const base = Math.floor(requested / buckets.length);
  const remainder = requested % buckets.length;
  const quotaByBucket = buckets.map((_, idx) => base + (idx < remainder ? 1 : 0));
  return { quotaByBucket, requested };
}

export function buildTeacherTestQuestionSet(
  rows: TeacherTestBankRow[],
  totalQuestions: number,
  options: BuildOptions = {}
): {
  questions: TeacherTestQuestion[];
  requested: number;
  picked: number;
  bucketCount: number;
  classCoverage: Array<{ topic: string; subtopicName: string; picked: number; available: number }>;
} {
  const rng = options.rng ?? Math.random;
  const buckets = buildBuckets(rows);
  const { quotaByBucket, requested } = allocatePerBucket(buckets, totalQuestions);
  const pickedByBucket = buckets.map(() => 0);
  const sampled: TeacherTestQuestion[] = [];
  const pickedIds = new Set<string>();
  // Track the shuffled order per bucket so redistribution doesn't re-pick first-pass items
  const shuffledByBucket: TeacherTestQuestion[][] = buckets.map((bucket) =>
    fisherYatesShuffle([...bucket.questions], rng)
  );

  // First pass: allocate each bucket its fair quota, capped by availability.
  for (let i = 0; i < buckets.length; i += 1) {
    const shuffled = shuffledByBucket[i];
    const take = Math.min(quotaByBucket[i], shuffled.length);
    for (let j = 0; j < take; j += 1) {
      const q = shuffled[j];
      sampled.push(q);
      pickedIds.add(q.id);
    }
    pickedByBucket[i] = take;
  }

  // Redistribution: fill shortfall from buckets with spare capacity.
  let remaining = Math.max(0, requested - sampled.length);
  if (remaining > 0) {
    const spare: TeacherTestQuestion[] = [];
    for (let i = 0; i < buckets.length; i += 1) {
      const shuffled = shuffledByBucket[i];
      // Remaining questions are those in shuffled order past the first-pass cut
      for (let j = pickedByBucket[i]; j < shuffled.length; j += 1) {
        if (!pickedIds.has(shuffled[j].id)) spare.push(shuffled[j]);
      }
    }
    fisherYatesShuffle(spare, rng);
    for (const q of spare) {
      if (remaining <= 0) break;
      if (pickedIds.has(q.id)) continue;
      sampled.push(q);
      pickedIds.add(q.id);
      remaining -= 1;
    }
  }

  fisherYatesShuffle(sampled, rng);

  const classCoverage = buckets.map((bucket) => ({
    topic: bucket.topic,
    subtopicName: bucket.subtopicName,
    picked: sampled.filter(
      (q) =>
        q.topic.toLowerCase() === bucket.topic.toLowerCase() &&
        q.subtopicName.toLowerCase() === bucket.subtopicName.toLowerCase()
    ).length,
    available: bucket.questions.length,
  }));

  return {
    questions: sampled.slice(0, requested),
    requested,
    picked: Math.min(requested, sampled.length),
    bucketCount: buckets.length,
    classCoverage,
  };
}
