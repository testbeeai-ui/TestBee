/** Plan-based save caps for user_saved_items. */

export type PlanTier = "free" | "scholar" | "champion";

export type ItemType =
  | "saved_bit"
  | "saved_formula"
  | "saved_revision_card"
  | "saved_revision_unit"
  | "saved_community_post";

const CAPS: Record<PlanTier, Record<ItemType, number>> = {
  free: {
    saved_bit: 50,
    saved_formula: 50,
    saved_revision_card: 50,
    saved_revision_unit: 50,
    saved_community_post: 50,
  },
  scholar: {
    saved_bit: 500,
    saved_formula: 500,
    saved_revision_card: 500,
    saved_revision_unit: 500,
    saved_community_post: 500,
  },
  champion: {
    saved_bit: Infinity,
    saved_formula: Infinity,
    saved_revision_card: Infinity,
    saved_revision_unit: Infinity,
    saved_community_post: Infinity,
  },
};

export function getSaveCap(tier: PlanTier, itemType: ItemType): number {
  return CAPS[tier]?.[itemType] ?? 50;
}

export function isAtCap(
  tier: PlanTier,
  itemType: ItemType,
  currentCount: number
): boolean {
  return currentCount >= getSaveCap(tier, itemType);
}
