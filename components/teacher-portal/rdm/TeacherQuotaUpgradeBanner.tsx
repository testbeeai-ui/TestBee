"use client";

import {
  teacherAssignmentQuotaBlockedMessage,
  teacherAssignmentQuotaUpgradeTo,
  teacherLiveClassQuotaBlockedMessage,
  teacherLiveClassQuotaUpgradeTo,
  teacherUpgradeCtaLabel,
} from "@/lib/teacherPortal/teacherRdmUxCopy";
import type { TeacherPlanKey } from "@/lib/teacherPortal/teacherPlan";

type Props = {
  resource: "assignment" | "live_class";
  tier: TeacherPlanKey;
  cap: number;
  onUpgrade: () => void;
  className?: string;
};

export default function TeacherQuotaUpgradeBanner({
  resource,
  tier,
  cap,
  onUpgrade,
  className = "",
}: Props) {
  const message =
    resource === "assignment"
      ? teacherAssignmentQuotaBlockedMessage(tier, cap)
      : teacherLiveClassQuotaBlockedMessage(tier, cap);
  const upgradeTo =
    resource === "assignment"
      ? teacherAssignmentQuotaUpgradeTo(tier)
      : teacherLiveClassQuotaUpgradeTo(tier);

  if (!upgradeTo) return null;

  return (
    <div
      className={`rounded-xl border border-violet-500/35 bg-violet-500/10 px-4 py-3 text-sm text-slate-200 ${className}`}
      role="status"
    >
      <p className="leading-snug text-violet-100/95">{message}</p>
      <p className="mt-1.5 text-xs text-slate-400">
        You can&apos;t publish more this month on your current plan. Upgrade to keep teaching without
        interruption.
      </p>
      <button
        type="button"
        onClick={onUpgrade}
        className="mt-3 inline-flex items-center rounded-lg bg-violet-600 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-violet-500"
      >
        {teacherUpgradeCtaLabel(upgradeTo)}
      </button>
    </div>
  );
}
