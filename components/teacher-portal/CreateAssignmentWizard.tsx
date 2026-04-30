"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, Check, Loader2 } from "lucide-react";
import type {
  TeacherPortalChapterQuizRef,
  TeacherPortalClassroomCard,
  TeacherPortalClassroomDetail,
  TeacherPortalGyanEngagementRef,
  TeacherPortalMockPaperRef,
} from "@/lib/teacherPortal/types";
import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import {
  buildDefaultTasksForAssignmentType,
  normalizeTaskPositions,
} from "@/lib/classroom/assignmentTasks";
import ChapterQuizAssignmentFields from "@/components/teacher-portal/ChapterQuizAssignmentFields";
import ConceptFocusAssignmentFields, {
  conceptFocusSelectionComplete,
  initialConceptFocusSelection,
  type ConceptFocusSelectionState,
} from "@/components/teacher-portal/ConceptFocusAssignmentFields";
import GyanEngagementAssignmentFields from "@/components/teacher-portal/GyanEngagementAssignmentFields";
import {
  chapterQuizSelectionComplete,
  chapterQuizToRef,
  initialChapterQuizSelection,
  type ChapterQuizSelectionState,
} from "@/lib/teacherPortal/chapterQuizUtils";
import { useTopicTaxonomy } from "@/hooks/useTopicTaxonomy";
import { fetchMockPapersFromSupabase } from "@/lib/mockPapersFromSupabase";
import type { MockPaper } from "@/types";

type WizardTypeKey = "quiz" | "concept_focus" | "gyan" | "mock";
type AssignScope = "full" | "section" | "students";

type PublishInput = {
  classroomId: string;
  sectionId?: string | null;
  assignmentType: string;
  title: string;
  dueDate: string | null;
  assignToLabel: string;
  targetStudentIds?: string[] | null;
  rewardRdm: number;
  instructions: string;
  tasks?: AssignmentTaskStored[];
  mockPaper?: TeacherPortalMockPaperRef | null;
  chapterQuiz?: TeacherPortalChapterQuizRef | null;
  gyanEngagement?: TeacherPortalGyanEngagementRef | null;
};

const TYPE_META: Record<
  WizardTypeKey,
  {
    label: string;
    subtitle: string;
    assignmentTypeLabel: string;
    derivedType: "mock" | "quiz" | "Concept Focus" | "assignment";
  }
> = {
  quiz: {
    label: "MCQ (Chapter Quiz)",
    subtitle: "15–30 MCQs on a specific chapter · auto-graded",
    assignmentTypeLabel: "Chapter Quiz (MCQs)",
    derivedType: "quiz",
  },
  concept_focus: {
    label: "Concept Focus",
    subtitle: "Theory + quiz + InstaCue + numerals practice on one subtopic",
    assignmentTypeLabel: "Concept Focus",
    derivedType: "Concept Focus",
  },
  gyan: {
    label: "Gyan++ Engagement",
    subtitle: "Ask students to post doubts (drives discussion + participation)",
    assignmentTypeLabel: "Gyan++ engagement",
    derivedType: "assignment",
  },
  mock: {
    label: "Full Mock Paper",
    subtitle: "40–90 question full-length test in exam pattern",
    assignmentTypeLabel: "Mock Paper (full length)",
    derivedType: "mock",
  },
};

function pill(active: boolean) {
  return active
    ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-50"
    : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.06]";
}

function sectionTitle(step: number) {
  if (step === 1) return "Choose assignment type & topic";
  if (step === 2) return "Configure questions, resources & duration";
  if (step === 3) return "Assign to students, section, or full class";
  return "Set due date, RDM reward & publish";
}

type EmbeddedAssignmentDraftV1 = {
  v: 1;
  step: 1 | 2 | 3 | 4;
  typeKey: WizardTypeKey;
  title: string;
  titleTouched: boolean;
  chapterQuizSel: ChapterQuizSelectionState;
  conceptFocusSel: ConceptFocusSelectionState;
  gyanTopicFocus: string;
  gyanSubtopicHint: string;
  selectedMockPaperId: string | null;
  classroomId: string;
  scope: AssignScope;
  sectionId: string | null;
  studentIds: string[];
  studentSearch: string;
  dueDate: string;
  rewardRdm: number;
  instructions: string;
};

