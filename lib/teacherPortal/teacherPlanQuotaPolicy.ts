import type { TeacherPlanKey } from "@/lib/teacherPortal/teacherPlan";

export type MonthlyQuotaResource = "assignment" | "live_class";

export type QuotaOutcome =
  | {
      kind: "allowed_included";
      allowed: true;
      remaining: number;
      cap: number;
      used: number;
      isOverage: false;
    }
  | {
      kind: "blocked_upgrade";
      allowed: false;
      upgradeTo: "starter" | "pro";
      message: string;
      cap: number;
      used: number;
      isOverage: false;
    }
  | {
      kind: "allowed_overage";
      allowed: true;
      remaining: 0;
      cap: number;
      used: number;
      isOverage: true;
      overageRdm: number;
      message: string;
    };

export function resolveMonthlyQuota(input: {
  tier: TeacherPlanKey;
  used: number;
  cap: number;
  resource: MonthlyQuotaResource;
  overageRdm: number;
}): QuotaOutcome {
  const used = Math.max(0, Math.floor(input.used));
  const cap = Math.max(0, Math.floor(input.cap));
  const remaining = Math.max(0, cap - used);

  if (used < cap) {
    return {
      kind: "allowed_included",
      allowed: true,
      remaining,
      cap,
      used,
      isOverage: false,
    };
  }

  if (input.tier === "free") {
    const resourceLabel = input.resource === "assignment" ? "assignments" : "live lessons";
    return {
      kind: "blocked_upgrade",
      allowed: false,
      upgradeTo: "starter",
      message: `You've used all ${cap} free ${resourceLabel} this month. Upgrade to Starter for up to 24/month.`,
      cap,
      used,
      isOverage: false,
    };
  }

  if (input.tier === "starter") {
    const resourceLabel = input.resource === "assignment" ? "assignments" : "live lessons";
    return {
      kind: "blocked_upgrade",
      allowed: false,
      upgradeTo: "pro",
      message: `You've used all ${cap} Starter ${resourceLabel} this month. Upgrade to Pro for up to 60/month.`,
      cap,
      used,
      isOverage: false,
    };
  }

  const resourceLabel = input.resource === "assignment" ? "assignment" : "live lesson";
  return {
    kind: "allowed_overage",
    allowed: true,
    remaining: 0,
    cap,
    used,
    isOverage: true,
    overageRdm: Math.max(0, Math.round(input.overageRdm)),
    message: `Pro included ${cap} ${resourceLabel}s used this month. This one costs ${Math.max(0, Math.round(input.overageRdm))} RDM.`,
  };
}

/** Flat publish fee within cap; Pro included = 0; Pro overage = overage RDM. */
export function computeAssignmentPublishRdm(input: {
  tier: TeacherPlanKey;
  quota: QuotaOutcome;
  flatPublishFee: number;
}): number {
  if (input.quota.kind === "blocked_upgrade") return 0;
  if (input.quota.kind === "allowed_overage") return input.quota.overageRdm;
  if (input.tier === "pro") return 0;
  return Math.max(0, Math.round(input.flatPublishFee));
}

/** Within included quota: no schedule fee (teachers earn delivery RDM on book). Pro overage charges overage RDM. */
export function computeLiveClassScheduleRdm(input: {
  quota: QuotaOutcome;
  flatScheduleFee: number;
}): number {
  if (input.quota.kind === "blocked_upgrade") return 0;
  if (input.quota.kind === "allowed_overage") return input.quota.overageRdm;
  return 0;
}

export function quotaToLegacyShape(outcome: QuotaOutcome): {
  allowed: boolean;
  remaining: number;
  cap: number;
  isOverage: boolean;
} {
  if (outcome.kind === "blocked_upgrade") {
    return { allowed: false, remaining: 0, cap: outcome.cap, isOverage: false };
  }
  return {
    allowed: true,
    remaining: outcome.remaining,
    cap: outcome.cap,
    isOverage: outcome.isOverage,
  };
}
