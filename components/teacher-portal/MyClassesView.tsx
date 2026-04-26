"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, Clock, Link2, Plus } from "lucide-react";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import ConceptFocusAssignmentFields, {
  type ConceptFocusSelectionState,
  initialConceptFocusSelection,
  conceptFocusSelectionComplete,
} from "@/components/teacher-portal/ConceptFocusAssignmentFields";
import {
  chapterQuizToRef,
  type ChapterQuizSelectionState,
} from "@/lib/teacherPortal/chapterQuizUtils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type {
  TeacherPortalClassroomCard,
  TeacherPortalSessionItem,
  TeacherPortalSessionWorkKind,
} from "@/lib/teacherPortal/types";

function SessionWorkBlock({
  label,
  kind,
  body,
  footnote,
}: {
  label: string;
  kind: TeacherPortalSessionWorkKind;
  body: string;
  footnote?: string | null;
}) {
  return (
    <div className="rounded-md border border-white/10 bg-black/25 p-2">
      <div className="mb-1 flex flex-wrap items-center gap-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        <span
          className={
            kind === "concept_focus"
              ? "rounded bg-violet-500/15 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-violet-200"
              : kind === "none"
                ? "rounded bg-slate-500/12 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-300"
              : "rounded bg-slate-500/12 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-300"
          }
        >
          {kind === "concept_focus" ? "Concept focus" : kind === "none" ? "No assignment" : "Custom"}
        </span>
      </div>
      <p className="break-words text-[11px] leading-snug text-slate-200 whitespace-pre-wrap">
        {body}
      </p>
      {footnote ? (
        <p className="mt-1 text-[9px] leading-tight text-slate-500">{footnote}</p>
      ) : null}
    </div>
  );
}

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
      advancedSet?: 1 | 2 | 3;
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
      advancedSet?: 1 | 2 | 3;
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
  // Prefer first line for compact list view.
  return raw.split("\n").map((s) => s.trim()).find(Boolean) ?? raw;
}

