"use client";

import type {
  TeacherPortalAssignmentItem,
  TeacherPortalClassroomSection,
} from "@/lib/teacherPortal/types";
import { CheckCircle2 } from "lucide-react";
import {
  formatAssignmentCardDate,
  primaryAssignmentBadge,
  visibleTaskCountForCard,
} from "../assignment/helpers";

export function AssignmentCard({
  item,
  onOpen,
  progress,
  sections,
}: {
  item: TeacherPortalAssignmentItem;
  onOpen: () => void;
  progress?: { completionPercent: number; completedCount: number; totalCount: number };
  sections: TeacherPortalClassroomSection[];
}) {
  const completionPercent = progress?.completionPercent ?? item.completionPercent;
  const completedCount = progress?.completedCount ?? item.completedCount;
  const totalCount = progress?.totalCount ?? item.totalCount;
  const badge = primaryAssignmentBadge(item);
  const dateLine =
    (formatAssignmentCardDate(item.dueDateIso) ?? item.dueDateLabel?.trim()) || "No due date";
  const title =
    item.type === "Concept Focus"
      ? (item.chapterQuiz?.subtopicName?.trim() || item.title)
      : item.title;
  const taskCount = visibleTaskCountForCard(item);
  const metaLine = `${taskCount} checklist task${taskCount === 1 ? "" : "s"} · ${item.assignedToLabel}`;
  const pct = Math.min(100, Math.max(0, Math.round(completionPercent)));
  const feedScopeLabel =
    item.sectionId == null
      ? "Whole class (Posts)"
      : sections.find((s) => s.id === item.sectionId)?.name?.trim() || "Section (Posts)";
  const allDone = totalCount > 0 && completedCount >= totalCount;
  const someDone = completedCount > 0 && !allDone;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex h-full min-h-[138px] w-full flex-col rounded-2xl border border-white/10 bg-black/25 p-3 text-left shadow-[0_12px_32px_-18px_rgba(0,0,0,0.65)] transition hover:border-violet-400/30 hover:bg-black/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/55 focus-visible:ring-offset-2 focus-visible:ring-offset-[#15162b] sm:min-h-[160px] sm:p-3.5"
    >
      <div className="mb-1.5 flex items-start justify-between gap-2">
        <span className="text-[11px] font-medium tracking-tight text-violet-200/90 sm:text-xs">
          {dateLine}
        </span>
        <span
          className={`max-w-[52%] shrink-0 truncate rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badge.color}`}
        >
          {badge.label}
        </span>
      </div>
      <div className="line-clamp-2 min-h-[2.25rem] text-[13px] font-semibold leading-snug text-white sm:min-h-[2.5rem] sm:text-sm">
        {title}
      </div>
      <p className="mt-1">
        <span className="inline-flex max-w-full truncate rounded-md border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-sky-100">
          {feedScopeLabel}
        </span>
      </p>
      <p className="mt-1.5 line-clamp-1 text-[11px] leading-relaxed text-slate-400">{metaLine}</p>
      {item.rewardRdm > 0 ? (
        <p className="mt-0.5 text-[11px] text-amber-200/80">{item.rewardRdm} RDM reward</p>
      ) : null}
      <div className="min-h-1.5 flex-1" aria-hidden />
      <div className="mt-2.5 space-y-1.5 border-t border-white/10 pt-2.5">
        {allDone ? (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-400/35 bg-emerald-500/12 px-2.5 py-1.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden />
            <span className="text-xs font-bold text-emerald-200">
              {totalCount === 1
                ? "Student completed"
                : `All ${totalCount} students completed`}
            </span>
          </div>
        ) : someDone ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-emerald-300">
              {completedCount} of {totalCount} done
            </span>
            <span className="text-[11px] text-slate-500">{pct}%</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-400">Not started</span>
            <span className="shrink-0 text-[11px] text-slate-500">
              0/{totalCount} done
            </span>
          </div>
        )}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400/90 transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="block text-[11px] font-semibold text-violet-300/90 group-hover:text-violet-200">
          View details →
        </span>
      </div>
    </button>
  );
}
