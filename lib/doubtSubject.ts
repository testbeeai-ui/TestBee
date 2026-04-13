import { DOUBT_FLAIRS } from "@/components/doubts/doubtTypes";

export type CanonicalDoubtSubject = (typeof DOUBT_FLAIRS)[number];

/** Map common Sarvam/user variants to sidebar filter values (exact `DOUBT_FLAIRS` strings). */
const SUBJECT_SYNONYMS: Record<string, CanonicalDoubtSubject> = {
  physics: "Physics",
  chemistry: "Chemistry",
  math: "Math",
  maths: "Math",
  mathematics: "Math",
  biology: "Biology",
  bio: "Biology",
  "general question": "General Question",
  general: "General Question",
  other: "Other",
};

/**
 * Normalize stored `doubts.subject` for display + subject-chip filters.
 * Returns null if empty or unrecognized (caller may fall back to persona or "Untagged").
 */
export function canonicalDoubtSubject(raw: string | null | undefined): CanonicalDoubtSubject | null {
  if (raw == null) return null;
  const s = raw.trim().replace(/\s+/g, " ");
  if (!s) return null;
  const lower = s.toLowerCase();
  if (lower in SUBJECT_SYNONYMS) return SUBJECT_SYNONYMS[lower]!;
  const exact = DOUBT_FLAIRS.find((f) => f.toLowerCase() === lower);
  return exact ?? null;
}
