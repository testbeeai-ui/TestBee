export const RDM_INACTIVE_PENALTY_KIND = "rdm_inactive_penalty" as const;
export type RdmInactivePenaltyKind = typeof RDM_INACTIVE_PENALTY_KIND;

export const INACTIVE_PENALTY_NOTIFICATIONS_UPDATED = "edublast-inactive-penalties-updated";

export type InactiveDayPenaltyRow = {
  day: string;
  penalty_rdm: number;
  penalized_at: string;
};

export type InactivePenaltyBellItem = {
  id: string;
  title: string;
  body: string;
  preview: string;
  created_at: string;
  studentMessageKind: RdmInactivePenaltyKind;
  categoryLabel: string;
  chipClass: string;
  icon: string;
  ctaLabel: string;
  rdmDelta: number;
  action_url: string;
};

function penaltyDayKey(day: string): string {
  return day.trim().slice(0, 10);
}

function penaltyAmount(penaltyRdm: number): number {
  const n = Number(penaltyRdm);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.trunc(n));
}

export function formatInactivePenaltyDayLabel(day: string): string {
  const ymd = penaltyDayKey(day);
  const d = new Date(`${ymd}T12:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return ymd;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

export function getInactivePenaltyPresentation(): {
  kind: RdmInactivePenaltyKind;
  categoryLabel: string;
  accentClass: string;
  chipClass: string;
  icon: string;
  ctaLabel: string;
} {
  return {
    kind: RDM_INACTIVE_PENALTY_KIND,
    categoryLabel: "RDM cut",
    accentClass: "text-rose-700 dark:text-rose-200",
    chipClass:
      "border-rose-500/25 bg-rose-500/10 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-100",
    icon: "📉",
    ctaLabel: "Go to Home",
  };
}

export function buildInactivePenaltyNotificationCopy(
  penaltyRdm: number,
  day: string
): { title: string; preview: string; body: string } {
  const amount = penaltyAmount(penaltyRdm);
  const when = formatInactivePenaltyDayLabel(day);
  return {
    title: `−${amount} RDM cut for inactivity`,
    preview: `−${amount} RDM deducted for ${when} (under 30 minutes on site).`,
    body: `**−${amount} RDM** was deducted because you spent under 30 minutes on EduBlast on **${when}**.

Stay on site for at least 30 focused minutes today to avoid another inactivity cut.`,
  };
}

export function mapInactivePenaltyRowToBellItem(
  userId: string,
  row: InactiveDayPenaltyRow
): InactivePenaltyBellItem | null {
  const uid = userId.trim();
  const day = penaltyDayKey(row.day);
  const amount = penaltyAmount(row.penalty_rdm);
  if (!uid || !/^\d{4}-\d{2}-\d{2}$/.test(day) || amount <= 0) return null;

  const copy = buildInactivePenaltyNotificationCopy(amount, day);
  const presentation = getInactivePenaltyPresentation();
  const createdAt =
    typeof row.penalized_at === "string" && row.penalized_at.trim()
      ? row.penalized_at.trim()
      : `${day}T18:30:00.000Z`;

  return {
    id: `inactive-penalty:${uid}:${day}`,
    title: copy.title,
    body: copy.body,
    preview: copy.preview,
    created_at: createdAt,
    studentMessageKind: presentation.kind,
    categoryLabel: presentation.categoryLabel,
    chipClass: presentation.chipClass,
    icon: presentation.icon,
    ctaLabel: presentation.ctaLabel,
    rdmDelta: -amount,
    action_url: "/home",
  };
}
