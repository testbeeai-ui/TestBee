import type { SubscriptionPlanLimits } from "@/lib/subscription/subscriptionConfig";
import { isUnlimited } from "@/lib/subscription/subscriptionConfig";

export type PlanKeyFeatureRow = {
  id: string;
  label: string;
  value: string;
};

function compact(limit: number, suffix: string): string {
  if (isUnlimited(limit)) return "Unlimited";
  return `${limit}${suffix}`;
}

export function buildPlanKeyFeatureRows(
  limits: SubscriptionPlanLimits,
  multilingual: boolean
): PlanKeyFeatureRow[] {
  return [
    {
      id: "magic_wall",
      label: "Magic Wall",
      value: `${compact(limits.magicWallMaxActiveTopics, " active")} · ${compact(limits.magicWallMonthlyAttempts, "/mo")}`,
    },
    {
      id: "gyan",
      label: "Gyan++ doubts",
      value: `${compact(limits.gyanDoubtsPerDay, "/day")}`,
    },
    {
      id: "subject_chat",
      label: "Subject chat",
      value: `${compact(limits.subjectChatMessagesPerDay, " q/day")} · ${multilingual ? "EN + 1 regional" : "EN only"}`,
    },
    {
      id: "mocks",
      label: "Testbee mocks",
      value: `${compact(limits.mocksPerMonth, "/mo")}`,
    },
    {
      id: "dailydose",
      label: "DailyDose",
      value: `${compact(limits.dailyDoseQuestionsPerDay, "/day")}`,
    },
    {
      id: "buddies",
      label: "Learning buddies",
      value: `${compact(limits.buddiesLimit, " active")}`,
    },
  ];
}
