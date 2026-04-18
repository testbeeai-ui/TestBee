import type { SavedRevisionCard } from "@/types";

/** InstaCue cards not marked as fully known (same idea as “still in rotation”). */
export function countInstacueRevisionDue(cards: SavedRevisionCard[] | undefined | null): number {
  if (!Array.isArray(cards) || cards.length === 0) return 0;
  return cards.filter((c) => c && c.status !== "know_it").length;
}

/** RDM gates for EduFund tier labels (aligned with dashboard tier story; amounts are UI hints only). */
const EDUFUND_RDM_GATES = [
  { need: 1000, name: "Sprout" },
  { need: 3000, name: "Scholar" },
  { need: 8000, name: "Champion" },
] as const;

/** Short badge: RDM remaining to next named tier, or null if at/over final gate. */
export function formatEdufundRdmBadge(rdm: number): string | null {
  const n = Math.max(0, Math.floor(rdm));
  const next = EDUFUND_RDM_GATES.find((g) => n < g.need);
  if (!next) return null;
  const left = next.need - n;
  if (left <= 0) return null;
  return `${left.toLocaleString("en-IN")} RDM → ${next.name}`;
}
