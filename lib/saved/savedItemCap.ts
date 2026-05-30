/** Plan-based save caps for user_saved_items. */

export type PlanTier =
  | "free_trial"
  | "free"
  | "starter"
  | "pro"
  | "scholar"
  | "champion"
  | "pro_plus";

export type ItemType =
  | "saved_bit"
  | "saved_formula"
  | "saved_revision_card"
  | "saved_revision_unit"
  | "saved_community_post";

const CAPS: Record<PlanTier, Record<ItemType, number>> = {
  free_trial: {
    saved_bit: 20,
    saved_formula: 20,
    saved_revision_card: 20,
    saved_revision_unit: 20,
    saved_community_post: 20,
  },
  free: {
    saved_bit: 20,
    saved_formula: 20,
    saved_revision_card: 20,
    saved_revision_unit: 20,
    saved_community_post: 20,
  },
  starter: {
    saved_bit: 200,
    saved_formula: 200,
    saved_revision_card: 200,
    saved_revision_unit: 200,
    saved_community_post: 200,
  },
  pro: {
    saved_bit: Infinity,
    saved_formula: Infinity,
    saved_revision_card: Infinity,
    saved_revision_unit: Infinity,
    saved_community_post: Infinity,
  },
  scholar: {
    saved_bit: 200,
    saved_formula: 200,
    saved_revision_card: 200,
    saved_revision_unit: 200,
    saved_community_post: 200,
  },
  champion: {
    saved_bit: Infinity,
    saved_formula: Infinity,
    saved_revision_card: Infinity,
    saved_revision_unit: Infinity,
    saved_community_post: Infinity,
  },
  pro_plus: {
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

export function isAtCap(tier: PlanTier, itemType: ItemType, currentCount: number): boolean {
  return currentCount >= getSaveCap(tier, itemType);
}
