import {
  formatLessonsChapterLimitLabel,
  formatPlanCardRdmMultiplierLabel,
  isUnlimited,
  type SubscriptionConfig,
  type SubscriptionPlanKey,
  type SubscriptionPlanLimits,
} from "@/lib/subscription/subscriptionConfig";
import { planHasSubjectChatMultilingual } from "@/lib/subscription/subjectChatLimits";

function fmt(limit: number, unit: string): string {
  return isUnlimited(limit) ? `Unlimited ${unit}` : `${limit} ${unit}`;
}

function formatMocksBadge(limit: number): string {
  if (isUnlimited(limit)) return "Unlimited";
  return `${limit} mocks`;
}

export function patchPlanItemBadge(
  itemName: string,
  baseBadge: string | undefined,
  limits: SubscriptionPlanLimits,
  planKey?: string,
  cfg?: SubscriptionConfig | null
): string | undefined {
  const name = itemName.toLowerCase();
  if (name.includes("magic wall")) {
    return `${fmt(limits.magicWallMaxActiveTopics, "active")} · ${fmt(limits.magicWallMonthlyAttempts, "new picks/billing month")}`;
  }
  if (name.includes("gyan++")) return fmt(limits.gyanDoubtsPerDay, "per day");
  if (name.includes("subject chat-bot") || name.includes("subject chat")) {
    const lang =
      planKey && cfg && planHasSubjectChatMultilingual(cfg, planKey as SubscriptionPlanKey)
        ? "EN + 1 regional"
        : "EN only";
    return `${fmt(limits.subjectChatMessagesPerDay, "per day")} · ${lang}`;
  }
  if (name === "lessons") return formatLessonsChapterLimitLabel(limits.lessonsChapterLimit);
  if (name.includes("instacue")) return fmt(limits.instacueCardLimit, "cards");
  if (name.includes("testbee mocks")) {
    return formatMocksBadge(limits.mocksPerMonth);
  }
  if (name.includes("dailydose")) return fmt(limits.dailyDoseQuestionsPerDay, "per day");
  if (name.includes("learning buddy")) return fmt(limits.buddiesLimit, "active buddies");
  if (name.includes("rdm accumulation") && planKey && cfg) {
    return formatPlanCardRdmMultiplierLabel(cfg, planKey as SubscriptionPlanKey);
  }
  return baseBadge;
}
