import type { SavedRevisionCard } from "@/types";
import { isInMemoryRecallQueue, promoteDueTomorrowCards } from "@/lib/saved/revisionCardRecall";

/** InstaCue cards on dashboard Memory Recall (new + due tomorrow; excludes unsure and know_it). */
export function countInstacueRevisionDue(
  cards: SavedRevisionCard[] | undefined | null,
  nowMs: number = Date.now()
): number {
  if (!Array.isArray(cards) || cards.length === 0) return 0;
  const promoted = promoteDueTomorrowCards(cards, nowMs);
  return promoted.filter((c) => c && isInMemoryRecallQueue(c, nowMs)).length;
}

/**
 * EduFund tiers: cumulative wallet RDM threshold and investor-facing proposal amount unlocked at that tier.
 * Keep in sync with product spec (single source of truth for thresholds + ₹ unlocked).
 */
export const EDUFUND_RDM_GATES = [
  { need: 5000, name: "Sprout", unlockInrAmount: 3000 },
  { need: 15000, name: "Scholar", unlockInrAmount: 12000 },
  { need: 40000, name: "Champion", unlockInrAmount: 50000 },
  { need: 80000, name: "Elite", unlockInrAmount: 100000 },
  { need: 150000, name: "MasterBlaster", unlockInrAmount: 200000 },
] as const;

/** Minimum RDM (Sprout) required to compose an EduFund proposal in the app UI. */
export const EDUFUND_MIN_RDM_CREATE_PROPOSAL = EDUFUND_RDM_GATES[0].need;

/** Next tier gate if below Champion; null if already at or above final gate. */
export function getEdufundNextGate(rdm: number): (typeof EDUFUND_RDM_GATES)[number] | null {
  const n = Math.max(0, Math.floor(rdm));
  return EDUFUND_RDM_GATES.find((g) => n < g.need) ?? null;
}

/** RDM still needed to reach the next tier (0 if at max tier). */
export function getEdufundRdmShortfallToNext(rdm: number): number {
  const next = getEdufundNextGate(rdm);
  if (!next) return 0;
  const n = Math.max(0, Math.floor(rdm));
  return Math.max(0, next.need - n);
}

/** Whole days needed at a steady daily earn rate (ceil); null if rate invalid. */
export function estimateDaysToEarnRdmAtDailyRate(
  rdmNeeded: number,
  dailyRdm: number
): number | null {
  if (rdmNeeded <= 0) return 0;
  if (dailyRdm <= 0) return null;
  return Math.ceil(rdmNeeded / dailyRdm);
}

/**
 * Short badge: tier name still to reach, or null if at/over final gate.
 *
 * Kept intentionally short so it fits in a 192px-wide sidebar nav row
 * (v3 reference pattern: max ~6–8 chars). The full detail ("1,977 RDM
 * to Sprout") is exposed to the user as a `title` tooltip by the caller
 * (see `formatEdufundRdmBadgeWithDetail`), and as a flyout on the
 * dashboard greeting row's EduFund icon panel.
 */
export function formatEdufundRdmBadge(rdm: number): string | null {
  const n = Math.max(0, Math.floor(rdm));
  const next = EDUFUND_RDM_GATES.find((g) => n < g.need);
  if (!next) return null;
  const left = next.need - n;
  if (left <= 0) return null;
  return `→ ${next.name}`;
}

/**
 * Full-detail version of `formatEdufundRdmBadge` — used for the badge's
 * `title` tooltip so hovering the badge reveals the RDM remaining
 * ("1,977 RDM → Sprout"). Same gating rules as the short form.
 */
export function formatEdufundRdmBadgeDetail(rdm: number): string | null {
  const n = Math.max(0, Math.floor(rdm));
  const next = EDUFUND_RDM_GATES.find((g) => n < g.need);
  if (!next) return null;
  const left = next.need - n;
  if (left <= 0) return null;
  return `${left.toLocaleString("en-IN")} RDM → ${next.name}`;
}
