import type { ChapterPyqQuestion } from "@/lib/chapter-pyq/pyqQuestionMap";
import type { PyqTier } from "@/lib/chapter-pyq/pyqQuestionRow";

export type PyqTierFilter = PyqTier | "all";

/** Must Do leads: it is the largest tier (79 of the pilot's 132) and the default path. */
export const PYQ_TIER_ORDER: readonly PyqTier[] = ["must_do", "concept_builder", "advanced"];

export const PYQ_TIER_LABEL: Record<PyqTier, string> = {
  must_do: "Must Do",
  concept_builder: "Concept Builder",
  advanced: "Advanced",
};

export const PYQ_TIER_CHIPS: { id: PyqTierFilter; label: string }[] = [
  { id: "all", label: "All" },
  ...PYQ_TIER_ORDER.map((tier) => ({ id: tier as PyqTierFilter, label: PYQ_TIER_LABEL[tier] })),
];

export function isPyqTierFilter(value: string): value is PyqTierFilter {
  return value === "all" || (PYQ_TIER_ORDER as readonly string[]).includes(value);
}

/** Runs before set splitting, so changing the tier re-splits the session. */
export function filterByTier(
  entries: ChapterPyqQuestion[],
  tier: PyqTierFilter
): ChapterPyqQuestion[] {
  if (tier === "all") return entries;
  return entries.filter((entry) => entry.tier === tier);
}

export function countByTier(entries: ChapterPyqQuestion[]): Record<PyqTierFilter, number> {
  const out: Record<PyqTierFilter, number> = {
    all: entries.length,
    must_do: 0,
    concept_builder: 0,
    advanced: 0,
  };
  for (const entry of entries) out[entry.tier] += 1;
  return out;
}
