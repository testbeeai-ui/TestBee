import { BLOG_EDITOR_PICKS_KEY } from "./constants";

export function readBlogEditorPicks(): [string | null, string | null, string | null] {
  if (typeof window === "undefined") return [null, null, null];
  try {
    const raw = localStorage.getItem(BLOG_EDITOR_PICKS_KEY);
    const j = raw ? (JSON.parse(raw) as unknown) : null;
    if (!Array.isArray(j) || j.length !== 3) return [null, null, null];
    return [
      typeof j[0] === "string" ? j[0] : null,
      typeof j[1] === "string" ? j[1] : null,
      typeof j[2] === "string" ? j[2] : null,
    ];
  } catch {
    return [null, null, null];
  }
}

export function writeBlogEditorPicks(ids: [string | null, string | null, string | null]) {
  try {
    localStorage.setItem(BLOG_EDITOR_PICKS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore quota / private mode */
  }
}
