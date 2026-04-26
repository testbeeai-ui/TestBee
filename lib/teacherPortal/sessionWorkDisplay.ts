/** Display strings for live-session pre/post work (custom text vs concept-focus scope). */

export type SessionWorkKind = "custom" | "concept_focus" | "none";

export function normalizeWorkModeToken(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function conceptRefLooksPopulated(ref: unknown): boolean {
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) return false;
  const o = ref as Record<string, unknown>;
  const sub =
    (typeof o.subtopicName === "string" ? o.subtopicName.trim() : "") ||
    (typeof o.subtopic_name === "string" ? o.subtopic_name.trim() : "");
  if (sub) return true;
  const topic =
    (typeof o.topic === "string" ? o.topic.trim() : "") ||
    (typeof o.topic_name === "string" ? o.topic_name.trim() : "");
  const chapter =
    (typeof o.chapterTitle === "string" ? o.chapterTitle.trim() : "") ||
    (typeof o.chapter_title === "string" ? o.chapter_title.trim() : "");
  const subject =
    (typeof o.subject === "string" ? o.subject.trim() : "") ||
    (typeof o.subject_slug === "string" ? o.subject_slug.trim() : "");
  return Boolean(topic && (chapter || subject));
}

/**
 * Derive UI work kind from explicit mode, structured concept ref, or legacy preview lines
 * (e.g. `Concept Focus · Subtopic`) when older rows omitted `preWorkMode`.
 */
export function inferSessionWorkKind(
  modeRaw: string,
  conceptRef: unknown,
  previewLinesFromWorkField: string[]
): SessionWorkKind {
  const m = normalizeWorkModeToken(modeRaw);
  if (m === "none" || m === "no_assignment" || m === "noassignment") return "none";
  if (m === "concept_focus" || m === "conceptfocus") return "concept_focus";
  if (conceptRefLooksPopulated(conceptRef)) return "concept_focus";
  if (
    previewLinesFromWorkField.some((line) =>
      /^concept\s*focus\s*[·•\-\:]/i.test(line.trim())
    )
  ) {
    return "concept_focus";
  }
  return "custom";
}

function subjectLabel(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s === "physics") return "Physics";
  if (s === "chemistry") return "Chemistry";
  if (s === "math" || s === "mathematics") return "Math";
  if (!raw.trim()) return "";
  return raw.trim().charAt(0).toUpperCase() + raw.trim().slice(1);
}

/** Builds one readable line: Board · Class · Subject · Chapter · Topic → Subtopic */
export function formatConceptFocusRefForDisplay(ref: unknown): string {
  if (!ref || typeof ref !== "object" || Array.isArray(ref)) return "";
  const o = ref as Record<string, unknown>;
  const board =
    (typeof o.board === "string" && o.board.trim()) ||
    (typeof o.board_name === "string" && o.board_name.trim()) ||
    "";
  const subjectRaw =
    (typeof o.subject === "string" && o.subject) ||
    (typeof o.subject_slug === "string" && o.subject_slug) ||
    "";
  const subject = subjectRaw ? subjectLabel(subjectRaw) : "";
  const levelRaw = o.classLevel ?? o.class_level;
  const cl =
    levelRaw === 11 || levelRaw === 12
      ? levelRaw === 11
        ? "Class 11"
        : "Class 12"
      : "";
  const chapter =
    (typeof o.chapterTitle === "string" && o.chapterTitle.trim()) ||
    (typeof o.chapter_title === "string" && o.chapter_title.trim()) ||
    "";
  const topic =
    (typeof o.topic === "string" && o.topic.trim()) ||
    (typeof o.topic_name === "string" && o.topic_name.trim()) ||
    "";
  const sub =
    (typeof o.subtopicName === "string" && o.subtopicName.trim()) ||
    (typeof o.subtopic_name === "string" && o.subtopic_name.trim()) ||
    "";
  const parts: string[] = [];
  if (board) parts.push(board);
  if (cl) parts.push(cl);
  if (subject) parts.push(subject);
  if (chapter) parts.push(chapter);
  if (topic) parts.push(topic);
  if (sub) parts.push(sub);
  return parts.join(" · ");
}

export function postWorkDelayLabel(days: number): string {
  if (!Number.isFinite(days) || days <= 0) return "Releases right after class ends.";
  if (days === 1) return "Releases 1 day after class.";
  return `Releases ${days} days after class.`;
}
