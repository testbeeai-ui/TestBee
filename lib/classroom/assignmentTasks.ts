import type { Json } from "@/integrations/supabase/types";

export type AssignmentTaskKind =
  | "mock_paper"
  | "chapter_quiz"
  | "daily_dose"
  | "gyan_engagement"
  | "bits"
  | "instacue"
  | "topic_path"
  | "external_link"
  | "free_text";

export interface AssignmentTaskStored {
  id: string;
  kind: AssignmentTaskKind;
  label: string;
  /** In-app path (e.g. /mock) or full https URL */
  href: string | null;
  /** When false, students do not see this row in their checklist (teacher-only note / internal step). */
  visible_to_student: boolean;
  position: number;
  /** Optional per-task RDM hint for future payouts; informational only today */
  reward_rdm: number | null;
}

const KINDS = new Set<AssignmentTaskKind>([
  "mock_paper",
  "chapter_quiz",
  "daily_dose",
  "gyan_engagement",
  "bits",
  "instacue",
  "topic_path",
  "external_link",
  "free_text",
]);

function isRecord(v: unknown): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function asKind(v: unknown): AssignmentTaskKind | null {
  return typeof v === "string" && KINDS.has(v as AssignmentTaskKind)
    ? (v as AssignmentTaskKind)
    : null;
}

export function isAssignmentTaskKind(v: unknown): v is AssignmentTaskKind {
  return typeof v === "string" && KINDS.has(v as AssignmentTaskKind);
}

export function newAssignmentTaskId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** Presets teachers can add in one click (href is a sensible default; teachers can edit). */
export const ASSIGNMENT_TASK_PRESETS: Array<{
  kind: AssignmentTaskKind;
  label: string;
  defaultHref: string | null;
}> = [
  { kind: "mock_paper", label: "Full mock paper", defaultHref: "/mock" },
  { kind: "chapter_quiz", label: "Chapter quiz (MCQs)", defaultHref: "/exam-prep" },
  { kind: "daily_dose", label: "DailyDose / streak practice", defaultHref: "/play" },
  { kind: "gyan_engagement", label: "Post doubt on Gyan++", defaultHref: "/doubts" },
  { kind: "bits", label: "Quiz practice", defaultHref: "/exam-prep" },
  { kind: "instacue", label: "InstaCue / subtopic revision", defaultHref: "/exam-prep" },
  { kind: "topic_path", label: "Topic path (pick unit in Explore)", defaultHref: "/explore" },
  { kind: "external_link", label: "External link", defaultHref: null },
  { kind: "free_text", label: "Custom instruction", defaultHref: null },
];

export function createEmptyTask(kind: AssignmentTaskKind, position: number): AssignmentTaskStored {
  const preset = ASSIGNMENT_TASK_PRESETS.find((p) => p.kind === kind);
  return {
    id: newAssignmentTaskId(),
    kind,
    label: preset?.label ?? "Task",
    href: preset?.defaultHref ?? null,
    visible_to_student: true,
    position,
    reward_rdm: null,
  };
}

function legacyTasksFromPayload(
  payload: Record<string, Json>,
  postType: string
): AssignmentTaskStored[] {
  const pre = Array.isArray(payload.preWork)
    ? payload.preWork.filter((x): x is string => typeof x === "string")
    : [];
  const post = Array.isArray(payload.postWork)
    ? payload.postWork.filter((x): x is string => typeof x === "string")
    : [];
  const lines = [...pre, ...post].filter(Boolean);
  if (lines.length === 0) {
    const kind: AssignmentTaskKind =
      postType === "mock" ? "mock_paper" : postType === "quiz" ? "chapter_quiz" : "free_text";
    const label =
      postType === "mock"
        ? "Complete mock paper"
        : postType === "quiz"
          ? "Complete chapter quiz"
          : "Complete assignment";
    return [
      {
        id: "legacy-0",
        kind,
        label,
        href: postType === "mock" ? "/mock" : "/exam-prep",
        visible_to_student: true,
        position: 0,
        reward_rdm: null,
      },
    ];
  }
  return lines.map((label, idx) => ({
    id: `legacy-${idx}`,
    kind: "free_text" as const,
    label,
    href: null,
    visible_to_student: true,
    position: idx,
    reward_rdm: null,
  }));
}

