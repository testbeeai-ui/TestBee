"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ScheduleLiveSessionPanel from "@/components/teacher-portal/live/ScheduleLiveSessionPanel";
import type {
  TeacherPortalClassroomCard,
  TeacherPortalSessionItem,
  TeacherPortalSessionWorkKind,
} from "@/lib/teacherPortal/types";
import type { AdvancedQuizSetIndex } from "@/lib/play/quiz/advancedQuizSets";

interface MyClassesViewProps {
  sessions: TeacherPortalSessionItem[];
  classrooms: TeacherPortalClassroomCard[];
  onScheduleClass: (input: {
    classroomId: string;
    sectionId?: string | null;
    title: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    meetLink: string;
    allowAdhocTrial: boolean;
    preWork: string;
    postWork: string;
    preWorkMode?: "none" | "custom" | "concept_focus";
    preWorkConceptRef?: {
      board: string;
      subject: "physics" | "chemistry" | "math";
      classLevel: 11 | 12;
      chapterTitle: string;
      topic: string;
      subtopicName: string;
      level: "basics" | "intermediate" | "advanced";
      advancedSet?: AdvancedQuizSetIndex;
    } | null;
    postWorkMode?: "none" | "custom" | "concept_focus";
    postWorkConceptRef?: {
      board: string;
      subject: "physics" | "chemistry" | "math";
      classLevel: 11 | 12;
      chapterTitle: string;
      topic: string;
      subtopicName: string;
      level: "basics" | "intermediate" | "advanced";
      advancedSet?: AdvancedQuizSetIndex;
    } | null;
    postWorkDelayDays?: number;
  }) => Promise<void>;
}

function timeLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function compactStatusLabel(session: TeacherPortalSessionItem): {
  label: string;
  className: string;
} {
  const now = Date.now();
  const start = new Date(session.scheduledAt).getTime();
  const end = start + session.durationMinutes * 60 * 1000;
  const isLive = Number.isFinite(start) && now >= start && now <= end;
  const isPast = Number.isFinite(end) && now > end;
  if (session.status?.toLowerCase() === "cancelled") {
    return {
      label: "Cancelled",
      className: "bg-rose-500/12 text-rose-200",
    };
  }
  if (isLive) {
    return { label: "Live", className: "bg-emerald-500/15 text-emerald-200" };
  }
  if (isPast) {
    return { label: "Past", className: "bg-white/10 text-slate-300" };
  }
  return { label: "Upcoming", className: "bg-sky-500/12 text-sky-200" };
}

function shortWorkLine(kind: TeacherPortalSessionWorkKind, body: string): string {
  if (kind === "none") return "No assignment";
  const raw = body.trim();
  if (!raw) return "Not set";
  return (
    raw
      .split("\n")
      .map((s) => s.trim())
      .find(Boolean) ?? raw
  );
}

export default function MyClassesView({
  sessions,
  classrooms,
  onScheduleClass,
}: MyClassesViewProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [listMode, setListMode] = useState<"week" | "history">("week");

  const sessionsForView = useMemo(() => {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartMs = todayStart.getTime();
    const isCancelled = (s: TeacherPortalSessionItem) => {
      const st = (s.status ?? "").toString().trim().toLowerCase();
      return st === "cancelled" || st === "canceled";
    };
    const safeTimes = (s: TeacherPortalSessionItem): { start: number; end: number } => {
      const start = new Date(s.scheduledAt).getTime();
      const durRaw = Number((s as unknown as { durationMinutes?: unknown }).durationMinutes);
      const dur = Number.isFinite(durRaw) && durRaw > 0 ? durRaw : 60;
      const end = start + dur * 60 * 1000;
      return { start, end };
    };

    const hasEnded = (s: TeacherPortalSessionItem) => {
      const { start, end } = safeTimes(s);
      if (Number.isFinite(end) && Number.isFinite(start)) return end < now;
      return Number.isFinite(start) ? start < todayStartMs : false;
    };

    if (listMode === "history") {
      return sessions
        .filter((s) => isCancelled(s) || hasEnded(s))
        .sort((a, b) => safeTimes(b).start - safeTimes(a).start);
    }

    return sessions
      .filter((s) => !isCancelled(s) && !hasEnded(s))
      .sort((a, b) => safeTimes(a).start - safeTimes(b).start);
  }, [listMode, sessions]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-3xl sm:text-4xl">
            My <span className="text-emerald-400 italic">Classes</span>
          </h1>
          <p className="text-sm text-slate-400">
            Schedule live sessions, attach pre-work and post-work, and share resources with your
            classrooms.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setListMode("week")}
            className={
              listMode === "week"
                ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200"
                : "rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            }
          >
            Week view
          </button>
          <button
            type="button"
            onClick={() => setListMode("history")}
            className={
              listMode === "history"
                ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200"
                : "rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            }
          >
            History
          </button>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            <Plus className="h-4 w-4" />
            Schedule Class
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="text-[10px] uppercase tracking-[0.1em] text-slate-500">
          {listMode === "history" ? "Previous classes (history)" : "Upcoming scheduled classes"}
        </div>
        {sessionsForView.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#15162b] p-4 text-sm text-slate-400 sm:p-5">
            {listMode === "history" ? "No past classes yet." : "No live sessions scheduled yet."}
          </div>
        ) : (
          <div className="space-y-2">
            {sessionsForView.map((session) => (
              <div
                key={session.id}
                className="rounded-xl border border-white/10 bg-[#0f1324] px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{session.title}</div>
                    <div className="text-xs text-slate-400">
                      {session.classroomName} · {session.studentCount} students ·{" "}
                      {timeLabel(session.scheduledAt)} · {session.durationMinutes} min
                    </div>
                    <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
                      {session.sectionId
                        ? `Only ${session.sectionName ?? "section"}`
                        : "Whole class"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const s = compactStatusLabel(session);
                      return (
                        <span
                          className={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${s.className}`}
                        >
                          {s.label}
                        </span>
                      );
                    })()}
                    {session.meetLink ? (
                      <a
                        href={session.meetLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 items-center rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-emerald-200 hover:bg-emerald-500/15"
                      >
                        Open meet
                      </a>
                    ) : (
                      <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                        No meet link
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                      Pre-work
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-slate-200">
                      {shortWorkLine(session.preWorkKind, session.preWorkDisplay)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                      Post-work
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-slate-200">
                      {shortWorkLine(session.postWorkKind, session.postWorkDisplay)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[92dvh] w-[min(calc(100vw-1.25rem),34rem)] max-w-[min(calc(100vw-1.25rem),34rem)] flex-col gap-0 overflow-hidden rounded-2xl border border-white/20 bg-[#12162a] p-0 text-slate-100 sm:w-[min(calc(100vw-2rem),40rem)] sm:max-w-[40rem] lg:w-[min(calc(100vw-2rem),48rem)] lg:max-w-[48rem] sm:rounded-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Schedule a class</DialogTitle>
          </DialogHeader>
          <ScheduleLiveSessionPanel
            variant="dialog"
            dialogOpen={open}
            classrooms={classrooms}
            toast={toast}
            onSchedule={onScheduleClass}
            onComplete={() => setOpen(false)}
            onDismiss={() => setOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
