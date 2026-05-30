"use client";

import { ChevronLeft, ChevronRight, Lightbulb, X } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { toast as toastFn } from "@/hooks/use-toast";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import { supabase } from "@/integrations/supabase/client";
import ConceptFocusAssignmentFields, {
  type ConceptFocusSelectionState,
  initialConceptFocusSelection,
  conceptFocusSelectionComplete,
} from "@/components/teacher-portal/assignment/fields/ConceptFocusAssignmentFields";
import {
  chapterQuizToRef,
  type ChapterQuizSelectionState,
} from "@/lib/teacherPortal/chapterQuizUtils";
import type { TeacherPortalClassroomCard } from "@/lib/teacherPortal/types";
import { useTeacherRdmCosts } from "@/hooks/TeacherRdmCostsContext";
import WallTimeSelects from "@/components/teacher-portal/live/WallTimeSelects";

export type ScheduleLiveSessionPayload = {
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
};

export type ScheduleLiveSessionPanelProps = {
  variant: "dialog" | "embedded";
  /** When `variant="dialog"`, parent dialog open state (for Meet-link autofill effect). */
  dialogOpen?: boolean;
  classrooms: TeacherPortalClassroomCard[];
  toast: typeof toastFn;
  onSchedule: (input: ScheduleLiveSessionPayload) => Promise<void>;
  /** After successful schedule + internal reset */
  onComplete?: () => void;
  /** Cancel / dismiss (footer): dialog closes; wizard exits task */
  onDismiss?: () => void;
  headingTitle?: string;
  headingSubtitle?: string;
  submitLabel?: string;
  /** Embedded in Teacher Wizard: autosave draft (sessionStorage) across close/reopen */
  sessionDraftKey?: string;
  /** Teacher Wizard: keep left/right step in sync. */
  externalStep?: 1 | 2 | 3 | 4 | 5;
  onStepChange?: (step: 1 | 2 | 3 | 4 | 5) => void;
};

type ScheduleLiveEmbeddedDraftV1 = {
  v: 1;
  wizardStep: 1 | 2 | 3 | 4 | 5;
  classroomId: string;
  sectionId: string | null;
  title: string;
  date: string;
  startTime: string;
  durationMinutes: number;
  meetLink: string;
  allowAdhocTrial: boolean;
  preWork: string;
  postWork: string;
  preWorkMode: "none" | "custom" | "concept_focus";
  preWorkConceptSel: ConceptFocusSelectionState;
  postWorkMode: "none" | "custom" | "concept_focus";
  postWorkConceptSel: ConceptFocusSelectionState;
  postWorkDelayDays: number;
  preWorkLinkDraft: string;
};

