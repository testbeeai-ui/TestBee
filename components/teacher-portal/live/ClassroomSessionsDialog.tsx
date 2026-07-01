"use client";

import { Calendar, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { TeacherPortalMeetSession } from "@/lib/teacherPortal/types";
import { formatSessionLabel } from "@/lib/teacherPortal/queries/utils";
import { buildTeacherMeetJoinUrl, teacherMeetJoinTitle } from "@/lib/meetLink";

function formatSessionRange(session: TeacherPortalMeetSession): string {
  const start = new Date(session.scheduledAt);
  if (Number.isNaN(start.getTime())) return formatSessionLabel(session.scheduledAt);
  const end = new Date(start.getTime() + session.durationMinutes * 60 * 1000);
  const t1 = start.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  const t2 = end.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${formatSessionLabel(session.scheduledAt)} · ${t1}–${t2}`;
}

export default function ClassroomSessionsDialog({
  open,
  onOpenChange,
  classroomName,
  sessions,
  googleCalendarEmail,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classroomName: string;
  sessions: TeacherPortalMeetSession[] | null | undefined;
  googleCalendarEmail?: string | null;
}) {
  const nowMs = Date.now();
  const upcoming = (sessions ?? [])
    .filter((s) => {
      const start = Date.parse(s.scheduledAt);
      if (!Number.isNaN(start)) {
        const end = start + s.durationMinutes * 60 * 1000;
        if (end >= nowMs) return true;
      }
      return false;
    })
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[96vw] max-w-lg overflow-y-auto rounded-2xl border border-white/15 bg-[#111428] text-slate-100">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl text-white">Sessions</DialogTitle>
          <DialogDescription className="text-slate-400">
            Upcoming live lessons for <span className="font-semibold text-slate-200">{classroomName}</span>
          </DialogDescription>
        </DialogHeader>
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-400">
            No upcoming sessions. Book a live lesson from a section&apos;s Students tab.
          </div>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((session) => (
              <li
                key={session.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-100">
                    <Calendar className="h-4 w-4 shrink-0 text-sky-300" />
                    <span className="truncate">{formatSessionRange(session)}</span>
                  </div>
                  {session.scopeLabel ? (
                    <p className="mt-1 text-xs text-slate-500">{session.scopeLabel}</p>
                  ) : null}
                </div>
                {session.meetLink ? (
                  <a
                    href={buildTeacherMeetJoinUrl(session.meetLink, googleCalendarEmail)}
                    target="_blank"
                    rel="noreferrer"
                    title={teacherMeetJoinTitle(googleCalendarEmail)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/20"
                  >
                    Start <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