export default function MyClassesView({
  sessions,
  classrooms,
  onScheduleClass,
}: MyClassesViewProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [listMode, setListMode] = useState<"week" | "history">("week");
  const [submitting, setSubmitting] = useState(false);
  const [classroomId, setClassroomId] = useState("");
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [sectionOptions, setSectionOptions] = useState<
    Array<{ id: string; name: string; meta: string; googleMeetLink: string | null }>
  >([]);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [meetLink, setMeetLink] = useState("");
  const [allowAdhocTrial, setAllowAdhocTrial] = useState(true);
  const [preWork, setPreWork] = useState("");
  const [postWork, setPostWork] = useState("");
  const [preWorkMode, setPreWorkMode] = useState<"none" | "custom" | "concept_focus">("custom");
  const [preWorkConceptSel, setPreWorkConceptSel] = useState<ConceptFocusSelectionState>(() =>
    initialConceptFocusSelection()
  );
  const [postWorkMode, setPostWorkMode] = useState<"none" | "custom" | "concept_focus">("custom");
  const [postWorkConceptSel, setPostWorkConceptSel] = useState<ConceptFocusSelectionState>(() =>
    initialConceptFocusSelection()
  );
  const [postWorkDelayDays, setPostWorkDelayDays] = useState(0);
  const [scheduleStep, setScheduleStep] = useState<1 | 2>(1);
  const [assignmentTab, setAssignmentTab] = useState<"pre" | "post">("pre");

  const {
    taxonomy: curriculumTaxonomy,
    loading: curriculumLoading,
    error: curriculumError,
  } = useTopicTaxonomy();
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const timeInputRef = useRef<HTMLInputElement | null>(null);
  const selectClassName =
    "h-10 w-full appearance-none rounded-lg border border-white/15 bg-[#0b1020] px-2.5 pr-9 text-sm outline-none focus:border-emerald-400 sm:h-11 sm:rounded-xl sm:px-3 sm:pr-10";

  useEffect(() => {
    let alive = true;
    if (!classroomId) {
      setSectionId(null);
      setSectionOptions([]);
      return;
    }
    setSectionLoading(true);
    void supabase
      .from("classroom_sections" as any)
      .select("id, name, schedule_time, repeat_days, duration_minutes, google_meet_link")
      .eq("classroom_id", classroomId)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (!alive) return;
        const opts =
          (data as Array<{
            id: string;
            name: string;
            schedule_time: string | null;
            repeat_days: string[] | null;
            duration_minutes: number | null;
            google_meet_link: string | null;
          }> | null) ?? [];
        setSectionOptions(
          opts.map((s) => {
            const time = typeof s.schedule_time === "string" && s.schedule_time.trim() ? s.schedule_time.trim() : null;
            const dur =
              Number.isFinite(Number(s.duration_minutes)) && Number(s.duration_minutes) > 0
                ? `${Number(s.duration_minutes)} mins`
                : null;
            const meta = [time, dur].filter(Boolean).join(" · ");
            return {
              id: s.id,
              name: s.name,
              meta: meta || "No schedule set",
              googleMeetLink: s.google_meet_link ?? null,
            };
          })
        );
      })
      .then(
        () => {
          if (!alive) return;
          setSectionLoading(false);
        },
        () => {
          if (!alive) return;
          setSectionLoading(false);
        }
      );
    return () => {
      alive = false;
    };
  }, [classroomId]);

  useEffect(() => {
    if (!open) return;
    if (!sectionId) return;
    const sec = sectionOptions.find((s) => s.id === sectionId);
    const link = sec?.googleMeetLink?.trim() ?? "";
    if (link) {
      // Only auto-fill when section has a link; class can be manually entered.
      setMeetLink(link);
    }
  }, [open, sectionId, sectionOptions]);

  const canSubmit = useMemo(() => {
    if (!(classroomId && title.trim() && date && startTime && meetLink.trim())) return false;
    if (curriculumLoading && (preWorkMode === "concept_focus" || postWorkMode === "concept_focus"))
      return false;

    const preConfigured =
      preWorkMode === "none"
        ? true
        : preWorkMode === "custom"
          ? Boolean(preWork.trim())
          : conceptFocusSelectionComplete(preWorkConceptSel, curriculumTaxonomy);

    const postConfigured =
      postWorkMode === "none"
        ? true
        : postWorkMode === "custom"
          ? Boolean(postWork.trim())
          : conceptFocusSelectionComplete(postWorkConceptSel, curriculumTaxonomy);

    return (
      preConfigured &&
      postConfigured &&
      Number.isFinite(postWorkDelayDays) &&
      postWorkDelayDays >= 0
    );
  }, [
    classroomId,
    title,
    date,
    startTime,
    meetLink,
    preWorkMode,
    postWorkMode,
    curriculumLoading,
    preWorkConceptSel,
    postWorkConceptSel,
    curriculumTaxonomy,
    postWorkDelayDays,
    preWork,
    postWork,
  ]);

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const preConceptRef =
        preWorkMode === "concept_focus"
          ? chapterQuizToRef(
              {
                ...preWorkConceptSel,
                level: "advanced",
                advancedSet: 1,
              } as ChapterQuizSelectionState,
              curriculumTaxonomy
            )
          : null;

      if (preWorkMode === "concept_focus" && !preConceptRef) {
        throw new Error("Please complete concept focus selection for pre-work.");
      }

      const postConceptRef =
        postWorkMode === "concept_focus"
          ? chapterQuizToRef(
              {
                ...postWorkConceptSel,
                level: "advanced",
                advancedSet: 1,
              } as ChapterQuizSelectionState,
              curriculumTaxonomy
            )
          : null;

      if (postWorkMode === "concept_focus" && !postConceptRef) {
        throw new Error("Please complete concept focus selection for post-work.");
      }

      await onScheduleClass({
        classroomId,
        sectionId,
        title,
        date,
        startTime,
        durationMinutes,
        meetLink,
        allowAdhocTrial,
        preWork: preWorkMode === "none" ? "" : preWork,
        postWork: postWorkMode === "none" ? "" : postWork,
        preWorkMode,
        preWorkConceptRef: preConceptRef ?? null,
        postWorkMode,
        postWorkConceptRef: postConceptRef ?? null,
        postWorkDelayDays,
      });
      // Trigger Google Calendar attendee emails (section-scoped if selected).
      // This is what causes actual email/calendar notifications.
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const headers: HeadersInit = { "Content-Type": "application/json" };
        if (session?.access_token && session.access_token.trim()) {
          (headers as Record<string, string>).Authorization = `Bearer ${session.access_token}`;
        }

        const res = await fetch(`/api/integrations/google/classrooms/${classroomId}/attendees`, {
          method: "POST",
          credentials: "include",
          headers,
          body: JSON.stringify({ sectionId }),
        });
        const json = (await res.json().catch(() => ({}))) as
          | {
              ok?: boolean;
              addedStudentEmails?: number;
              studentsWithoutEmail?: number;
              error?: string;
            }
          | undefined;

        if (!res.ok) {
          const msg = json?.error?.trim() || "Could not send Google Calendar notifications.";
          toast({
            title: "Scheduled, but no email notification sent",
            description: msg,
            variant: "destructive",
          });
        } else {
          const added = Number(json?.addedStudentEmails) || 0;
          const missing = Number(json?.studentsWithoutEmail) || 0;
          toast({
            title: "Google notifications sent",
            description:
              added > 0
                ? `Invites sent to ${added} student(s).${missing ? ` (${missing} missing email)` : ""}`
                : missing
                  ? `${missing} student(s) are missing an email on their account.`
                  : "No new student emails to add.",
          });
        }
      } catch {
        toast({
          title: "Scheduled, but notification sync failed",
          description: "Could not reach Google sync. Try again in a minute.",
          variant: "destructive",
        });
      }
      setOpen(false);
      setClassroomId("");
      setSectionId(null);
      setSectionOptions([]);
      setTitle("");
      setDate("");
      setStartTime("");
      setDurationMinutes(60);
      setMeetLink("");
      setAllowAdhocTrial(true);
      setPreWork("");
      setPostWork("");
      setPreWorkMode("custom");
      setPreWorkConceptSel(initialConceptFocusSelection());
      setPostWorkMode("custom");
      setPostWorkConceptSel(initialConceptFocusSelection());
      setPostWorkDelayDays(0);
      setScheduleStep(1);
      setAssignmentTab("pre");
    } finally {
      setSubmitting(false);
    }
  };

  const openNativePicker = (input: HTMLInputElement | null) => {
    if (!input) return;
    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // NotAllowedError when showPicker requires a user gesture — fall through to focus
      }
    }
    input.focus();
  };

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
      // Hard fallback only if date parse fails: treat previous-day items as history.
      return Number.isFinite(start) ? start < todayStartMs : false;
    };

    if (listMode === "history") {
      return sessions
        .filter((s) => isCancelled(s) || hasEnded(s))
        .sort((a, b) => safeTimes(b).start - safeTimes(a).start);
    }

    // Week view = upcoming + currently live (and not cancelled)
    return sessions
      .filter((s) => !isCancelled(s) && !hasEnded(s))
      .sort((a, b) => safeTimes(a).start - safeTimes(b).start);
  }, [listMode, sessions]);

  const primary = sessionsForView[0] ?? null;
  const rest = sessionsForView.slice(1);

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
                        {session.sectionId ? `Only ${session.sectionName ?? "section"}` : "Whole class"}
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
          <DialogHeader className="shrink-0 border-b border-white/10 px-4 pb-3 pt-4 pr-12 text-left sm:px-6 sm:pb-4 sm:pt-5">
            <DialogTitle className="font-serif text-xl leading-tight sm:text-2xl lg:text-3xl">
              📅 Schedule a class
            </DialogTitle>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">
              Schedule a live session for your classroom with pre-work, Google Meet link, and
              post-work.
            </p>
          </DialogHeader>
          <div className="shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6 sm:py-3">
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400 sm:text-xs">
                Step {scheduleStep} of 2
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleStep(1)}
                  className={`min-h-9 rounded-full px-3 py-1.5 text-[11px] font-semibold sm:h-8 sm:py-0 ${
                    scheduleStep === 1
                      ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                      : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  Session details
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleStep(2)}
                  className={`min-h-9 rounded-full px-3 py-1.5 text-[11px] font-semibold sm:h-8 sm:py-0 ${
                    scheduleStep === 2
                      ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                      : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  Pre/Post assignments
                </button>
              </div>
            </div>
            <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] leading-snug text-slate-300 sm:px-3 sm:py-2 sm:text-[11px]">
              {scheduleStep === 1 ? (
                <span>
                  Required in this step: classroom, session topic, date, start time, duration, and
                  Google Meet link.
                </span>
              ) : (
                <span>
                  Required in this step: configure both pre-work and post-work. For custom mode,
                  enter text. For concept focus mode, complete class → subject → chapter → topic →
                  subtopic selection.
                </span>
              )}
            </div>
          </div>

          <div className="max-h-[min(58dvh,calc(100dvh-13.5rem))] overflow-y-auto overscroll-contain px-4 py-2.5 sm:max-h-[min(70dvh,calc(92dvh-12rem))] sm:px-6 sm:py-3 lg:max-h-[min(72dvh,calc(92dvh-11rem))]">
            <div className="space-y-3 sm:space-y-4">
              <div className={`space-y-2.5 sm:space-y-3 ${scheduleStep === 1 ? "block" : "hidden"}`}>
                <div>
                  <label className="mb-0.5 block text-xs font-semibold text-slate-300 sm:text-sm">
                    Classroom *
                  </label>
                  <select
                    value={classroomId}
                    onChange={(e) => {
                      setClassroomId(e.target.value);
                      setSectionId(null);
                    }}
                    className={selectClassName}
                  >
                    <option value="">Select classroom</option>
                    {classrooms.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-semibold text-slate-300 sm:text-sm">
                    Notify (optional)
                  </label>
                  <select
                    value={sectionId ?? "__class__"}
                    onChange={(e) => {
                      const v = e.target.value;
                      setSectionId(v === "__class__" ? null : v);
                    }}
                    disabled={!classroomId || sectionLoading}
                    className={selectClassName}
                  >
                    <option value="__class__">Whole class (all students)</option>
                    {sectionOptions.map((sec) => (
                      <option key={sec.id} value={sec.id}>
                        Only {sec.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Whole class = everyone gets notified. Only section = just that section gets notified.
                  </p>
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-semibold text-slate-300 sm:text-sm">
                    Session topic *
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Electrostatics - Gauss's Law deep dive"
                    className="h-10 w-full rounded-lg border border-white/15 bg-[#0b1020] px-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:h-11 sm:rounded-xl sm:px-3"
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 min-[520px]:grid-cols-3">
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                      Date *
                    </label>
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      onClick={() => openNativePicker(dateInputRef.current)}
                      className="h-10 w-full min-w-0 cursor-pointer rounded-lg border border-white/15 bg-[#0b1020] px-2 text-sm outline-none focus:border-emerald-400 sm:h-11 sm:rounded-xl sm:px-3"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                      Start time *
                    </label>
                    <input
                      ref={timeInputRef}
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      onClick={() => openNativePicker(timeInputRef.current)}
                      className="h-10 w-full min-w-0 cursor-pointer rounded-lg border border-white/15 bg-[#0b1020] px-2 text-sm outline-none focus:border-emerald-400 sm:h-11 sm:rounded-xl sm:px-3"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                      Duration
                    </label>
                    <select
                      value={String(durationMinutes)}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className={selectClassName}
                    >
                      <option value="45">45 mins</option>
                      <option value="60">60 mins</option>
                      <option value="90">90 mins</option>
                      <option value="120">120 mins</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-0.5 block text-xs font-semibold text-slate-300 sm:text-sm">
                    Google Meet link *
                  </label>
                  <input
                    value={meetLink}
                    onChange={(e) => setMeetLink(e.target.value)}
                    placeholder="meet.google.com/abc-defg-hij"
                    className="h-10 w-full rounded-lg border border-white/15 bg-[#0b1020] px-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:h-11 sm:rounded-xl sm:px-3"
                  />
                </div>
              </div>

              <div className={`space-y-2 sm:space-y-3 ${scheduleStep === 2 ? "block" : "hidden"}`}>
                <div>
                  <label className="mb-0.5 block text-xs font-semibold text-slate-300 sm:text-sm">
                    Allow adhoc 10-min trials?
                  </label>
                  <select
                    value={allowAdhocTrial ? "yes" : "no"}
                    onChange={(e) => setAllowAdhocTrial(e.target.value === "yes")}
                    className={selectClassName}
                  >
                    <option value="yes">
                      Yes - open to all EduBlast members (50 RDM to continue)
                    </option>
                    <option value="no">No - enrolled students only</option>
                  </select>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#0c1020] p-2 sm:p-2.5">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5 border-b border-white/[0.06] pb-2">
                    <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      Work type
                    </span>
                    <button
                      type="button"
                      onClick={() => setAssignmentTab("pre")}
                      className={`h-8 rounded-full px-2.5 text-[11px] font-semibold sm:px-3 sm:text-xs ${
                        assignmentTab === "pre"
                          ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                          : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      Pre-work
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignmentTab("post")}
                      className={`h-8 rounded-full px-2.5 text-[11px] font-semibold sm:px-3 sm:text-xs ${
                        assignmentTab === "post"
                          ? "border border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                          : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      Post-work
                    </button>
                  </div>

                  {assignmentTab === "pre" ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                        <div className="min-w-0 space-y-1">
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Pre-work format
                          </label>
                          <select
                            value={preWorkMode}
                            onChange={(e) =>
                              setPreWorkMode(e.target.value as "none" | "custom" | "concept_focus")
                            }
                            className={selectClassName}
                          >
                            <option value="none">No assignment</option>
                            <option value="custom">Custom assignment</option>
                            <option value="concept_focus">Concept Focus assignment</option>
                          </select>
                        </div>
                        <p className="text-[10px] leading-snug text-slate-500 sm:max-w-[11rem] sm:pb-0.5 sm:text-right">
                          Sent before class. Concept focus = syllabus-linked pack.
                        </p>
                      </div>
                      {preWorkMode === "none" ? null : (
                        <p className="text-[10px] text-slate-500">
                          Required unless you choose “No assignment”.
                        </p>
                      )}

                      {preWorkMode === "none" ? (
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                          No pre-work will be assigned for this class.
                        </div>
                      ) : preWorkMode === "custom" ? (
                        <textarea
                          rows={3}
                          value={preWork}
                          onChange={(e) => setPreWork(e.target.value)}
                          placeholder="e.g. Read Chapter 2 summary. Complete 5 warm-up MCQs."
                          className="w-full rounded-lg border border-white/15 bg-[#0b1020] px-2.5 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:rounded-xl sm:px-3"
                        />
                      ) : (
                        <ConceptFocusAssignmentFields
                          taxonomy={curriculumTaxonomy}
                          taxonomyLoading={curriculumLoading}
                          taxonomyError={curriculumError}
                          value={preWorkConceptSel}
                          onChange={setPreWorkConceptSel}
                          selectClassName={selectClassName}
                        />
                      )}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-1 gap-2 lg:grid-cols-2 lg:gap-x-3">
                        <div className="min-w-0 space-y-1">
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Post-work format
                          </label>
                          <select
                            value={postWorkMode}
                            onChange={(e) =>
                              setPostWorkMode(e.target.value as "none" | "custom" | "concept_focus")
                            }
                            className={selectClassName}
                          >
                            <option value="none">No assignment</option>
                            <option value="custom">Custom assignment</option>
                            <option value="concept_focus">Concept Focus assignment</option>
                          </select>
                        </div>
                        <div className="min-w-0 space-y-1">
                          <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Release after class
                          </label>
                          <select
                            value={String(postWorkDelayDays)}
                            onChange={(e) =>
                              setPostWorkDelayDays(Math.max(0, Number(e.target.value) || 0))
                            }
                            className={selectClassName}
                          >
                            <option value="0">Immediately after class</option>
                            <option value="1">1 day after class</option>
                            <option value="2">2 days after class</option>
                            <option value="3">3 days after class</option>
                          </select>
                        </div>
                      </div>
                      {postWorkMode === "none" ? null : (
                        <p className="text-[10px] text-slate-500">
                          Required unless you choose “No assignment”.
                        </p>
                      )}

                      {postWorkMode === "none" ? (
                        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-slate-300">
                          No post-work will be assigned for this class.
                        </div>
                      ) : postWorkMode === "custom" ? (
                        <textarea
                          rows={3}
                          value={postWork}
                          onChange={(e) => setPostWork(e.target.value)}
                          placeholder="e.g. Complete 10-Q Testbee quiz and post 2 doubts on Gyan++."
                          className="w-full rounded-lg border border-white/15 bg-[#0b1020] px-2.5 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:rounded-xl sm:px-3"
                        />
                      ) : (
                        <ConceptFocusAssignmentFields
                          taxonomy={curriculumTaxonomy}
                          taxonomyLoading={curriculumLoading}
                          taxonomyError={curriculumError}
                          value={postWorkConceptSel}
                          onChange={setPostWorkConceptSel}
                          selectClassName={selectClassName}
                        />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2 border-t border-white/10 bg-[#11162a] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3 sm:p-4 sm:px-6">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 w-full items-center justify-center rounded-full border border-white/15 px-4 text-sm font-semibold text-slate-300 hover:bg-white/5 sm:w-auto sm:min-w-[100px]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setScheduleStep((prev) => (prev === 1 ? 2 : 1))}
              className="inline-flex h-10 w-full items-center justify-center rounded-full border border-white/15 px-4 text-sm font-semibold text-slate-200 hover:bg-white/5 sm:w-auto sm:min-w-[100px]"
            >
              {scheduleStep === 1 ? "Next" : "Back"}
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={
                !canSubmit ||
                submitting ||
                ((preWorkMode === "concept_focus" || postWorkMode === "concept_focus") &&
                  curriculumLoading)
              }
              title={
                canSubmit
                  ? "Schedule class"
                  : "Complete required setup: fill session details and fully configure both pre-work and post-work."
              }
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-emerald-500 px-4 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60 sm:h-10 sm:min-w-[160px] sm:w-auto"
            >
              {submitting ? "Scheduling..." : "Schedule class"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