/** Parse tasks from post.content_json; falls back to preWork/postWork or a single default task. */
export function parseAssignmentTasks(
  contentJson: Json | null | undefined,
  postType: string
): AssignmentTaskStored[] {
  if (!isRecord(contentJson)) return legacyTasksFromPayload({}, postType);
  const raw = contentJson.tasks;
  if (!Array.isArray(raw) || raw.length === 0) return legacyTasksFromPayload(contentJson, postType);

  const out: AssignmentTaskStored[] = [];
  raw.forEach((entry, idx) => {
    if (!isRecord(entry)) return;
    const id =
      typeof entry.id === "string" && entry.id.trim() ? entry.id.trim() : newAssignmentTaskId();
    const kind = asKind(entry.kind) ?? "free_text";
    const label =
      typeof entry.label === "string" && entry.label.trim()
        ? entry.label.trim()
        : `Task ${idx + 1}`;
    const href = typeof entry.href === "string" && entry.href.trim() ? entry.href.trim() : null;
    const visible =
      typeof entry.visible_to_student === "boolean"
        ? entry.visible_to_student
        : entry.hidden_from_student !== true;
    const position =
      typeof entry.position === "number" && Number.isFinite(entry.position) ? entry.position : idx;
    const rewardRdm =
      typeof entry.reward_rdm === "number" && Number.isFinite(entry.reward_rdm)
        ? Math.round(entry.reward_rdm)
        : null;
    out.push({
      id,
      kind,
      label,
      href,
      visible_to_student: visible,
      position,
      reward_rdm: rewardRdm,
    });
  });
  out.sort((a, b) => a.position - b.position);
  return out.length ? out : legacyTasksFromPayload(contentJson, postType);
}

export function studentVisibleTasks(tasks: AssignmentTaskStored[]): AssignmentTaskStored[] {
  return tasks.filter((t) => t.visible_to_student);
}

export function normalizeTaskPositions(tasks: AssignmentTaskStored[]): AssignmentTaskStored[] {
  return tasks.map((t, i) => ({ ...t, position: i }));
}

/** Default row(s) when the teacher has not customised tasks yet (matches old dropdown behaviour). */
export function buildDefaultTasksForAssignmentType(
  assignmentTypeLabel: string
): AssignmentTaskStored[] {
  const t = assignmentTypeLabel.toLowerCase();
  if (t.includes("concept focus")) {
    return [
      createEmptyTask("topic_path", 0), // Will be transformed to theory link later
      createEmptyTask("chapter_quiz", 1),
      createEmptyTask("instacue", 2),
      createEmptyTask("bits", 3),
    ];
  }
  if (t.includes("mock")) return [createEmptyTask("mock_paper", 0)];
  if (t.includes("quiz")) return [createEmptyTask("chapter_quiz", 0)];
  if (t.includes("gyan")) return [createEmptyTask("gyan_engagement", 0)];
  if (t.includes("daily") || t.includes("streak")) return [createEmptyTask("daily_dose", 0)];
  if (t.includes("bits")) return [createEmptyTask("bits", 0)];
  if (t.includes("insta")) return [createEmptyTask("instacue", 0)];
  return [createEmptyTask("free_text", 0)];
}

export function serializeTasksForContentJson(tasks: AssignmentTaskStored[]): Json[] {
  return tasks.map((t, idx) => ({
    id: t.id,
    kind: t.kind,
    label: t.label,
    href: t.href,
    visible_to_student: t.visible_to_student,
    position: typeof t.position === "number" ? t.position : idx,
    reward_rdm: t.reward_rdm,
  }));
}
