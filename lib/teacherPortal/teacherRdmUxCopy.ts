import type { TeacherPlanKey } from "@/lib/teacherPortal/teacherPlan";
import {
  assignmentQuotaExceededMessage,
  liveClassQuotaExceededMessage,
} from "@/lib/teacherPortal/teacherPlan";
import {
  computeAssignmentPublishRdm,
  computeLiveClassScheduleRdm,
  type QuotaOutcome,
} from "@/lib/teacherPortal/teacherPlanQuotaPolicy";

/** Teacher wallet debit — always show minus sign (Unicode minus). */
export function formatRdmDeduction(amount: number): string {
  const n = Math.max(0, Math.round(amount));
  if (n <= 0) return "0 RDM";
  return `−${n} RDM`;
}

/** Student-facing credit — plus sign. */
export function formatRdmCredit(amount: number): string {
  const n = Math.max(0, Math.round(amount));
  if (n <= 0) return "0 RDM";
  return `+${n} RDM`;
}

export function teacherUpgradeCtaLabel(upgradeTo: "starter" | "pro"): string {
  return upgradeTo === "starter" ? "Upgrade to Starter →" : "Upgrade to Pro →";
}

export function teacherMonthlyQuotaRemainingLabel(
  resource: "assignments" | "live lessons",
  remaining: number,
  cap: number
): string {
  return `${remaining} of ${cap} ${resource} left this month (IST)`;
}

export function teacherProOverageExplain(
  resource: "assignment" | "live lesson",
  cap: number,
  overageRdm: number
): string {
  const label = resource === "assignment" ? "assignments" : "live lessons";
  return `You've used all ${cap} included Pro ${label} this month. Each extra ${resource} costs ${formatRdmDeduction(overageRdm)} from your wallet — choose carefully before confirming.`;
}

export function teacherAssignmentQuotaBlockedMessage(tier: TeacherPlanKey, cap: number): string {
  return assignmentQuotaExceededMessage(tier, cap);
}

export function teacherLiveClassQuotaBlockedMessage(tier: TeacherPlanKey, cap: number): string {
  return liveClassQuotaExceededMessage(tier, cap);
}

export function teacherAssignmentQuotaUpgradeTo(tier: TeacherPlanKey): "starter" | "pro" | null {
  if (tier === "free") return "starter";
  if (tier === "starter") return "pro";
  return null;
}

export function teacherLiveClassQuotaUpgradeTo(tier: TeacherPlanKey): "starter" | "pro" | null {
  return teacherAssignmentQuotaUpgradeTo(tier);
}

export type PublishFeeKind = "none" | "flat" | "overage" | "blocked";

export function resolveClientAssignmentPublishFee(input: {
  tier: TeacherPlanKey;
  allowed: boolean;
  isOverage?: boolean;
  cap: number;
  used: number;
  flatPublishFee: number;
  overageRdm: number;
}): { amount: number; kind: PublishFeeKind } {
  if (!input.allowed) return { amount: 0, kind: "blocked" };
  const quota: QuotaOutcome = input.isOverage
    ? {
        kind: "allowed_overage",
        allowed: true,
        remaining: 0,
        cap: input.cap,
        used: input.used,
        isOverage: true,
        overageRdm: Math.max(0, Math.round(input.overageRdm)),
        message: "",
      }
    : {
        kind: "allowed_included",
        allowed: true,
        remaining: Math.max(0, input.cap - input.used),
        cap: input.cap,
        used: input.used,
        isOverage: false,
      };
  const amount = computeAssignmentPublishRdm({
    tier: input.tier,
    quota,
    flatPublishFee: input.flatPublishFee,
  });
  if (quota.kind === "allowed_overage") return { amount, kind: "overage" };
  if (amount <= 0 && input.tier === "pro") return { amount: 0, kind: "none" };
  return { amount, kind: amount > 0 ? "flat" : "none" };
}

export function resolveClientLiveScheduleFee(input: {
  allowed: boolean;
  isOverage?: boolean;
  cap: number;
  used: number;
  flatScheduleFee: number;
  overageRdm: number;
}): { amount: number; kind: PublishFeeKind } {
  if (!input.allowed) return { amount: 0, kind: "blocked" };
  const quota: QuotaOutcome = input.isOverage
    ? {
        kind: "allowed_overage",
        allowed: true,
        remaining: 0,
        cap: input.cap,
        used: input.used,
        isOverage: true,
        overageRdm: Math.max(0, Math.round(input.overageRdm)),
        message: "",
      }
    : {
        kind: "allowed_included",
        allowed: true,
        remaining: Math.max(0, input.cap - input.used),
        cap: input.cap,
        used: input.used,
        isOverage: false,
      };
  const amount = computeLiveClassScheduleRdm({
    quota,
    flatScheduleFee: input.flatScheduleFee,
  });
  if (quota.kind === "allowed_overage") return { amount, kind: "overage" };
  return { amount, kind: amount > 0 ? "flat" : "none" };
}

export function assignmentPublishFeeLine(input: {
  kind: PublishFeeKind;
  amount: number;
  tier: TeacherPlanKey;
}): string {
  if (input.kind === "blocked") return "Monthly limit reached";
  if (input.kind === "none" && input.tier === "pro") return "Included on Pro — no publish fee";
  if (input.kind === "overage") return `Overage publish fee: ${formatRdmDeduction(input.amount)}`;
  if (input.amount > 0) return `Publish fee: ${formatRdmDeduction(input.amount)}`;
  return "No publish fee";
}

export function liveScheduleFeeLine(input: { kind: PublishFeeKind; amount: number }): string {
  if (input.kind === "blocked") return "Monthly limit reached — upgrade to schedule more";
  if (input.kind === "overage") return `Overage booking fee: ${formatRdmDeduction(input.amount)}`;
  return "Included in your plan — earn delivery RDM when you schedule";
}