export default function ScheduleLiveSessionPanel({
  variant,
  dialogOpen = true,
  classrooms,
  toast,
  onSchedule,
  onComplete,
  onDismiss,
  headingTitle = "📅 Schedule a class",
  headingSubtitle = "Schedule a live session for your classroom with pre-work, Google Meet link, and post-work.",
  submitLabel,
  sessionDraftKey,
  externalStep,
  onStepChange,
}: ScheduleLiveSessionPanelProps) {
  const { costs: teacherRdmCosts } = useTeacherRdmCosts();
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
  /** Quick-add line for custom pre-work resources (appended to `preWork`). */
  const [preWorkLinkDraft, setPreWorkLinkDraft] = useState("");
  /** Wizard steps 1–5 — matches horizontal stepper (one pane at a time). */
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  useEffect(() => {
    if (!externalStep) return;
    if (externalStep === wizardStep) return;
    setWizardStep(externalStep);
  }, [externalStep, wizardStep]);

  const setWizardStepSynced = (next: 1 | 2 | 3 | 4 | 5) => {
    setWizardStep(next);
    onStepChange?.(next);
  };

  const {
    taxonomy: curriculumTaxonomy,
    loading: curriculumLoading,
    error: curriculumError,
  } = useTopicTaxonomy();
  const dateInputRef = useRef<HTMLInputElement | null>(null);
  const selectClassName =
    "h-9 w-full appearance-none rounded-lg border border-white/15 bg-[#0b1020] px-2.5 pr-9 text-sm outline-none focus:border-emerald-400 sm:h-10 sm:rounded-xl sm:px-3 sm:pr-10";

  const panelActive = variant === "embedded" || dialogOpen;

  const lastScheduleEmbeddedDraftMarkerRef = useRef<string>("");

  useLayoutEffect(() => {
    const key = sessionDraftKey;
    if (!key || variant !== "embedded") return;
    const classroomSig = classrooms
      .map((c) => c.id)
      .sort()
      .join(",");
    const marker = `${key}|${classroomSig}`;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(key);
    } catch {
      return;
    }
    if (!raw) {
      lastScheduleEmbeddedDraftMarkerRef.current = marker;
      return;
    }
    try {
      const d = JSON.parse(raw) as ScheduleLiveEmbeddedDraftV1;
      if (d.v !== 1) return;
      const cid = typeof d.classroomId === "string" ? d.classroomId.trim() : "";
      if (cid && classrooms.length > 0 && !classrooms.some((c) => c.id === cid)) return;
      if (lastScheduleEmbeddedDraftMarkerRef.current === marker) return;
      lastScheduleEmbeddedDraftMarkerRef.current = marker;

      if (typeof d.wizardStep === "number" && d.wizardStep >= 1 && d.wizardStep <= 5)
        setWizardStep(d.wizardStep as 1 | 2 | 3 | 4 | 5);
      if (cid && classrooms.some((c) => c.id === cid)) setClassroomId(cid);
      if (d.sectionId === null || typeof d.sectionId === "string") setSectionId(d.sectionId);
      if (typeof d.title === "string") setTitle(d.title);
      if (typeof d.date === "string") setDate(d.date);
      if (typeof d.startTime === "string") setStartTime(d.startTime);
      if (typeof d.durationMinutes === "number" && Number.isFinite(d.durationMinutes))
        setDurationMinutes(d.durationMinutes);
      if (typeof d.meetLink === "string") setMeetLink(d.meetLink);
      if (typeof d.allowAdhocTrial === "boolean") setAllowAdhocTrial(d.allowAdhocTrial);
      if (typeof d.preWork === "string") setPreWork(d.preWork);
      if (typeof d.postWork === "string") setPostWork(d.postWork);
      if (
        d.preWorkMode === "none" ||
        d.preWorkMode === "custom" ||
        d.preWorkMode === "concept_focus"
      )
        setPreWorkMode(d.preWorkMode);
      if (
        d.postWorkMode === "none" ||
        d.postWorkMode === "custom" ||
        d.postWorkMode === "concept_focus"
      )
        setPostWorkMode(d.postWorkMode);
      if (d.preWorkConceptSel && typeof d.preWorkConceptSel === "object")
        setPreWorkConceptSel(d.preWorkConceptSel);
      if (d.postWorkConceptSel && typeof d.postWorkConceptSel === "object")
        setPostWorkConceptSel(d.postWorkConceptSel);
      if (typeof d.postWorkDelayDays === "number" && Number.isFinite(d.postWorkDelayDays))
        setPostWorkDelayDays(d.postWorkDelayDays);
      if (typeof d.preWorkLinkDraft === "string") setPreWorkLinkDraft(d.preWorkLinkDraft);
    } catch {
      // ignore
    }
  }, [sessionDraftKey, variant, classrooms]);

  useEffect(() => {
    const key = sessionDraftKey;
    if (!key || variant !== "embedded") return;
    const payload: ScheduleLiveEmbeddedDraftV1 = {
      v: 1,
      wizardStep,
      classroomId,
      sectionId,
      title,
      date,
      startTime,
      durationMinutes,
      meetLink,
      allowAdhocTrial,
      preWork,
      postWork,
      preWorkMode,
      preWorkConceptSel,
      postWorkMode,
      postWorkConceptSel,
      postWorkDelayDays,
      preWorkLinkDraft,
    };
    const id = window.setTimeout(() => {
      try {
        sessionStorage.setItem(key, JSON.stringify(payload));
      } catch {
        // ignore
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [
    sessionDraftKey,
    variant,
    wizardStep,
    classroomId,
    sectionId,
    title,
    date,
    startTime,
    durationMinutes,
    meetLink,
    allowAdhocTrial,
    preWork,
    postWork,
    preWorkMode,
    preWorkConceptSel,
    postWorkMode,
    postWorkConceptSel,
    postWorkDelayDays,
    preWorkLinkDraft,
  ]);

  useEffect(() => {
    let alive = true;
    if (!classroomId) {
      setSectionId(null);
      setSectionOptions([]);
      return;
    }
    setSectionLoading(true);
    void supabase
      // Supabase generated types may not include this table yet.
      .from("classroom_sections" as never)
      .select(
        "id, name, schedule_time, repeat_days, duration_minutes, google_meet_link, schedule_end_date, is_active"
      )
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
            schedule_end_date?: string | null;
            is_active?: boolean | null;
          }> | null) ?? [];
        const todayIso = new Date().toISOString().slice(0, 10);
        const active = opts.filter((s) => {
          if (typeof s.is_active === "boolean") return s.is_active;
          const end = typeof s.schedule_end_date === "string" ? s.schedule_end_date.trim() : "";
          if (!end) return true;
          if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return true;
          return end >= todayIso;
        });
        setSectionOptions(
          active.map((s) => {
            const time =
              typeof s.schedule_time === "string" && s.schedule_time.trim()
                ? s.schedule_time.trim()
                : null;
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
    if (!panelActive) return;
    if (!sectionId) return;
    const sec = sectionOptions.find((s) => s.id === sectionId);
    const link = sec?.googleMeetLink?.trim() ?? "";
    if (link) {
      setMeetLink(link);
    }
  }, [panelActive, sectionId, sectionOptions]);

  const preConfigured = useMemo(() => {
    if (preWorkMode === "none") return true;
    if (preWorkMode === "custom") return Boolean(preWork.trim());
    return conceptFocusSelectionComplete(preWorkConceptSel, curriculumTaxonomy);
  }, [preWorkMode, preWork, preWorkConceptSel, curriculumTaxonomy]);

  const postConfigured = useMemo(() => {
    if (postWorkMode === "none") return true;
    if (postWorkMode === "custom") return Boolean(postWork.trim());
    return conceptFocusSelectionComplete(postWorkConceptSel, curriculumTaxonomy);
  }, [postWorkMode, postWork, postWorkConceptSel, curriculumTaxonomy]);

  const canSubmit = useMemo(() => {
    if (!(classroomId && title.trim() && date && startTime && meetLink.trim())) return false;
    if (curriculumLoading && (preWorkMode === "concept_focus" || postWorkMode === "concept_focus"))
      return false;

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
    preConfigured,
    postConfigured,
    postWorkDelayDays,
  ]);

  const step1Ok = Boolean(classroomId && title.trim());
  const step2Ok = Boolean(date && startTime && meetLink.trim());
  const canGoNext = useMemo(() => {
    switch (wizardStep) {
      case 1:
        return step1Ok;
      case 2:
        return step2Ok;
      case 3:
        return preConfigured && !(preWorkMode === "concept_focus" && curriculumLoading);
      case 4:
        return postConfigured && !(postWorkMode === "concept_focus" && curriculumLoading);
      default:
        return true;
    }
  }, [
    wizardStep,
    step1Ok,
    step2Ok,
    preConfigured,
    postConfigured,
    preWorkMode,
    postWorkMode,
    curriculumLoading,
  ]);

  const resetAll = () => {
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
    setPreWorkLinkDraft("");
    setWizardStep(1);
  };

  const appendPreWorkResource = () => {
    const line = preWorkLinkDraft.trim();
    if (!line) return;
    setPreWork((p) => {
      const prev = p.trim();
      return prev ? `${prev}\n${line}` : line;
    });
    setPreWorkLinkDraft("");
  };

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

      await onSchedule({
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

      if (sessionDraftKey) {
        try {
          sessionStorage.removeItem(sessionDraftKey);
        } catch {
          // ignore
        }
      }

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
            title: `Scheduled, but no email notification sent — ${msg}`,
            variant: "destructive",
          });
        } else {
          const added = Number(json?.addedStudentEmails) || 0;
          const missing = Number(json?.studentsWithoutEmail) || 0;
          toast({
            title:
              added > 0
                ? `Google notifications sent — invites sent to ${added} student(s).${missing ? ` (${missing} missing email)` : ""}`
                : missing
                  ? `${missing} student(s) are missing an email on their account.`
                  : "Google notifications sent — no new student emails to add.",
          });
        }
      } catch {
        toast({
          title:
            "Scheduled, but notification sync failed — could not reach Google sync. Try again in a minute.",
          variant: "destructive",
        });
      }

      resetAll();
      onComplete?.();
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
        // ignore
      }
    }
    input.focus();
  };

  const baseSubmitLabel =
    submitLabel ??
    (headingTitle.toLowerCase().includes("webinar") ? "Schedule webinar" : "Schedule class");
  const resolvedSubmitLabel = `${baseSubmitLabel} (-${teacherRdmCosts.schedule_session} RDM)`;

  const stepCount = 5 as const;
  const stepTabLabels = [
    "Title & Classroom",
    "Date & Meet",
    "Pre-work",
    "Post-work",
    "Trial & Publish",
  ] as const;
  const progressPct = Math.round((wizardStep / stepCount) * 100);

  const scrollMaxClass =
    variant === "embedded"
      ? "min-h-0 flex-1 overflow-y-auto overscroll-contain"
      : "max-h-[min(58dvh,calc(100dvh-13.5rem))] overflow-y-auto overscroll-contain sm:max-h-[min(70dvh,calc(92dvh-12rem))] sm:px-6 sm:py-3 lg:max-h-[min(72dvh,calc(92dvh-11rem))]";

  const headerPadding =
    variant === "embedded"
      ? "border-b border-white/10 px-3 pb-2 pt-2.5 sm:px-5 sm:pb-2.5 sm:pt-3"
      : "shrink-0 border-b border-white/10 px-4 pb-3 pt-4 pr-12 text-left sm:px-6 sm:pb-4 sm:pt-5";

  const stepStripPadding =
    variant === "embedded"
      ? "shrink-0 border-b border-white/10 px-3 py-1 sm:px-5 sm:py-1.5"
      : "shrink-0 border-b border-white/10 px-4 py-2.5 sm:px-6 sm:py-3";

  const scrollPadding = variant === "embedded" ? "px-3 py-1.5 sm:px-5 sm:py-2" : "px-4 py-2.5";

  const rootClass =
    variant === "embedded"
      ? "flex min-h-0 flex-1 flex-col overflow-hidden text-[13px] text-slate-100 sm:text-sm"
      : "flex max-h-[92dvh] flex-col gap-0 overflow-hidden text-slate-100";

  const stepHeadline = (() => {
    switch (wizardStep) {
      case 1:
        return "Lesson title & classroom";
      case 2:
        return "Date, time, duration & Google Meet link";
      case 3:
        return "Add pre-work resources";
      case 4:
        return "Post-work assignment";
      case 5:
        return "Enable adhoc trial & publish";
      default:
        return "";
    }
  })();

  return (
    <div className={rootClass}>
      <div className={headerPadding}>
        {variant === "embedded" ? (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="font-serif text-lg leading-tight sm:text-xl">
                Schedule a <span className="italic text-emerald-300">lesson / webinar</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-slate-400 line-clamp-3 sm:text-xs">
                {headingSubtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss?.()}
              className="shrink-0 rounded-full border border-white/15 bg-white/5 p-1.5 text-slate-300 hover:bg-white/10"
              aria-label="Close"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <>
            <div className="font-serif text-xl leading-tight sm:text-2xl lg:text-3xl">
              {headingTitle}
            </div>
            <p className="mt-1 text-xs text-slate-400 sm:text-sm">{headingSubtitle}</p>
          </>
        )}
      </div>

      {variant === "embedded" ? (
        <div className={stepStripPadding}>
          <div className="mb-3 rounded-2xl border border-white/10 bg-[#0d0d1c] px-3 py-2">
            <div className="flex items-center gap-3">
              <div className="text-xs text-slate-300">Progress</div>
              <div className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-[width]"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="text-xs font-semibold text-emerald-200">
                Step {wizardStep} of {stepCount}
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0d0d1c]">
            <div className="flex w-full overflow-x-auto border-b border-white/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {stepTabLabels.map((tabLabel, i) => {
                const stepNum = i + 1;
                const isActive = wizardStep === stepNum;
                const isDone = wizardStep > stepNum;
                return (
                  <button
                    key={tabLabel}
                    type="button"
                    onClick={() => setWizardStepSynced(stepNum as 1 | 2 | 3 | 4 | 5)}
                    className={`inline-flex shrink-0 items-center gap-2 border-r border-white/10 px-4 py-3 text-xs font-semibold transition ${
                      isActive
                        ? "bg-emerald-500/10 text-emerald-200"
                        : isDone
                          ? "text-slate-200/80 hover:bg-white/[0.03]"
                          : "text-slate-400 hover:bg-white/[0.03]"
                    }`}
                  >
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-bold ${
                        isDone
                          ? "border-emerald-400 bg-emerald-400 text-black"
                          : isActive
                            ? "border-emerald-400 text-emerald-200"
                            : "border-white/20 text-slate-400"
                      }`}
                    >
                      {stepNum}
                    </span>
                    {tabLabel}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className={stepStripPadding}>
          <div className="flex gap-0 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {(
              [
                [1, "Title & Classroom"],
                [2, "Date & Meet link"],
                [3, "Pre-work"],
                [4, "Post-work"],
                [5, "Trial & Publish"],
              ] as const
            ).map(([n, label]) => {
              const active = wizardStep === n;
              const done = wizardStep > n;
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => setWizardStepSynced(n)}
                  className={`shrink-0 border-b-2 px-2 py-1.5 text-left text-[10px] font-semibold transition sm:px-3 sm:py-2 sm:text-xs ${
                    active
                      ? "border-emerald-400 text-emerald-300"
                      : done
                        ? "border-transparent text-slate-400 hover:text-slate-200"
                        : "border-transparent text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <span
                    className={`mr-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold sm:mr-1 sm:h-5 sm:w-5 sm:text-[10px] ${
                      active
                        ? "bg-emerald-500/25 text-emerald-200"
                        : done
                          ? "bg-emerald-500/40 text-emerald-950"
                          : "bg-white/[0.08] text-slate-500"
                    }`}
                  >
                    {n}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className={`${scrollMaxClass} ${scrollPadding}`}>
        <div className="rounded-xl border border-white/10 bg-[#0b0f1d]/90 p-3 sm:rounded-2xl sm:p-4">
          <div className="mb-2 text-sm font-semibold leading-snug text-slate-100 sm:mb-3 sm:text-base">
            Step {wizardStep} — {stepHeadline}
          </div>

          {/* Step 1 — Title & classroom (matches reference: classroom | topic) */}
          {wizardStep === 1 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                  Classroom
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
                <label className="mb-1 block text-xs font-semibold text-slate-300 sm:text-sm">
                  Session topic <span className="text-rose-400">*</span>
                </label>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Electrostatics — Gauss's Law deep dive"
                  className="h-10 w-full rounded-lg border border-white/15 bg-[#0b1020] px-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:rounded-xl sm:px-3"
                />
              </div>
            </div>
          ) : null}

          {/* Step 2 — Notify + Date / time / Meet */}
          {wizardStep === 2 ? (
            <div className="space-y-3">
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
                  Whole class = everyone gets notified. Only section = just that section gets
                  notified.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 min-[480px]:gap-3">
                <div className="min-w-0">
                  <label className="mb-0.5 block text-[11px] font-semibold text-slate-300 sm:text-xs">
                    Date *
                  </label>
                  <input
                    ref={dateInputRef}
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    onClick={() => openNativePicker(dateInputRef.current)}
                    className="h-9 w-full min-w-0 cursor-pointer rounded-lg border border-white/15 bg-[#0b1020] px-2 text-sm outline-none focus:border-emerald-400 sm:h-10 sm:rounded-xl sm:px-3"
                  />
                </div>
                <div className="flex min-w-0 flex-col gap-2">
                  <div className="min-w-0">
                    <label className="mb-0.5 block text-[11px] font-semibold text-slate-300 sm:text-xs">
                      Start *
                    </label>
                    <WallTimeSelects value={startTime} onChange={setStartTime} />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-0.5 block text-[11px] font-semibold text-slate-300 sm:text-xs">
                      Duration
                    </label>
                    <select
                      value={String(durationMinutes)}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className={selectClassName}
                    >
                      <option value="45">45m</option>
                      <option value="60">60m</option>
                      <option value="90">90m</option>
                      <option value="120">120m</option>
                    </select>
                  </div>
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
                  className="h-10 w-full rounded-lg border border-white/15 bg-[#0b1020] px-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:rounded-xl sm:px-3"
                />
              </div>
            </div>
          ) : null}

          {/* Step 3 — Pre-work */}
          {wizardStep === 3 ? (
            <div className="space-y-2">
              <p className="text-xs leading-snug text-slate-400 sm:text-[13px]">
                Students should complete these before attending the class.
              </p>
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
                <p className="text-[10px] leading-snug text-slate-500 sm:max-w-[12rem] sm:pb-0.5 sm:text-right">
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
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-300">
                      Add resource (PDF, video link, or Testbee task)
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                      <input
                        value={preWorkLinkDraft}
                        onChange={(e) => setPreWorkLinkDraft(e.target.value)}
                        placeholder="e.g. NCERT Chapter 2 PDF or youtube.com/..."
                        className="h-10 min-w-0 flex-1 rounded-lg border border-white/15 bg-[#0b1020] px-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:rounded-xl sm:px-3"
                      />
                      <button
                        type="button"
                        onClick={appendPreWorkResource}
                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-white/15 bg-white/[0.06] px-3 text-xs font-semibold text-slate-200 hover:bg-white/10 sm:rounded-xl sm:px-4"
                      >
                        + Add
                      </button>
                    </div>
                  </div>
                  <textarea
                    rows={variant === "embedded" ? 2 : 3}
                    value={preWork}
                    onChange={(e) => setPreWork(e.target.value)}
                    placeholder="e.g. Read Chapter 2 summary. Complete 5 warm-up MCQs. (Lines stack when you use + Add.)"
                    className="w-full rounded-lg border border-white/15 bg-[#0b1020] px-2.5 py-1.5 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:rounded-xl sm:px-3 sm:py-2"
                  />
                </div>
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
          ) : null}

          {/* Step 4 — Post-work */}
          {wizardStep === 4 ? (
            <div className="space-y-2">
              <p className="text-xs leading-snug text-slate-400 sm:text-[13px]">
                Students earn <span className="font-semibold text-emerald-300/95">+40 RDM</span>{" "}
                automatically when they complete all post-work (when configured).
              </p>
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
                    onChange={(e) => setPostWorkDelayDays(Math.max(0, Number(e.target.value) || 0))}
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
                  rows={variant === "embedded" ? 2 : 3}
                  value={postWork}
                  onChange={(e) => setPostWork(e.target.value)}
                  placeholder="e.g. Complete 10-Q Testbee quiz on Gauss's Law. Post 2 doubts on Gyan++."
                  className="w-full rounded-lg border border-white/15 bg-[#0b1020] px-2.5 py-1.5 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:rounded-xl sm:px-3 sm:py-2"
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
          ) : null}

          {/* Step 5 — Trial & publish */}
          {wizardStep === 5 ? (
            <div className="space-y-2 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.07] p-3 sm:space-y-3 sm:p-4">
              <p className="text-xs leading-snug text-slate-400 sm:text-[13px]">
                Allow adhoc trial for EduBlast members?
              </p>
              <div>
                <label className="mb-0.5 block text-xs font-semibold text-slate-300 sm:text-sm">
                  Adhoc trial access
                </label>
                <select
                  value={allowAdhocTrial ? "yes" : "no"}
                  onChange={(e) => setAllowAdhocTrial(e.target.value === "yes")}
                  className={selectClassName}
                >
                  <option value="yes">Yes — open trial slots (50 RDM to continue)</option>
                  <option value="no">No — enrolled students only</option>
                </select>
              </div>
              <div className="flex gap-2 rounded-lg border border-white/10 bg-[#070b14]/80 px-2.5 py-2 text-[11px] leading-snug text-slate-400 sm:text-xs">
                <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/90" aria-hidden />
                <p>
                  You earn <span className="font-semibold text-emerald-300">+30 RDM</span> for every
                  trial student who converts to a full-session pay-by-RDM attendee.
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {variant === "embedded" ? (
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/10 bg-[#11162a] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4 sm:py-2.5">
          {wizardStep > 1 ? (
            <button
              type="button"
              onClick={() =>
                setWizardStepSynced(Math.max(1, wizardStep - 1) as unknown as 1 | 2 | 3 | 4 | 5)
              }
              className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-semibold text-slate-200 hover:bg-white/5 sm:h-9 sm:min-w-[92px] sm:px-4 sm:text-sm"
            >
              <ChevronLeft className="mr-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
              Back
            </button>
          ) : (
            <span aria-hidden className="inline-block min-w-[92px]" />
          )}

          <span className="text-[10px] font-medium tabular-nums text-slate-500 sm:text-[11px]">
            Step {wizardStep} of {stepCount}
          </span>

          {wizardStep < stepCount ? (
            <button
              type="button"
              onClick={() => {
                if (canGoNext)
                  setWizardStepSynced(
                    Math.min(stepCount, wizardStep + 1) as unknown as 1 | 2 | 3 | 4 | 5
                  );
              }}
              disabled={!canGoNext}
              className="inline-flex h-9 items-center justify-center rounded-full bg-emerald-500 px-4 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 sm:h-9 sm:min-w-[128px] sm:px-5 sm:text-sm"
            >
              Next: {(stepTabLabels as readonly string[])[wizardStep] ?? "Next"}
              <ChevronRight className="ml-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            </button>
          ) : (
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
                  ? resolvedSubmitLabel
                  : "Complete required setup for pre-work and post-work."
              }
              className="inline-flex h-9 items-center justify-center rounded-full bg-emerald-500 px-4 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60 sm:h-9 sm:min-w-[148px] sm:px-5 sm:text-sm"
            >
              {submitting ? "Scheduling..." : resolvedSubmitLabel}
            </button>
          )}
        </div>
      ) : (
        <div className="flex shrink-0 flex-col gap-1.5 border-t border-white/10 bg-[#11162a] px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-2 sm:px-4 sm:py-2.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 sm:gap-x-3">
            <span className="text-[10px] font-medium tabular-nums text-slate-500 sm:text-[11px]">
              Step {wizardStep} of {stepCount}
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => onDismiss?.()}
                className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-semibold text-slate-300 hover:bg-white/5 sm:h-9 sm:min-w-[92px] sm:px-4 sm:text-sm"
              >
                Cancel
              </button>
              {wizardStep > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setWizardStepSynced(Math.max(1, wizardStep - 1) as unknown as 1 | 2 | 3 | 4 | 5)
                  }
                  className="inline-flex h-9 items-center justify-center rounded-full border border-white/15 px-3 text-xs font-semibold text-slate-200 hover:bg-white/5 sm:h-9 sm:min-w-[92px] sm:px-4 sm:text-sm"
                >
                  <ChevronLeft className="mr-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
                  Back
                </button>
              ) : null}
            </div>
          </div>
          {wizardStep < stepCount ? (
            <button
              type="button"
              onClick={() => {
                if (canGoNext)
                  setWizardStepSynced(
                    Math.min(stepCount, wizardStep + 1) as unknown as 1 | 2 | 3 | 4 | 5
                  );
              }}
              disabled={!canGoNext}
              className="inline-flex h-9 w-full shrink-0 items-center justify-center rounded-full bg-emerald-500 px-4 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 sm:h-9 sm:w-auto sm:min-w-[128px] sm:px-5 sm:text-sm"
            >
              Next
              <ChevronRight className="ml-0.5 h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            </button>
          ) : (
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
                  ? resolvedSubmitLabel
                  : "Complete required setup for pre-work and post-work."
              }
              className="inline-flex h-9 w-full shrink-0 items-center justify-center rounded-full bg-emerald-500 px-4 text-xs font-semibold text-black hover:bg-emerald-400 disabled:opacity-60 sm:h-9 sm:w-auto sm:min-w-[148px] sm:px-5 sm:text-sm"
            >
              {submitting ? "Scheduling..." : resolvedSubmitLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
