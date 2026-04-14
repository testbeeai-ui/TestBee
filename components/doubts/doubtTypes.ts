/** Shared types for the Gyan++ doubts system */

export type SortOption = "recent" | "upvoted" | "unanswered" | "bounty" | "teacher_tagged" | "saved";
export type ActivityView = "feed" | "asked" | "answered" | "saved";
export type TabFilter = "all" | "student" | "ai" | "teacher" | "revision" | "bounties";

export const DOUBT_FLAIRS = ["Physics", "Chemistry", "Math", "General Question", "Other"] as const;

export type ProfileRow = {
  id: string;
  name: string;
  avatar_url: string | null;
  rdm: number;
  lifetime_answer_rdm?: number;
  role?: "student" | "teacher" | string | null;
};

export type ExpandedAnswer = {
  id: string;
  body: string;
  upvotes: number;
  downvotes: number;
  is_accepted: boolean;
  created_at: string;
  user_id: string;
  profiles?: { name: string | null; avatar_url: string | null; role?: string | null } | null;
};

/** Prof-Pi / legacy Gyan AI tutor rows (same logic as feed AI block) */
export function isAiTutorAnswer(a: ExpandedAnswer): boolean {
  return isAiTutorDoubtAuthor(a.profiles);
}

/** True when the doubt author profile is the Gyan++ / Prof-Pi AI tutor (not a student). */
export function isAiTutorDoubtAuthor(p: { name?: string | null; role?: string | null } | null | undefined): boolean {
  const role = p?.role ?? "";
  const name = (p?.name ?? "").toLowerCase();
  return (
    role === "ai" ||
    name.includes("gyan++ ai") ||
    name.includes("ai bot") ||
    name.includes("prof-pi") ||
    name.includes("profpi")
  );
}

export type ExpandedDoubtRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  subject: string | null;
  upvotes: number;
  downvotes: number;
  is_resolved: boolean;
  bounty_rdm?: number;
  cost_rdm?: number;
  views?: number;
  created_at: string;
  /** Set for Gyan / curriculum-linked posts; join labels via feed `select`. */
  gyan_curriculum_node_id?: string | null;
  gyan_curriculum_nodes?: {
    chapter_label: string;
    topic_label: string;
    subtopic_label: string | null;
  } | null;
  doubt_answers?: ExpandedAnswer[];
  profiles?: { name: string | null; avatar_url: string | null; role?: string | null } | null;
};

export function doubtHasAiTutorAnswer(d: ExpandedDoubtRow): boolean {
  return (d.doubt_answers ?? []).some(isAiTutorAnswer);
}

/** Subject colors for colored chips — keys are lowercase */
export const SUBJECT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  physics: { bg: "bg-blue-500/10", text: "text-blue-600", dot: "bg-blue-500" },
  chemistry: { bg: "bg-purple-500/10", text: "text-purple-600", dot: "bg-purple-500" },
  math: { bg: "bg-orange-500/10", text: "text-orange-600", dot: "bg-orange-500" },
  "general question": { bg: "bg-gray-500/10", text: "text-gray-600", dot: "bg-gray-400" },
  other: { bg: "bg-gray-500/10", text: "text-gray-600", dot: "bg-gray-400" },
};

export function getSubjectColor(subject: string | null) {
  if (!subject) return SUBJECT_COLORS.other;
  return SUBJECT_COLORS[subject.toLowerCase()] ?? SUBJECT_COLORS.other;
}

/** Relative time label from ISO date string */
export function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

/** Strip tags from stored HTML. Optional `maxChars` for legacy list previews only. */
export function stripHtml(html: string, maxChars?: number): string {
  let plain: string;
  if (typeof document === "undefined") {
    plain = html.replace(/<[^>]*>/g, "");
  } else {
    const div = document.createElement("div");
    div.innerHTML = html;
    plain = div.textContent || div.innerText || "";
  }
  if (typeof maxChars === "number" && maxChars >= 0) return plain.slice(0, maxChars);
  return plain;
}

export function rankFromLifetime(lifetime: number): string {
  if (lifetime >= 500) return "Expert";
  if (lifetime >= 100) return "Scholar";
  return "Novice";
}

export function rdmToNextRank(lifetime: number): string | null {
  if (lifetime >= 500) return null;
  if (lifetime >= 100) return `${500 - lifetime} RDM to Expert`;
  return `${100 - lifetime} RDM to Scholar`;
}
