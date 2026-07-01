export type DoubtAnswer = {
  id: string;
  body: string;
  upvotes: number;
  is_accepted: boolean;
  created_at: string;
  user_id: string;
  profiles?: { name: string | null; avatar_url: string | null; role?: string | null } | null;
};

export type DoubtRow = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  subject: string | null;
  upvotes: number;
  is_resolved: boolean;
  bounty_rdm?: number;
  views?: number;
  created_at: string;
  doubt_answers?: DoubtAnswer[];
  profiles?: { name: string | null; avatar_url: string | null; role?: string | null } | null;
};

export const DOUBT_POST_SUBJECTS = ["Physics", "Chemistry", "Math"] as const;

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function formatTimeAgo(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

export function subjectColor(subject: string | null): { bg: string; text: string } {
  const key = (subject ?? "").toLowerCase();
  if (key === "physics") return { bg: "#172554", text: "#60a5fa" };
  if (key === "chemistry") return { bg: "#3b0764", text: "#c084fc" };
  if (key === "math") return { bg: "#312e81", text: "#a5b4fc" };
  return { bg: "#1e293b", text: "#94a3b8" };
}

export function doubtHasAiAnswer(d: DoubtRow): boolean {
  return (d.doubt_answers ?? []).some((a) => {
    const role = a.profiles?.role ?? "";
    const name = (a.profiles?.name ?? "").toLowerCase();
    return role === "ai" || name.includes("prof-pi") || name.includes("gyan++");
  });
}