export default function CreateAssignmentWizard(props: {
  teacherId: string;
  classrooms: TeacherPortalClassroomCard[];
  classroomDetails: Record<string, TeacherPortalClassroomDetail>;
  initialClassroomId?: string | null;
  variant?: "page" | "embedded";
  /** When set (e.g. Teacher Wizard embedded), draft survives closing the wizard (sessionStorage). */
  sessionDraftKey?: string;
  onCancel: () => void;
  onPublish: (input: Omit<PublishInput, "title"> & { title: string }) => Promise<void>;
}) {
  const { taxonomy, loading: taxonomyLoading, error: taxonomyError } = useTopicTaxonomy();
  const variant = props.variant ?? "page";

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [typeKey, setTypeKey] = useState<WizardTypeKey>("quiz");
  const meta = TYPE_META[typeKey];

  const [title, setTitle] = useState("");
  const titleTouchedRef = useRef(false);
  const lastAutoTitleRef = useRef<string>("");

  const [chapterQuizSel, setChapterQuizSel] = useState<ChapterQuizSelectionState>(() =>
    initialChapterQuizSelection()
  );
  const [conceptFocusSel, setConceptFocusSel] = useState<ConceptFocusSelectionState>(() =>
    initialConceptFocusSelection()
  );

  const [gyanTopicFocus, setGyanTopicFocus] = useState("");
  const [gyanSubtopicHint, setGyanSubtopicHint] = useState("");

  const [mockPapers, setMockPapers] = useState<MockPaper[]>([]);
  const [mockPapersLoading, setMockPapersLoading] = useState(false);
  const [mockPapersError, setMockPapersError] = useState<string | null>(null);
  const [selectedMockPaperId, setSelectedMockPaperId] = useState<string | null>(null);

  const [classroomId, setClassroomId] = useState<string>(() => {
    const preferred = (props.initialClassroomId ?? "").trim();
    if (preferred && props.classrooms.some((c) => c.id === preferred)) return preferred;
    return props.classrooms[0]?.id ?? "";
  });
  const detail = classroomId ? props.classroomDetails[classroomId] : undefined;
  const activeSections = useMemo(
    () => (detail?.sections ?? []).filter((s) => s.isActive !== false),
    [detail?.sections]
  );

  const [scope, setScope] = useState<AssignScope>("full");
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  const [dueDate, setDueDate] = useState<string>("");
  const [rewardRdm, setRewardRdm] = useState<number>(15);
  const [instructions, setInstructions] = useState<string>("");
  const [publishing, setPublishing] = useState(false);

  const lastEmbeddedAssignmentDraftMarkerRef = useRef<string>("");

  useLayoutEffect(() => {
    const key = props.sessionDraftKey;
    if (!key || props.variant !== "embedded") return;
    const classroomSig = props.classrooms.map((c) => c.id).sort().join(",");
    const marker = `${key}|${classroomSig}`;
    let raw: string | null = null;
    try {
      raw = sessionStorage.getItem(key);
    } catch {
      return;
    }
    if (!raw) {
      lastEmbeddedAssignmentDraftMarkerRef.current = marker;
      return;
    }
    try {
      const d = JSON.parse(raw) as EmbeddedAssignmentDraftV1;
      if (d.v !== 1) return;
      const cid = typeof d.classroomId === "string" ? d.classroomId.trim() : "";
      if (cid && props.classrooms.length > 0 && !props.classrooms.some((c) => c.id === cid)) return;
      if (lastEmbeddedAssignmentDraftMarkerRef.current === marker) return;
      lastEmbeddedAssignmentDraftMarkerRef.current = marker;

      if (typeof d.step === "number" && d.step >= 1 && d.step <= 4) setStep(d.step as 1 | 2 | 3 | 4);
      if (d.typeKey === "quiz" || d.typeKey === "concept_focus" || d.typeKey === "gyan" || d.typeKey === "mock")
        setTypeKey(d.typeKey);
      if (typeof d.title === "string") setTitle(d.title);
      titleTouchedRef.current = Boolean(d.titleTouched);
      if (d.chapterQuizSel && typeof d.chapterQuizSel === "object") setChapterQuizSel(d.chapterQuizSel);
      if (d.conceptFocusSel && typeof d.conceptFocusSel === "object") setConceptFocusSel(d.conceptFocusSel);
      if (typeof d.gyanTopicFocus === "string") setGyanTopicFocus(d.gyanTopicFocus);
      if (typeof d.gyanSubtopicHint === "string") setGyanSubtopicHint(d.gyanSubtopicHint);
      if (d.selectedMockPaperId === null || typeof d.selectedMockPaperId === "string")
        setSelectedMockPaperId(d.selectedMockPaperId);
      if (cid && props.classrooms.some((c) => c.id === cid)) setClassroomId(cid);
      if (d.scope === "full" || d.scope === "section" || d.scope === "students") setScope(d.scope);
      if (d.sectionId === null || typeof d.sectionId === "string") setSectionId(d.sectionId);
      if (Array.isArray(d.studentIds)) setStudentIds(d.studentIds.filter((x): x is string => typeof x === "string"));
      if (typeof d.studentSearch === "string") setStudentSearch(d.studentSearch);
      if (typeof d.dueDate === "string") setDueDate(d.dueDate);
      if (typeof d.rewardRdm === "number" && Number.isFinite(d.rewardRdm)) setRewardRdm(d.rewardRdm);
      if (typeof d.instructions === "string") setInstructions(d.instructions);
    } catch {
      // ignore corrupt draft
    }
  }, [props.sessionDraftKey, props.variant, props.classrooms]);

  useEffect(() => {
    const key = props.sessionDraftKey;
    if (!key || props.variant !== "embedded") return;
    const payload: EmbeddedAssignmentDraftV1 = {
      v: 1,
      step,
      typeKey,
      title,
      titleTouched: titleTouchedRef.current,
      chapterQuizSel,
      conceptFocusSel,
      gyanTopicFocus,
      gyanSubtopicHint,
      selectedMockPaperId,
      classroomId,
      scope,
      sectionId,
      studentIds,
      studentSearch,
      dueDate,
      rewardRdm,
      instructions,
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
    props.sessionDraftKey,
    props.variant,
    step,
    typeKey,
    title,
    chapterQuizSel,
    conceptFocusSel,
    gyanTopicFocus,
    gyanSubtopicHint,
    selectedMockPaperId,
    classroomId,
    scope,
    sectionId,
    studentIds,
    studentSearch,
    dueDate,
    rewardRdm,
    instructions,
  ]);

  useEffect(() => {
    const base = meta.assignmentTypeLabel;
    setTitle((prev) => {
      const prevTrim = prev.trim();
      const lastAuto = lastAutoTitleRef.current.trim();
      const shouldAutoUpdate = !titleTouchedRef.current || !prevTrim || (lastAuto && prevTrim === lastAuto);
      if (!shouldAutoUpdate) return prev;
      lastAutoTitleRef.current = base;
      return base;
    });
  }, [meta.assignmentTypeLabel]);

  useEffect(() => {
    if (typeKey !== "mock") return;
    let cancelled = false;
    const run = async () => {
      setMockPapersLoading(true);
      setMockPapersError(null);
      try {
        const rows = await fetchMockPapersFromSupabase();
        if (cancelled) return;
        setMockPapers(rows);
        if (!selectedMockPaperId && rows.length) setSelectedMockPaperId(rows[0].id);
      } catch (e) {
        if (!cancelled) setMockPapersError(e instanceof Error ? e.message : "Could not load mock papers.");
      } finally {
        if (!cancelled) setMockPapersLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typeKey]);

  const steps = useMemo(
    () => [
      { id: 1, label: "Type & Topic" },
      { id: 2, label: "Configure" },
      { id: 3, label: "Assign To" },
      { id: 4, label: "Due Date & Publish" },
    ],
    []
  );

  const canContinueStep2 = useMemo(() => {
    if (typeKey === "quiz") return chapterQuizSelectionComplete(chapterQuizSel, taxonomy);
    if (typeKey === "concept_focus") return conceptFocusSelectionComplete(conceptFocusSel, taxonomy);
    if (typeKey === "gyan") return true;
    if (typeKey === "mock") return !mockPapersLoading && (mockPapers.length === 0 || Boolean(selectedMockPaperId));
    return true;
  }, [
    chapterQuizSel,
    conceptFocusSel,
    mockPapers.length,
    mockPapersLoading,
    selectedMockPaperId,
    taxonomy,
    typeKey,
  ]);

  const canContinueStep3 = useMemo(() => {
    if (!classroomId) return false;
    if (scope === "section") return Boolean(sectionId);
    if (scope === "students") return studentIds.length > 0;
    return true;
  }, [classroomId, scope, sectionId, studentIds.length]);

  const assignToLabel = useMemo(() => {
    if (scope === "full") return "All students";
    if (scope === "section") {
      const s = detail?.sections.find((x) => x.id === sectionId)?.name ?? "Section";
      return `Section: ${s}`;
    }
    return `Custom (${studentIds.length})`;
  }, [detail?.sections, scope, sectionId, studentIds.length]);

  const selectedMock = useMemo(() => mockPapers.find((p) => p.id === selectedMockPaperId) ?? null, [
    mockPapers,
    selectedMockPaperId,
  ]);

  const chapterQuizRef: TeacherPortalChapterQuizRef | null = useMemo(() => {
    if (typeKey === "quiz") return chapterQuizToRef(chapterQuizSel, taxonomy);
    if (typeKey === "concept_focus") {
      return chapterQuizToRef(
        {
          ...(conceptFocusSel as unknown as ChapterQuizSelectionState),
          level: "advanced",
          advancedSet: 1,
        },
        taxonomy
      );
    }
    return null;
  }, [chapterQuizSel, conceptFocusSel, taxonomy, typeKey]);

  const gyanEngagement: TeacherPortalGyanEngagementRef | null =
    typeKey === "gyan"
      ? { topicFocus: gyanTopicFocus.trim(), subtopicHint: gyanSubtopicHint.trim() }
      : null;

  const tasks = useMemo(() => {
    // Important: use the human-facing label to generate default tasks (same as `MyClassroomView.tsx`),
    // because derivedType for Gyan++ is `assignment`.
    return normalizeTaskPositions(buildDefaultTasksForAssignmentType(meta.assignmentTypeLabel));
  }, [meta.assignmentTypeLabel]);

  const publish = async () => {
    if (!classroomId || !title.trim()) return;
    setPublishing(true);
    try {
      const mockPaper: TeacherPortalMockPaperRef | null =
        typeKey === "mock" && selectedMock
          ? {
              id: selectedMock.id,
              slug: (selectedMock.slug ?? selectedMock.id).trim(),
              title: selectedMock.title.trim(),
            }
          : null;
      await props.onPublish({
        classroomId,
        sectionId: scope === "section" ? sectionId : null,
        assignmentType: meta.derivedType,
        title: title.trim(),
        dueDate: dueDate.trim() || null,
        assignToLabel,
        targetStudentIds: scope === "students" ? studentIds : null,
        rewardRdm,
        instructions,
        tasks,
        mockPaper: meta.derivedType === "mock" ? mockPaper : null,
        chapterQuiz: meta.derivedType === "quiz" || meta.derivedType === "Concept Focus" ? chapterQuizRef : null,
        gyanEngagement,
      });
      if (props.sessionDraftKey) {
        try {
          sessionStorage.removeItem(props.sessionDraftKey);
        } catch {
          // ignore
        }
      }
    } finally {
      setPublishing(false);
    }
  };

  const filteredStudents = useMemo(() => {
    const rows = detail?.students ?? [];
    const q = studentSearch.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((s) => s.name.toLowerCase().includes(q));
  }, [detail?.students, studentSearch]);

  return (
    <div className={variant === "embedded" ? "w-full max-w-none" : "mx-auto max-w-5xl"}>
      {variant === "page" ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 sm:px-5">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                Create an assignment
              </div>
              <div className="mt-1 truncate font-serif text-xl text-slate-50 sm:text-2xl">
                {meta.label}
              </div>
              <div className="mt-0.5 text-xs text-slate-400">{meta.subtitle}</div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
                disabled={step === 1}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 enabled:hover:bg-white/[0.06] disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  if (step === 1) setStep(2);
                  else if (step === 2 && canContinueStep2) setStep(3);
                  else if (step === 3 && canContinueStep3) setStep(4);
                }}
                disabled={step === 2 ? !canContinueStep2 : step === 3 ? !canContinueStep3 : step === 4}
                className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 enabled:hover:bg-emerald-500/20 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b1020] p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold text-slate-300">Progress</div>
              <div className="text-xs font-semibold text-emerald-200">Step {step} of 4</div>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/5">
              <div className="h-full bg-emerald-400/70" style={{ width: `${(step / 4) * 100}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {steps.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id as 1 | 2 | 3 | 4)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${pill(step === s.id)}`}
                >
                  {s.id}. {s.label}
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-white/10 bg-[#0b1020] p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-slate-500">
                Create an assignment
              </div>
              <div className="mt-0.5 truncate text-sm font-semibold text-slate-100 sm:text-base">
                {meta.label}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3 | 4) : s))}
                disabled={step === 1}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-200 enabled:hover:bg-white/[0.06] disabled:opacity-50"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => {
                  if (step === 1) setStep(2);
                  else if (step === 2 && canContinueStep2) setStep(3);
                  else if (step === 3 && canContinueStep3) setStep(4);
                }}
                disabled={step === 2 ? !canContinueStep2 : step === 3 ? !canContinueStep3 : step === 4}
                className="rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-100 enabled:hover:bg-emerald-500/20 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {steps.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStep(s.id as 1 | 2 | 3 | 4)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${pill(step === s.id)}`}
                >
                  {s.id}. {s.label}
                </button>
              ))}
            </div>
            <div className="hidden text-xs font-semibold text-emerald-200 sm:block">
              Step {step} of 4
            </div>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-white/5">
            <div className="h-full bg-emerald-400/70" style={{ width: `${(step / 4) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-white/10 bg-[#0b1020] p-4 sm:p-5">
        <div className="mb-4">
          <div className="text-sm font-semibold text-slate-100">Step {step} — {sectionTitle(step)}</div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            Build a quiz, mock, or engagement challenge and assign it in 4 steps.
          </div>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {(Object.keys(TYPE_META) as WizardTypeKey[]).map((k) => {
                const t = TYPE_META[k];
                const active = k === typeKey;
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setTypeKey(k)}
                    className={`rounded-2xl border p-4 text-left transition ${
                      active
                        ? "border-emerald-400/40 bg-emerald-500/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100">{t.label}</div>
                        <div className="mt-1 text-xs text-slate-400">{t.subtitle}</div>
                      </div>
                      {active ? (
                        <div className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-400/40 bg-emerald-500/15 text-emerald-100">
                          <Check className="h-4 w-4" />
                        </div>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-300">Topic / title *</label>
              <input
                value={title}
                onChange={(e) => {
                  titleTouchedRef.current = true;
                  setTitle(e.target.value);
                }}
                placeholder="e.g. Electrostatics — Gauss’s Law Chapter Quiz"
                className="w-full rounded-xl border border-white/10 bg-[#070b17] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            {typeKey === "quiz" ? (
              <ChapterQuizAssignmentFields
                taxonomy={taxonomy}
                taxonomyLoading={taxonomyLoading}
                taxonomyError={taxonomyError}
                value={chapterQuizSel}
                onChange={setChapterQuizSel}
                selectClassName="w-full appearance-none rounded-xl border border-white/15 bg-[#070b17] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
              />
            ) : typeKey === "concept_focus" ? (
              <ConceptFocusAssignmentFields
                taxonomy={taxonomy}
                taxonomyLoading={taxonomyLoading}
                taxonomyError={taxonomyError}
                value={conceptFocusSel}
                onChange={setConceptFocusSel}
                selectClassName="w-full appearance-none rounded-xl border border-white/15 bg-[#070b17] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
              />
            ) : typeKey === "gyan" ? (
              <GyanEngagementAssignmentFields
                topicFocus={gyanTopicFocus}
                subtopicHint={gyanSubtopicHint}
                onTopicFocusChange={setGyanTopicFocus}
                onSubtopicHintChange={setGyanSubtopicHint}
              />
            ) : (
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">Mock paper *</label>
                {mockPapersLoading ? (
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#070b17] px-3 py-3 text-sm text-slate-400">
                    <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-300" />
                    Loading published mock papers…
                  </div>
                ) : mockPapersError ? (
                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {mockPapersError}
                  </div>
                ) : mockPapers.length === 0 ? (
                  <div className="rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/90">
                    No published mock papers in the bank yet.
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedMockPaperId ?? ""}
                      onChange={(e) => setSelectedMockPaperId(e.target.value || null)}
                      className="w-full appearance-none rounded-xl border border-white/15 bg-[#070b17] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
                    >
                      {mockPapers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} · {p.durationMinutes} min · Class {p.classLevel}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-300">Classroom *</label>
              <div className="relative">
                <select
                  value={classroomId}
                  onChange={(e) => {
                    setClassroomId(e.target.value);
                    setSectionId(null);
                    setStudentIds([]);
                  }}
                  className="w-full appearance-none rounded-xl border border-white/15 bg-[#070b17] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
                >
                  {props.classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.studentCount} students)
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setScope("full")}
                className={`rounded-2xl border p-4 text-left ${scope === "full" ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
              >
                <div className="text-sm font-semibold text-slate-100">Full classroom</div>
                <div className="mt-1 text-xs text-slate-400">All students</div>
              </button>
              <button
                type="button"
                onClick={() => setScope("section")}
                className={`rounded-2xl border p-4 text-left ${scope === "section" ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
              >
                <div className="text-sm font-semibold text-slate-100">Section only</div>
                <div className="mt-1 text-xs text-slate-400">Choose a section</div>
              </button>
              <button
                type="button"
                onClick={() => setScope("students")}
                className={`rounded-2xl border p-4 text-left ${scope === "students" ? "border-emerald-400/40 bg-emerald-500/10" : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"}`}
              >
                <div className="text-sm font-semibold text-slate-100">Specific students</div>
                <div className="mt-1 text-xs text-slate-400">Pick by name</div>
              </button>
            </div>

            {scope === "section" ? (
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">Section *</label>
                <div className="relative">
                  <select
                    value={sectionId ?? ""}
                    onChange={(e) => setSectionId(e.target.value || null)}
                    className="w-full appearance-none rounded-xl border border-white/15 bg-[#070b17] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  >
                    <option value="">Select section…</option>
                    {activeSections.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
            ) : null}

            {scope === "students" ? (
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-300">Students *</label>
                  <input
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                    placeholder="Search students…"
                    className="w-full rounded-xl border border-white/10 bg-[#070b17] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
                  />
                </div>
                <div className="max-h-[320px] overflow-y-auto rounded-xl border border-white/10 bg-white/[0.02] p-2">
                  {filteredStudents.map((s) => {
                    const checked = studentIds.includes(s.userId);
                    return (
                      <label
                        key={s.userId}
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${checked ? "bg-emerald-500/10" : "hover:bg-white/[0.04]"}`}
                      >
                        <div className="min-w-0">
                          <div className="truncate font-medium text-slate-100">{s.name}</div>
                          <div className="text-xs text-slate-500">
                            {s.sectionId ? "Section member" : "Unassigned"}
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked;
                            setStudentIds((prev) =>
                              next ? [...prev, s.userId] : prev.filter((id) => id !== s.userId)
                            );
                          }}
                          className="h-4 w-4 accent-emerald-400"
                        />
                      </label>
                    );
                  })}
                  {filteredStudents.length === 0 ? (
                    <div className="px-3 py-6 text-center text-sm text-slate-400">No students found.</div>
                  ) : null}
                </div>
                <div className="text-xs text-slate-400">Selected: {studentIds.length}</div>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">Due date</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#070b17] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400/60"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">RDM reward</label>
                <div className="relative">
                  <select
                    value={String(rewardRdm)}
                    onChange={(e) => setRewardRdm(Number(e.target.value))}
                    className="w-full appearance-none rounded-xl border border-white/15 bg-[#070b17] px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-400"
                  >
                    <option value="10">+10 RDM</option>
                    <option value="15">+15 RDM (standard)</option>
                    <option value="25">+25 RDM</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-300">
                Instructions for students (optional)
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={5}
                placeholder="Add context, hints, or specific instructions for students taking this assignment…"
                className="w-full rounded-xl border border-white/10 bg-[#070b17] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/60"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-100">Ready to publish</div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {assignToLabel} · Reward {rewardRdm} RDM {dueDate ? `· Due ${dueDate}` : "· No due date"}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void publish()}
                disabled={publishing || !classroomId || !title.trim() || (step === 4 && !canContinueStep3)}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-100 enabled:hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Publish assignment
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

