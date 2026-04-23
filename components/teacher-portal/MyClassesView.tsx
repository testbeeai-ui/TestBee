"use client";

import { useMemo, useRef, useState } from "react";
import { Calendar, Clock, Link2, Plus } from "lucide-react";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
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
} from "@/lib/teacherPortal/types";

interface MyClassesViewProps {
  sessions: TeacherPortalSessionItem[];
  classrooms: TeacherPortalClassroomCard[];
  onScheduleClass: (input: {
    classroomId: string;
    title: string;
    date: string;
    startTime: string;
    durationMinutes: number;
    meetLink: string;
    allowAdhocTrial: boolean;
    preWork: string;
    postWork: string;
    preWorkMode?: "custom" | "concept_focus";
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
    postWorkMode?: "custom" | "concept_focus";
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

export default function MyClassesView({
  sessions,
  classrooms,
  onScheduleClass,
}: MyClassesViewProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [classroomId, setClassroomId] = useState("");
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [meetLink, setMeetLink] = useState("");
  const [allowAdhocTrial, setAllowAdhocTrial] = useState(true);
  const [preWork, setPreWork] = useState("");
  const [postWork, setPostWork] = useState("");
  const [preWorkMode, setPreWorkMode] = useState<"custom" | "concept_focus">("custom");
  const [preWorkConceptSel, setPreWorkConceptSel] = useState<ConceptFocusSelectionState>(() =>
    initialConceptFocusSelection()
  );
  const [postWorkMode, setPostWorkMode] = useState<"custom" | "concept_focus">("custom");
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
    "h-11 w-full appearance-none rounded-xl border border-white/15 bg-[#0b1020] px-3 pr-10 text-sm outline-none focus:border-emerald-400";

  const canSubmit = useMemo(() => {
    if (!(classroomId && title.trim() && date && startTime && meetLink.trim())) return false;
    if (curriculumLoading && (preWorkMode === "concept_focus" || postWorkMode === "concept_focus"))
      return false;

    const preConfigured =
      preWorkMode === "custom"
        ? Boolean(preWork.trim())
        : conceptFocusSelectionComplete(preWorkConceptSel, curriculumTaxonomy);

    const postConfigured =
      postWorkMode === "custom"
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
        title,
        date,
        startTime,
        durationMinutes,
        meetLink,
        allowAdhocTrial,
        preWork,
        postWork,
        preWorkMode,
        preWorkConceptRef: preConceptRef ?? null,
        postWorkMode,
        postWorkConceptRef: postConceptRef ?? null,
        postWorkDelayDays,
      });
      setOpen(false);
      setClassroomId("");
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
  const primary = sessions[0] ?? null;
  const rest = sessions.slice(1);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-4xl">
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
            className="rounded-full border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
          >
            Week view
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
          Upcoming scheduled classes
        </div>
        {sessions.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-[#15162b] p-5 text-sm text-slate-400">
            No live sessions scheduled yet.
          </div>
        ) : (
          <>
            {primary ? (
              <div className="rounded-2xl border border-white/10 bg-[#111428]">
                <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-300">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{primary.title}</div>
                    <div className="text-xs text-slate-400">
                      {primary.classroomName} · {primary.studentCount} students ·{" "}
                      {timeLabel(primary.scheduledAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {primary.isTrial ? (
                      <span className="rounded bg-amber-500/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200">
                        Trial
                      </span>
                    ) : null}
                    <span className="rounded bg-violet-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-violet-200">
                      Expanded
                    </span>
                  </div>
                </div>
                <div className="grid gap-3 px-4 py-4 md:grid-cols-2">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs text-slate-300">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      Meet
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-slate-500" /> {timeLabel(primary.scheduledAt)}{" "}
                      · {primary.durationMinutes} mins
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-slate-500" />
                      {primary.meetLink ? (
                        <a
                          href={primary.meetLink}
                          target="_blank"
                          rel="noreferrer"
                          className="truncate text-emerald-300 hover:underline"
                        >
                          {primary.meetLink}
                        </a>
                      ) : (
                        "Meet link not set"
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                        Pre-work
                      </div>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {primary.preWork.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                      <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                        Post-work
                      </div>
                      <ul className="space-y-1 text-xs text-slate-300">
                        {primary.postWork.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-2.5 text-xs text-emerald-200">
                      Reward strip: Students completing class + work get +{primary.rewardRdm} RDM
                    </div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="mb-1 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                      Class resources
                    </div>
                    <div className="space-y-1 text-xs text-slate-300">
                      {primary.resources.map((resource) => (
                        <div key={resource.label}>
                          {resource.href ? (
                            <a
                              href={resource.href}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-300 hover:underline"
                            >
                              {resource.label}
                            </a>
                          ) : (
                            resource.label
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="space-y-2">
              {rest.map((session) => (
                <div
                  key={session.id}
                  className="rounded-xl border border-white/10 bg-[#0f1324] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold">{session.title}</div>
                      <div className="text-xs text-slate-400">
                        {session.classroomName} · {session.studentCount} students ·{" "}
                        {timeLabel(session.scheduledAt)}
                      </div>
                    </div>
                    <span className="rounded bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-300">
                      Collapsed
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[96vw] max-w-[1200px] max-h-[92vh] rounded-3xl border border-white/20 bg-[#12162a] p-0 text-slate-100 overflow-hidden">
          <DialogHeader className="border-b border-white/10 px-6 py-5">
            <DialogTitle className="font-serif text-4xl">📅 Schedule a class</DialogTitle>
            <p className="mt-1 text-sm text-slate-400">
              Schedule a live session for your classroom with pre-work, Google Meet link, and
              post-work.
            </p>
          </DialogHeader>
          <div className="border-b border-white/10 px-6 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                Step {scheduleStep} of 2
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleStep(1)}
                  className={`h-8 rounded-full px-3 text-xs font-semibold ${
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
                  className={`h-8 rounded-full px-3 text-xs font-semibold ${
                    scheduleStep === 2
                      ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                      : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
                  }`}
                >
                  Pre/Post assignments
                </button>
              </div>
            </div>
            <div className="mt-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-slate-300">
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

          <div className="px-6 py-5 overflow-y-auto max-h-[calc(92vh-220px)]">
            <div className="space-y-5">
              <div className={`space-y-3.5 ${scheduleStep === 1 ? "block" : "hidden"}`}>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-300">
                    Classroom *
                  </label>
                  <select
                    value={classroomId}
                    onChange={(e) => setClassroomId(e.target.value)}
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
                  <label className="mb-1 block text-sm font-semibold text-slate-300">
                    Session topic *
                  </label>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Electrostatics - Gauss's Law deep dive"
                    className="h-11 w-full rounded-xl border border-white/15 bg-[#0b1020] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
                  />
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <label className="mb-1 block text-sm font-semibold text-slate-300">
                      Date *
                    </label>
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      onClick={() => openNativePicker(dateInputRef.current)}
                      className="h-11 w-full cursor-pointer rounded-xl border border-white/15 bg-[#0b1020] px-3 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="mb-1 block text-sm font-semibold text-slate-300">
                      Start time *
                    </label>
                    <input
                      ref={timeInputRef}
                      type="time"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      onClick={() => openNativePicker(timeInputRef.current)}
                      className="h-11 w-full cursor-pointer rounded-xl border border-white/15 bg-[#0b1020] px-3 text-sm outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="mb-1 block text-sm font-semibold text-slate-300">
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
                  <label className="mb-1 block text-sm font-semibold text-slate-300">
                    Google Meet link *
                  </label>
                  <input
                    value={meetLink}
                    onChange={(e) => setMeetLink(e.target.value)}
                    placeholder="meet.google.com/abc-defg-hij"
                    className="h-11 w-full rounded-xl border border-white/15 bg-[#0b1020] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
                  />
                </div>
              </div>

              <div className={`space-y-3.5 ${scheduleStep === 2 ? "block" : "hidden"}`}>
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-300">
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

                <div className="rounded-xl border border-white/10 bg-[#0c1020] p-3">
                  <div className="mb-3 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAssignmentTab("pre")}
                      className={`h-8 rounded-full px-3 text-xs font-semibold ${
                        assignmentTab === "pre"
                          ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                          : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      Pre-work
                    </button>
                    <button
                      type="button"
                      onClick={() => setAssignmentTab("post")}
                      className={`h-8 rounded-full px-3 text-xs font-semibold ${
                        assignmentTab === "post"
                          ? "bg-emerald-500/20 text-emerald-200 border border-emerald-400/40"
                          : "bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10"
                      }`}
                    >
                      Post-work
                    </button>
                  </div>
                  <p className="mb-3 text-[11px] text-slate-400">
                    {assignmentTab === "pre"
                      ? "Pre-work is immediate and must be fully configured."
                      : "Post-work is mandatory and releases after class based on selected delay."}
                  </p>

                  {assignmentTab === "pre" ? (
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-300">
                        Pre-work for students
                      </label>

                      <div className="mb-2">
                        <select
                          value={preWorkMode}
                          onChange={(e) =>
                            setPreWorkMode(e.target.value as "custom" | "concept_focus")
                          }
                          className={selectClassName}
                        >
                          <option value="custom">Custom assignment</option>
                          <option value="concept_focus">Concept Focus assignment</option>
                        </select>
                      </div>

                      {preWorkMode === "custom" ? (
                        <textarea
                          rows={4}
                          value={preWork}
                          onChange={(e) => setPreWork(e.target.value)}
                          placeholder="e.g. Read Chapter 2 summary. Complete 5 warm-up MCQs."
                          className="w-full rounded-xl border border-white/15 bg-[#0b1020] px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
                        />
                      ) : (
                        <div className="space-y-2">
                          <ConceptFocusAssignmentFields
                            taxonomy={curriculumTaxonomy}
                            taxonomyLoading={curriculumLoading}
                            taxonomyError={curriculumError}
                            value={preWorkConceptSel}
                            onChange={setPreWorkConceptSel}
                            selectClassName={selectClassName}
                          />
                          <p className="text-[11px] text-slate-400">
                            Students will get this concept-focus pre-work automatically before
                            class.
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-300">
                        Post-work after class
                      </label>

                      <div className="mb-2">
                        <select
                          value={postWorkMode}
                          onChange={(e) =>
                            setPostWorkMode(e.target.value as "custom" | "concept_focus")
                          }
                          className={selectClassName}
                        >
                          <option value="custom">Custom assignment</option>
                          <option value="concept_focus">Concept Focus assignment</option>
                        </select>
                      </div>

                      <div className="mb-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                            Release delay after class
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

                      {postWorkMode === "custom" ? (
                        <textarea
                          rows={4}
                          value={postWork}
                          onChange={(e) => setPostWork(e.target.value)}
                          placeholder="e.g. Complete 10-Q Testbee quiz and post 2 doubts on Gyan++."
                          className="w-full rounded-xl border border-white/15 bg-[#0b1020] px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400"
                        />
                      ) : (
                        <div className="space-y-2">
                          <ConceptFocusAssignmentFields
                            taxonomy={curriculumTaxonomy}
                            taxonomyLoading={curriculumLoading}
                            taxonomyError={curriculumError}
                            value={postWorkConceptSel}
                            onChange={setPostWorkConceptSel}
                            selectClassName={selectClassName}
                          />
                          <p className="text-[11px] text-slate-400">
                            This post-work concept assignment will release after class completion
                            based on the delay above.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-[#11162a] px-6 py-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 min-w-[110px] items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-300 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setScheduleStep((prev) => (prev === 1 ? 2 : 1))}
              className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-full border border-white/15 px-6 text-sm font-semibold text-slate-200 hover:bg-white/5"
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
              className="inline-flex h-10 min-w-[180px] items-center justify-center rounded-full bg-emerald-500 px-6 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-60"
            >
              {submitting ? "Scheduling..." : "Schedule class"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
