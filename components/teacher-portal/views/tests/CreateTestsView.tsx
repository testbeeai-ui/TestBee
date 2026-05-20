"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Code2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Subject } from "@/types";
import type { AssignmentTaskStored } from "@/lib/classroom/assignmentTasks";
import type { Json } from "@/integrations/supabase/types";
import {
  collectCreateTestTopicMatchPhrases,
  collectUnitTopicTitles,
  fetchCurriculumHierarchyFromSupabase,
  type CurriculumHierarchyUnit,
} from "@/lib/curriculum/curriculumService";
import { countQuestionBankForCreateTest } from "@/lib/play/quiz/countQuestionBankForCreateTest";
import { fetchTeacherTestBankRows } from "@/lib/play/quiz/fetchTeacherTestBankRows";
import { buildTeacherTestQuestionSet } from "@/lib/play/quiz/buildTeacherTestQuestionSet";
import type { GeneratedTeacherTest } from "@/lib/teacherPortal/generatedTest";
import GeneratedTestPreview from "@/components/teacher-portal/views/tests/GeneratedTestPreview";
import { openTeacherTestPrintPreview } from "@/lib/teacherPortal/openTeacherTestPrintPreview";
import { saveTestHistory } from "@/lib/teacherPortal/saveTestHistory";
import { fetchTestHistory, type TestHistoryItem } from "@/lib/teacherPortal/fetchTestHistory";
import type { TeacherPortalClassroomCard } from "@/lib/teacherPortal/types";
import {
  chargeTeacherRdm,
  refundTeacherRdm,
  TeacherRdmInsufficientError,
} from "@/lib/teacherPortal/rdmCharges";
import { useTeacherRdmCosts } from "@/hooks/TeacherRdmCostsContext";

/** Only CBSE is available in the wizard today; KCET / JEE Main are surfaced as “Coming soon”. */
type ExamType = "CBSE Board";
type ClassLevel = "Class 11 (PUC 1)" | "Class 12 (PUC 2)";
type TestScope = "Topic-wise" | "Unit-wise";
type QuestionSource = "Created by AI" | "From Question Bank";

function compositeChapterId(unitId: string, chapterId: string): string {
  return `${unitId}__${chapterId}`;
}

function displayLabelToSubject(label: string): Subject | null {
  const m: Record<string, Subject> = {
    Physics: "physics",
    Chemistry: "chemistry",
    Mathematics: "math",
  };
  return m[label] ?? null;
}

function flattenChapters(
  units: CurriculumHierarchyUnit[]
): { compositeId: string; label: string }[] {
  const out: { compositeId: string; label: string }[] = [];
  for (const u of units) {
    const unitHead = u.unit_title || u.unit_label;
    for (const ch of u.chapters) {
      out.push({
        compositeId: compositeChapterId(u.id, ch.id),
        label: `${unitHead} — ${ch.title}`,
      });
    }
  }
  return out;
}

function getChaptersForUnit(units: CurriculumHierarchyUnit[], unitId: string) {
  return units.find((x) => x.id === unitId)?.chapters ?? [];
}

function findChapterTitleOnly(units: CurriculumHierarchyUnit[], compositeId: string): string {
  const sep = "__";
  const i = compositeId.indexOf(sep);
  if (i < 0) return "";
  const unitId = compositeId.slice(0, i);
  const cId = compositeId.slice(i + sep.length);
  const u = units.find((x) => x.id === unitId);
  return u?.chapters.find((c) => c.id === cId)?.title ?? "";
}

function getTopicsForComposite(
  units: CurriculumHierarchyUnit[],
  compositeId: string
): { id: string; title: string }[] {
  const sep = "__";
  const i = compositeId.indexOf(sep);
  if (i < 0) return [];
  const unitId = compositeId.slice(0, i);
  const chapterId = compositeId.slice(i + sep.length);
  const unit = units.find((x) => x.id === unitId);
  const ch = unit?.chapters.find((c) => c.id === chapterId);
  return ch?.topics ?? [];
}

function findChapterFlatLabel(units: CurriculumHierarchyUnit[], compositeId: string): string {
  if (!compositeId) return "—";
  return flattenChapters(units).find((f) => f.compositeId === compositeId)?.label ?? compositeId;
}

function findUnitLabel(units: CurriculumHierarchyUnit[], unitId: string): string {
  if (!unitId) return "—";
  const u = units.find((x) => x.id === unitId);
  if (!u) return unitId;
  return u.unit_title || u.unit_label;
}

function findTopicTitle(
  units: CurriculumHierarchyUnit[],
  chapterCompositeId: string,
  topicId: string
): string {
  if (!topicId) return "—";
  return (
    getTopicsForComposite(units, chapterCompositeId).find((t) => t.id === topicId)?.title ?? "—"
  );
}

function firstDefaultsFromUnits(
  units: CurriculumHierarchyUnit[],
  scope: TestScope
): { unitId: string; chapterCompositeId: string; topicId: string } {
  const flat = flattenChapters(units);
  const u0 = units[0];
  if (scope === "Unit-wise" && u0) {
    const c0 = u0.chapters[0];
    const cid = c0 ? compositeChapterId(u0.id, c0.id) : "";
    const tops = cid ? getTopicsForComposite(units, cid) : [];
    return { unitId: u0.id, chapterCompositeId: cid, topicId: tops[0]?.id ?? "" };
  }
  if (!flat[0]) return { unitId: u0?.id ?? "", chapterCompositeId: "", topicId: "" };
  const cid = flat[0].compositeId;
  const tops = getTopicsForComposite(units, cid);
  if (scope === "Topic-wise") {
    return { unitId: u0?.id ?? "", chapterCompositeId: cid, topicId: tops[0]?.id ?? "" };
  }
  const sep = "__";
  const i = cid.indexOf(sep);
  return {
    unitId: i >= 0 ? cid.slice(0, i) : "",
    chapterCompositeId: cid,
    topicId: tops[0]?.id ?? "",
  };
}

const stepLabels = ["Exam Type", "Class & Scope", "Questions", "Source & Duration", "Generate"];

const QUESTION_PRESETS = [10, 20, 30, 40] as const;

const DURATION_CHOICES = [15, 30, 45, 60, 90, 120, 180] as const;

/** Roughly ~2 min per MCQ, snapped up to the next standard slot (for hints only). */
function suggestedDurationMinutes(questionCount: number): number {
  if (questionCount <= 0) return 60;
  const target = Math.ceil(questionCount * 2);
  const found = DURATION_CHOICES.find((d) => d >= target);
  return found ?? 180;
}

/** Presets that fit in the bank; if bank is 1–9, returns `[bank]` only. When bank is 0 or null, returns full presets for display (disabled). */
function selectableQuestionCounts(bank: number | null): number[] {
  if (bank === null || bank <= 0) return [...QUESTION_PRESETS];
  const fromPresets = QUESTION_PRESETS.filter((n) => n <= bank);
  if (fromPresets.length > 0) return [...fromPresets];
  return [bank];
}

function cappedTestQuestionCount(selected: number, bank: number | null): number {
  if (bank === null) return selected;
  if (bank <= 0) return 0;
  return Math.min(selected, bank);
}

type CreateTestsViewProps = {
  /** Teacher Wizard embed: tighter layout, no duplicate page chrome, hide history block below fold. */
  embedded?: boolean;
  /** Teacher Wizard: keep left/right step in sync. */
  externalStep?: 1 | 2 | 3 | 4 | 5;
  onStepChange?: (step: 1 | 2 | 3 | 4 | 5) => void;
  onNavigateToSection?: (section: "myClassroom") => void;
  teacherId?: string;
  classrooms?: TeacherPortalClassroomCard[];
  onCreateAssignment?: (input: {
    teacherId: string;
    classroomId: string;
    assignmentType: string;
    title: string;
    dueDate: string | null;
    assignToLabel: string;
    rewardRdm: number;
    instructions: string;
    tasks?: AssignmentTaskStored[];
    extraContentJson?: Record<string, Json> | null;
  }) => Promise<{ id: string }>;
  onRequireVerifiedAction?: (actionLabel: string) => Promise<boolean>;
};

export default function CreateTestsView({
  embedded = false,
  externalStep,
  onStepChange,
  onNavigateToSection,
  teacherId,
  classrooms = [],
  onCreateAssignment,
  onRequireVerifiedAction,
}: CreateTestsViewProps) {
  const { costs: teacherRdmCosts, refresh: refreshTeacherRdmCosts } = useTeacherRdmCosts();
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  useEffect(() => {
    if (!externalStep) return;
    if (externalStep === step) return;
    setStep(externalStep);
  }, [externalStep, step]);

  const setStepSynced = (next: 1 | 2 | 3 | 4 | 5) => {
    setStep(next);
    onStepChange?.(next);
  };
  const [examType] = useState<ExamType>("CBSE Board");
  const [classLevel, setClassLevel] = useState<ClassLevel>("Class 11 (PUC 1)");
  const [scope, setScope] = useState<TestScope>("Topic-wise");
  const [chapterId, setChapterId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  /** Selected syllabus topic when scope is Topic-wise or Unit-wise (single choice). */
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [subject, setSubject] = useState("Physics");
  const [curriculumUnits, setCurriculumUnits] = useState<CurriculumHierarchyUnit[]>([]);
  const [curriculumLoading, setCurriculumLoading] = useState(false);
  const [curriculumError, setCurriculumError] = useState<string | null>(null);
  const [questionBankCount, setQuestionBankCount] = useState<number | null>(null);
  const [questionBankRawCount, setQuestionBankRawCount] = useState<number | null>(null);
  const [questionBankUsedCount, setQuestionBankUsedCount] = useState<number | null>(null);
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionBankError, setQuestionBankError] = useState<string | null>(null);
  /** User-chosen test size; capped by {@link questionBankCount} when using the bank. */
  const [testQuestionCount, setTestQuestionCount] = useState(20);
  const [questionCountDraft, setQuestionCountDraft] = useState("20");
  const [source] = useState<QuestionSource>("From Question Bank");
  /** Must be chosen explicitly on step 4 (required). */
  const [duration, setDuration] = useState<number | null>(null);
  const [testName, setTestName] = useState("");
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [generatedTest, setGeneratedTest] = useState<GeneratedTeacherTest | null>(null);
  const [createPdfLoading, setCreatePdfLoading] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignClassroomId, setAssignClassroomId] = useState("");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignInstructions, setAssignInstructions] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assignSuccess, setAssignSuccess] = useState<string | null>(null);
  const [testHistory, setTestHistory] = useState<TestHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const primarySubject = useMemo(() => displayLabelToSubject(subject) ?? "physics", [subject]);
  const classNumeric = useMemo(() => (classLevel.includes("11") ? 11 : 12), [classLevel]);

  useEffect(() => {
    let cancelled = false;
    setCurriculumLoading(true);
    setCurriculumError(null);
    void fetchCurriculumHierarchyFromSupabase(primarySubject, classNumeric).then((units) => {
      if (cancelled) return;
      setCurriculumLoading(false);
      if (units === null) {
        setCurriculumUnits([]);
        setSelectedUnitId("");
        setChapterId("");
        setSelectedTopicId("");
        setCurriculumError("Could not load curriculum. Check your connection and try again.");
        return;
      }
      setCurriculumUnits(units);
      if (units.length === 0) {
        setSelectedUnitId("");
        setChapterId("");
        setSelectedTopicId("");
        setCurriculumError("No curriculum found for this class and subject in the database.");
      } else {
        setCurriculumError(null);
        const d = firstDefaultsFromUnits(units, scope);
        setSelectedUnitId(d.unitId);
        setChapterId(d.chapterCompositeId);
        setSelectedTopicId(d.topicId);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [primarySubject, classNumeric, scope]);

  useEffect(() => {
    if (!curriculumUnits.length) return;
    const d = firstDefaultsFromUnits(curriculumUnits, scope);
    setSelectedUnitId(d.unitId);
    setChapterId(d.chapterCompositeId);
    setSelectedTopicId(d.topicId);
  }, [scope, curriculumUnits]);

  useEffect(() => {
    const tops = getTopicsForComposite(curriculumUnits, chapterId);
    setSelectedTopicId((prev) => {
      if (tops.some((t) => t.id === prev)) return prev;
      return tops[0]?.id ?? "";
    });
  }, [chapterId, scope, curriculumUnits]);

  useEffect(() => {
    let cancelled = false;
    if (step !== 3) return;
    if (!curriculumUnits.length) {
      setQuestionBankCount(null);
      setQuestionBankError(null);
      setQuestionBankLoading(false);
      return;
    }
    if (scope === "Unit-wise" ? !selectedUnitId : !chapterId) {
      setQuestionBankCount(null);
      setQuestionBankError(null);
      setQuestionBankLoading(false);
      return;
    }
    const topicTitles =
      scope === "Unit-wise"
        ? collectUnitTopicTitles(curriculumUnits, selectedUnitId)
        : collectCreateTestTopicMatchPhrases(curriculumUnits, chapterId, selectedTopicId);

    if (topicTitles.length === 0) {
      setQuestionBankLoading(false);
      setQuestionBankCount(0);
      setQuestionBankError(null);
      return;
    }

    const match =
      scope === "Unit-wise"
        ? { scope: "Unit-wise" as const, topicTitles }
        : {
            scope: "Topic-wise" as const,
            topicTitles,
            chapterTitle: findChapterTitleOnly(curriculumUnits, chapterId),
          };
    setQuestionBankLoading(true);
    setQuestionBankError(null);
    void countQuestionBankForCreateTest({
      subject: primarySubject,
      classLevel: classNumeric as 11 | 12,
      match,
    }).then(({ count, rawCount, usedCount, error }) => {
      if (cancelled) return;
      setQuestionBankLoading(false);
      if (error) {
        setQuestionBankCount(null);
        setQuestionBankRawCount(null);
        setQuestionBankUsedCount(null);
        setQuestionBankError(error);
        return;
      }
      setQuestionBankCount(count);
      setQuestionBankRawCount(rawCount ?? count);
      setQuestionBankUsedCount(usedCount ?? 0);
      setQuestionBankError(null);
    });
    return () => {
      cancelled = true;
    };
  }, [
    step,
    chapterId,
    classNumeric,
    curriculumUnits,
    primarySubject,
    scope,
    selectedTopicId,
    selectedUnitId,
  ]);

  useEffect(() => {
    if (questionBankCount === null) return;
    if (questionBankCount === 0) {
      setTestQuestionCount(QUESTION_PRESETS[0]);
      return;
    }
    const choices = selectableQuestionCounts(questionBankCount);
    setTestQuestionCount((prev) => {
      if (choices.includes(prev)) return prev;
      return choices[choices.length - 1] ?? QUESTION_PRESETS[0];
    });
  }, [questionBankCount]);

  const effectiveTestQuestionCount = useMemo(
    () => cappedTestQuestionCount(testQuestionCount, questionBankCount),
    [testQuestionCount, questionBankCount]
  );

  const suggestedDuration = useMemo(
    () => suggestedDurationMinutes(effectiveTestQuestionCount),
    [effectiveTestQuestionCount]
  );

  useEffect(() => {
    setQuestionCountDraft(String(testQuestionCount));
  }, [testQuestionCount]);

  const applyCustomQuestionCount = () => {
    const bank = questionBankCount;
    const parsed = Number.parseInt(questionCountDraft.trim(), 10);
    if (!Number.isFinite(parsed) || bank === null || bank <= 0) return;
    const clamped = Math.min(Math.max(1, parsed), bank);
    setTestQuestionCount(clamped);
    setQuestionCountDraft(String(clamped));
  };

  const currentMatch = useMemo(() => {
    const topicTitles =
      scope === "Unit-wise"
        ? collectUnitTopicTitles(curriculumUnits, selectedUnitId)
        : collectCreateTestTopicMatchPhrases(curriculumUnits, chapterId, selectedTopicId);
    if (topicTitles.length === 0) return null;
    if (scope === "Unit-wise") {
      return { scope: "Unit-wise" as const, topicTitles };
    }
    return {
      scope: "Topic-wise" as const,
      topicTitles,
      chapterTitle: findChapterTitleOnly(curriculumUnits, chapterId),
    };
  }, [chapterId, curriculumUnits, scope, selectedTopicId, selectedUnitId]);

  const scopeDetails = useMemo(() => {
    if (scope === "Unit-wise") {
      return [
        `Unit: ${findUnitLabel(curriculumUnits, selectedUnitId)}`,
        `Chapter: ${findChapterFlatLabel(curriculumUnits, chapterId)}`,
        `Topic: ${findTopicTitle(curriculumUnits, chapterId, selectedTopicId)}`,
      ];
    }
    return [
      `Chapter: ${findChapterFlatLabel(curriculumUnits, chapterId)}`,
      `Topic: ${findTopicTitle(curriculumUnits, chapterId, selectedTopicId)}`,
    ];
  }, [chapterId, curriculumUnits, scope, selectedTopicId, selectedUnitId]);

  const flatChapters = useMemo(() => flattenChapters(curriculumUnits), [curriculumUnits]);
  const unitsForClass = curriculumUnits;
  const chaptersInSelectedUnit = useMemo(
    () => getChaptersForUnit(curriculumUnits, selectedUnitId),
    [curriculumUnits, selectedUnitId]
  );
  const topicsForSelectedChapter = useMemo(
    () => getTopicsForComposite(curriculumUnits, chapterId),
    [curriculumUnits, chapterId]
  );
  const canProceedStep3 =
    !questionBankLoading && questionBankError === null && questionBankCount !== null;

  const canProceedStep4 = duration !== null;
  const canProceedStep2 =
    !curriculumLoading &&
    flatChapters.length > 0 &&
    Boolean(chapterId) &&
    (topicsForSelectedChapter.length === 0 || Boolean(selectedTopicId)) &&
    (scope !== "Unit-wise" || Boolean(selectedUnitId));

  const canGenerateNow =
    duration !== null &&
    currentMatch !== null &&
    questionBankCount !== null &&
    effectiveTestQuestionCount > 0;
  const canAssignToClassroom = Boolean(teacherId && onCreateAssignment && classrooms.length > 0);

  useEffect(() => {
    setAssignClassroomId((prev) => {
      if (prev && classrooms.some((c) => c.id === prev)) return prev;
      return classrooms[0]?.id ?? "";
    });
  }, [classrooms]);

  // Load test history on mount and when subject changes
  useEffect(() => {
    let cancelled = false;
    setHistoryLoading(true);
    void fetchTestHistory({ subject: primarySubject, limit: 20 }).then(({ history, error }) => {
      if (cancelled) return;
      setHistoryLoading(false);
      if (error) {
        console.error("Failed to load test history:", error);
        return;
      }
      setTestHistory(history);
    });
    return () => {
      cancelled = true;
    };
  }, [primarySubject]);

  const handleGenerateTestNow = async () => {
    if (!canGenerateNow || !currentMatch || duration === null) return;
    if (onRequireVerifiedAction) {
      const allowed = await onRequireVerifiedAction("Generate test");
      if (!allowed) return;
    }
    setGenerateLoading(true);
    setGenerateError(null);
    try {
      await chargeTeacherRdm("generate_test", teacherRdmCosts);
    } catch (e) {
      setGenerateLoading(false);
      setGenerateError(
        e instanceof TeacherRdmInsufficientError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not charge RDM for test generation."
      );
      return;
    }

    const rowsResult = await fetchTeacherTestBankRows({
      subject: primarySubject,
      classLevel: classNumeric as 11 | 12,
      match: currentMatch,
    });
    if (!rowsResult.data || rowsResult.error) {
      await refundTeacherRdm("generate_test", teacherRdmCosts).catch(() => {});
      setGenerateLoading(false);
      setGenerateError(rowsResult.error ?? "Could not load questions from question bank.");
      return;
    }

    const built = buildTeacherTestQuestionSet(rowsResult.data.rows, effectiveTestQuestionCount);
    if (built.picked <= 0) {
      await refundTeacherRdm("generate_test", teacherRdmCosts).catch(() => {});
      setGenerateLoading(false);
      setGenerateError("No valid MCQs were found for this scope.");
      return;
    }

    const generatedTestData: GeneratedTeacherTest = {
      id: `teacher-test-${classNumeric}-${primarySubject}-${built.picked}-${built.bucketCount}`,
      name: computedTestName,
      examType,
      board: "CBSE Board",
      classLevelLabel: classLevel,
      classLevelNumeric: classNumeric as 11 | 12,
      subjectLabel: subject,
      sourceLabel: "Question bank",
      scopeLabel: scope,
      scopeDetails,
      durationMinutes: duration,
      requestedCount: built.requested,
      pickedCount: built.picked,
      bankAvailable: questionBankCount,
      classLevelUsed: rowsResult.data.classLevelUsed,
      generatedAtIso: new Date().toISOString(),
      questions: built.questions,
    };

    setGeneratedTest(generatedTestData);
    setGenerateLoading(false);
    void refreshTeacherRdmCosts();

    // Save to history
    const topicTitle =
      scope === "Topic-wise"
        ? getTopicsForComposite(curriculumUnits, chapterId).find((t) => t.id === selectedTopicId)
            ?.title
        : null;
    const unitTitle = scope === "Unit-wise" ? findUnitLabel(curriculumUnits, selectedUnitId) : null;

    void saveTestHistory({
      board: "CBSE",
      classLevel: classNumeric as 11 | 12,
      subject: primarySubject,
      scope,
      chapterTitle:
        scope === "Topic-wise" ? findChapterTitleOnly(curriculumUnits, chapterId) : null,
      topicTitle: topicTitle || null,
      unitTitle: unitTitle || null,
      questions: built.questions,
      questionCount: built.picked,
      durationMinutes: duration,
      usedQuestionStems: built.questions.map((q) => q.question.trim().toLowerCase()),
    }).then(({ error }) => {
      if (error) {
        console.error("Failed to save test history:", error);
        return;
      }
      // Refresh history list
      void fetchTestHistory({ subject: primarySubject, limit: 20 }).then(({ history }) => {
        setTestHistory(history);
      });
    });
  };

  const handleCreatePdf = async () => {
    if (!generatedTest || createPdfLoading) return;
    setCreatePdfLoading(true);
    setGenerateError(null);
    try {
      await openTeacherTestPrintPreview(generatedTest);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create PDF.";
      setGenerateError(message);
    } finally {
      setCreatePdfLoading(false);
    }
  };

  const openAssignDialog = () => {
    if (onRequireVerifiedAction) {
      void onRequireVerifiedAction("Assign test").then((allowed) => {
        if (!allowed) return;
        setAssignError(null);
        setAssignSuccess(null);
        if (!canAssignToClassroom) {
          setGenerateError(
            "Assignment flow is unavailable. Please open My Classroom and create from there."
          );
          return;
        }
        if (!generatedTest) return;
        setAssignInstructions(
          "Read each question carefully. Submit once when finished. Review correct answers after submission to learn from mistakes."
        );
        setAssignDueDate("");
        setAssignDialogOpen(true);
      });
      return;
    }
    setAssignError(null);
    setAssignSuccess(null);
    if (!canAssignToClassroom) {
      setGenerateError(
        "Assignment flow is unavailable. Please open My Classroom and create from there."
      );
      return;
    }
    if (!generatedTest) return;
    setAssignInstructions(
      "Read each question carefully. Submit once when finished. Review correct answers after submission to learn from mistakes."
    );
    setAssignDueDate("");
    setAssignDialogOpen(true);
  };

  const submitAssignToClassroom = async () => {
    if (!generatedTest || !teacherId || !onCreateAssignment || !assignClassroomId) return;
    setAssignLoading(true);
    setAssignError(null);
    setAssignSuccess(null);
    try {
      const assignmentTaskId = "generated-mcq-test";
      const tasks: AssignmentTaskStored[] = [
        {
          id: assignmentTaskId,
          kind: "external_link",
          label: "Open and attempt classroom MCQ test",
          href: `/classroom/${assignClassroomId}/assignment-test/{{POST_ID}}`,
          visible_to_student: true,
          position: 0,
          reward_rdm: null,
        },
      ];
      await onCreateAssignment({
        teacherId,
        classroomId: assignClassroomId,
        assignmentType: "assignment",
        title: generatedTest.name,
        dueDate: assignDueDate || null,
        assignToLabel: "All students",
        rewardRdm: 0,
        instructions: assignInstructions.trim(),
        tasks,
        extraContentJson: {
          generatedTestPaper: {
            taskId: assignmentTaskId,
            test: generatedTest,
          } as unknown as Json,
        },
      });
      setAssignSuccess(
        "Assigned successfully. Students will now see this in classroom assignments."
      );
      setAssignDialogOpen(false);
      if (onNavigateToSection) onNavigateToSection("myClassroom");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to assign test.";
      setAssignError(message);
    } finally {
      setAssignLoading(false);
    }
  };

  const computedTestName = useMemo(() => {
    if (testName.trim()) return testName.trim();
    const ch = findChapterFlatLabel(curriculumUnits, chapterId);
    if (scope === "Topic-wise" && selectedTopicId) {
      const topicTitle = findTopicTitle(curriculumUnits, chapterId, selectedTopicId);
      return `${examType} — ${ch} — ${topicTitle}`;
    }
    if (scope === "Unit-wise") {
      const u = findUnitLabel(curriculumUnits, selectedUnitId);
      const topicTitle = selectedTopicId
        ? findTopicTitle(curriculumUnits, chapterId, selectedTopicId)
        : "";
      const topicPart = topicTitle ? ` — ${topicTitle}` : "";
      return `${examType} — ${scope}: ${u} — ${ch}${topicPart}`;
    }
    return `${examType} — ${ch}`;
  }, [chapterId, curriculumUnits, examType, scope, selectedTopicId, selectedUnitId, testName]);
  const pillBase =
    "rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors sm:px-3.5 sm:py-1.5 sm:text-sm";
  const pillClassLevel = (active: boolean) =>
    `${pillBase} ${active ? "border-sky-400/55 bg-sky-500/12 text-sky-100" : "border-white/10 bg-[#0c1020] text-slate-300 hover:bg-white/[0.04]"}`;
  const pillClassScope = (active: boolean) =>
    `${pillBase} ${active ? "border-emerald-400/55 bg-emerald-500/12 text-emerald-100" : "border-white/10 bg-[#0c1020] text-slate-300 hover:bg-white/[0.04]"}`;
  const pillClassSubject = (active: boolean) =>
    `${pillBase} ${active ? "border-violet-400/50 bg-violet-500/12 text-violet-100" : "border-white/10 bg-[#0c1020] text-slate-300 hover:bg-white/[0.04]"}`;
  const pillClassNeutral = (active: boolean) =>
    `${pillBase} ${active ? "border-emerald-400/50 bg-emerald-500/12 text-emerald-100" : "border-white/10 bg-[#0c1020] text-slate-300 hover:bg-white/[0.04]"}`;

  const stepFooterClass =
    embedded
      ? "relative mt-auto flex flex-col gap-2 border-t border-white/[0.06] pt-3 sm:block sm:min-h-[38px] sm:pt-3"
      : "relative mt-2 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:block sm:min-h-[44px] sm:pt-5";
  const step1FooterClass = embedded
    ? "relative mt-auto flex flex-col gap-2 border-t border-white/[0.06] pt-3 sm:block sm:min-h-[38px] sm:pt-3"
    : "relative mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-4 sm:block sm:min-h-[44px] sm:pt-5";
  const step5FooterClass = embedded
    ? "relative mt-auto flex min-h-[38px] flex-col gap-2 border-t border-white/[0.06] pt-3 sm:block"
    : "relative mt-1 flex min-h-[44px] flex-col gap-3 border-t border-white/[0.06] pt-5 sm:block";

  const stepperPad = embedded
    ? "px-1.5 py-1.5 sm:px-2 sm:py-2"
    : "px-2 py-2 sm:px-3 sm:py-3";
  const stepperDot = embedded
    ? "mx-auto mb-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
    : "mx-auto mb-1 flex h-5.5 w-5.5 items-center justify-center rounded-full text-[10px] font-bold sm:h-6 sm:w-6 sm:text-[11px]";

  return (
    <div
      className={
        embedded ? "flex h-full min-h-0 w-full min-w-0 flex-col text-left" : "w-full min-w-0 text-left"
      }
    >
      {embedded ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/[0.06] pb-2">
          <span className="font-serif text-lg font-semibold tracking-tight text-slate-100 sm:text-xl">
            Create <span className="text-emerald-400 italic">Tests</span>
          </span>
          <span className="text-[11px] text-slate-500">CBSE · question bank</span>
        </div>
      ) : (
        <>
          <h1 className="font-serif text-xl tracking-tight sm:text-3xl lg:text-[2.125rem]">
            Create <span className="text-emerald-400 italic">Tests</span>
          </h1>
          <p className="mt-1 max-w-[65ch] text-[11px] leading-relaxed text-slate-400 sm:text-sm">
            Generate question-bank MCQ papers for <span className="text-slate-200">CBSE Board</span>{" "}
            today. KCET and JEE Main are on the way.
          </p>
        </>
      )}

        <div
          className={`overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101428] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] ${
            embedded ? "mt-1 flex min-h-0 flex-1 flex-col sm:mt-2" : "mt-3 sm:mt-5"
          }`}
        >
        <div className="-mx-px overflow-x-auto border-b border-white/[0.08] sm:mx-0 sm:overflow-visible">
          <div className="grid min-w-[min(100%,28rem)] grid-cols-2 min-[480px]:grid-cols-3 sm:min-w-0 sm:grid-cols-5">
          {stepLabels.map((label, idx) => {
            const i = idx + 1;
            const active = step === i;
            const done = step > i;
            return (
              <div
                key={label}
                className={`${stepperPad} text-center ${active ? "bg-emerald-500/[0.09]" : ""}`}
              >
                <div
                  className={`${stepperDot} ${
                    done
                      ? "bg-emerald-500/25 text-emerald-200"
                      : active
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-white/[0.06] text-slate-500"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5 stroke-[3]" aria-hidden /> : i}
                </div>
                <div
                  className={`text-[10px] font-semibold leading-tight sm:text-xs ${active ? "text-emerald-300" : done ? "text-slate-300" : "text-slate-500"}`}
                >
                  {label}
                </div>
              </div>
            );
          })}
          </div>
        </div>

        <div
          className={
            embedded
              ? "flex min-h-0 flex-1 flex-col overflow-y-auto p-3 sm:p-4"
              : "p-3 sm:p-5"
          }
        >
          {step === 1 ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Choose exam type
              </div>
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch">
                <div
                  role="status"
                  aria-current="true"
                  className="flex min-w-0 flex-1 flex-col justify-center rounded-xl border border-emerald-400/40 bg-emerald-500/[0.08] px-3 py-3 sm:min-w-0 sm:px-4 sm:py-3.5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg" aria-hidden>
                      📘
                    </span>
                    <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                      Available
                    </span>
                  </div>
                  <div className="mt-1 font-serif text-lg font-bold text-emerald-50 sm:text-xl">
                    CBSE Board
                  </div>
                  <p className="mt-1 text-xs leading-snug text-slate-400 sm:text-[13px]">
                    Topic- or unit-scoped MCQs — pick class, subject, then scope in the next step.
                  </p>
                </div>
                <div className="flex flex-1 gap-2.5 sm:w-[9.25rem] sm:max-w-[9.25rem] sm:flex-none sm:flex-col sm:shrink-0">
                  {(
                    [
                      { label: "KCET" as const, emoji: "🌿" },
                      { label: "JEE Main" as const, emoji: "⚡" },
                    ] as const
                  ).map((item) => (
                    <div
                      key={item.label}
                      className="flex flex-1 flex-col justify-center rounded-xl border border-white/[0.07] bg-[#0b0f1d] px-3 py-2.5 sm:flex-none"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm" aria-hidden>
                          {item.emoji}
                        </span>
                        <span className="rounded-full border border-violet-400/20 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-violet-200/95">
                          Soon
                        </span>
                      </div>
                      <div className="mt-1 text-sm font-bold text-slate-300">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className={step1FooterClass}>
                <p className="order-first text-center text-xs text-slate-500 sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
                  Step 1 of 5
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setStepSynced(2)}
                    className="inline-flex h-10 w-full items-center justify-center rounded-full bg-emerald-500 px-4 text-sm font-semibold text-black sm:w-auto sm:px-5"
                  >
                    Next: Class & Scope <ChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className={embedded ? "flex min-h-0 flex-1 flex-col gap-3" : "space-y-4"}>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Class level
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["Class 11 (PUC 1)", "Class 12 (PUC 2)"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setClassLevel(item)}
                      className={pillClassLevel(classLevel === item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Subject
                </div>
                <div
                  className="flex flex-wrap gap-2"
                  role="radiogroup"
                  aria-label="Subject for this test"
                >
                  {["Physics", "Chemistry", "Mathematics"].map((subj) => {
                    const active = subject === subj;
                    return (
                      <button
                        key={subj}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setSubject(subj)}
                        className={pillClassSubject(active)}
                      >
                        {subj}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                  Test scope
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["Topic-wise", "Unit-wise"] as const).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setScope(item)}
                      className={pillClassScope(scope === item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              {curriculumLoading ? (
                <p className="text-sm text-slate-400" role="status">
                  Loading curriculum from the question bank…
                </p>
              ) : null}
              {curriculumError && !curriculumLoading ? (
                <p className="rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-100/95">
                  {curriculumError}
                </p>
              ) : null}

              {scope === "Topic-wise" ? (
                <div className="space-y-3">
                  <div>
                    <label
                      htmlFor="create-tests-chapter-topic"
                      className="mb-1 block text-sm font-semibold text-slate-300"
                    >
                      Select chapter
                    </label>
                    <select
                      id="create-tests-chapter-topic"
                      value={chapterId}
                      onChange={(e) => setChapterId(e.target.value)}
                      disabled={curriculumLoading || flatChapters.length === 0}
                      className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 text-sm outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11"
                    >
                      {flatChapters.length === 0 ? (
                        <option value="">No chapters available</option>
                      ) : null}
                      {flatChapters.map((item) => (
                        <option key={item.compositeId} value={item.compositeId}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      htmlFor="create-tests-topic-topicwise"
                      className="mb-1 block text-sm font-semibold text-slate-300"
                    >
                      Topic
                    </label>
                    <select
                      id="create-tests-topic-topicwise"
                      value={selectedTopicId}
                      onChange={(e) => setSelectedTopicId(e.target.value)}
                      disabled={curriculumLoading || topicsForSelectedChapter.length === 0}
                      className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 text-sm outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11"
                    >
                      {topicsForSelectedChapter.length === 0 ? (
                        <option value="">No topics for this chapter</option>
                      ) : null}
                      {topicsForSelectedChapter.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              {scope === "Unit-wise" ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="create-tests-unit"
                        className="mb-1 block text-sm font-semibold text-slate-300"
                      >
                        Unit
                      </label>
                      <select
                        id="create-tests-unit"
                        value={selectedUnitId}
                        onChange={(e) => {
                          const uid = e.target.value;
                          setSelectedUnitId(uid);
                          const chs = getChaptersForUnit(curriculumUnits, uid);
                          const c0 = chs[0];
                          setChapterId(c0 ? compositeChapterId(uid, c0.id) : "");
                        }}
                        disabled={curriculumLoading || unitsForClass.length === 0}
                        className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 text-sm outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11"
                      >
                        {unitsForClass.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.unit_title || u.unit_label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="create-tests-chapter-unit"
                        className="mb-1 block text-sm font-semibold text-slate-300"
                      >
                        Chapter
                      </label>
                      <select
                        id="create-tests-chapter-unit"
                        value={chapterId}
                        onChange={(e) => setChapterId(e.target.value)}
                        disabled={curriculumLoading || chaptersInSelectedUnit.length === 0}
                        className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 text-sm outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11"
                      >
                        {chaptersInSelectedUnit.map((ch) => (
                          <option key={ch.id} value={compositeChapterId(selectedUnitId, ch.id)}>
                            {ch.title}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label
                      htmlFor="create-tests-topic-unit"
                      className="mb-1 block text-sm font-semibold text-slate-300"
                    >
                      Topic
                    </label>
                    <select
                      id="create-tests-topic-unit"
                      value={selectedTopicId}
                      onChange={(e) => setSelectedTopicId(e.target.value)}
                      disabled={curriculumLoading || topicsForSelectedChapter.length === 0}
                      className="h-10 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 text-sm outline-none focus:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:h-11"
                    >
                      {topicsForSelectedChapter.length === 0 ? (
                        <option value="">No topics for this chapter</option>
                      ) : null}
                      {topicsForSelectedChapter.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : null}

              <div className={stepFooterClass}>
                <p className="order-first text-center text-xs text-slate-500 sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
                  Step 2 of 5
                </p>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStepSynced(1)}
                    className="rounded-full border border-white/10 px-4 py-2 text-[13px] text-slate-300 sm:px-5 sm:text-sm"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={!canProceedStep2}
                    onClick={() => setStepSynced(3)}
                    className="inline-flex h-10 items-center rounded-full bg-emerald-500 px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next: Questions <ChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className={embedded ? "flex min-h-0 flex-1 flex-col gap-2.5" : "space-y-4"}>
              <div
                className={`font-semibold uppercase tracking-[0.1em] text-slate-500 ${embedded ? "mb-1 text-[10px]" : "mb-2 text-[11px]"}`}
              >
                Question bank for your scope
              </div>
              <p
                className={`text-slate-400 ${embedded ? "text-xs leading-snug" : "text-sm leading-relaxed"}`}
              >
                Fresh questions available for your selected scope.{" "}
                <span className="font-semibold text-amber-300">Only Advanced-level questions</span>{" "}
                are used to keep tests challenging. Questions from your previous tests are{" "}
                <span className="text-slate-300">automatically excluded</span> so students never see
                duplicates.
              </p>
              {questionBankLoading ? (
                <p className="text-sm text-slate-400" role="status">
                  Counting questions…
                </p>
              ) : null}
              {questionBankError ? (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {questionBankError}
                </div>
              ) : null}
              {!questionBankLoading && !questionBankError && questionBankCount !== null ? (
                <div
                  className={`rounded-xl border border-white/10 bg-[#0e1325] px-3 ${embedded ? "py-2.5 sm:py-3" : "py-4 sm:px-4 sm:py-5"}`}
                >
                  <div
                    className={`font-semibold uppercase tracking-[0.1em] text-slate-500 ${embedded ? "text-[10px]" : "text-[11px]"}`}
                  >
                    Questions available
                  </div>
                  <div
                    className={`font-serif font-bold tracking-tight text-emerald-300 ${embedded ? "mt-1 text-2xl sm:text-3xl" : "mt-2 text-3xl sm:text-4xl"}`}
                  >
                    {questionBankCount}
                  </div>
                  <p className={`text-slate-500 ${embedded ? "mt-1 text-[11px] leading-snug" : "mt-2 text-xs leading-relaxed"}`}
                  >
                    {questionBankCount === 0
                      ? "No matching questions yet for this scope. Try another chapter or topic, or a different unit."
                      : "This is how many questions you can draw from the bank for this configuration."}
                  </p>
                  {questionBankRawCount !== null &&
                  questionBankCount !== null &&
                  questionBankRawCount > questionBankCount ? (
                    <p className="mt-1 text-xs text-amber-400">
                      {questionBankRawCount - questionBankCount} question
                      {questionBankRawCount - questionBankCount === 1 ? "" : "s"} excluded (already
                      used in a previous test) — {questionBankRawCount} total in bank
                    </p>
                  ) : null}
                </div>
              ) : null}
              {!questionBankLoading && !questionBankError && questionBankCount !== null ? (
                <div>
                  <div
                    className={`font-semibold uppercase tracking-[0.1em] text-slate-500 ${embedded ? "mb-1 text-[10px]" : "mb-2 text-[11px]"}`}
                  >
                    How many questions in this test
                  </div>
                  <p className={`text-slate-500 ${embedded ? "mb-1 text-[11px] leading-snug" : "mb-2 text-xs"}`}
                  >
                    Use a quick preset or enter any count up to your bank total. Presets above your
                    bank size are disabled.
                  </p>
                  <div
                    className="flex flex-wrap items-center gap-2"
                    role="group"
                    aria-label="Number of questions in test"
                  >
                    {QUESTION_PRESETS.map((num) => {
                      const enabled =
                        questionBankCount !== null &&
                        questionBankCount > 0 &&
                        num <= questionBankCount;
                      const active = enabled && testQuestionCount === num;
                      return (
                        <button
                          key={num}
                          type="button"
                          disabled={!enabled}
                          onClick={() => setTestQuestionCount(num)}
                          className={`${pillClassNeutral(active)} ${enabled ? "" : "cursor-not-allowed opacity-40"}`}
                        >
                          {num} Q
                        </button>
                      );
                    })}
                    {questionBankCount !== null &&
                    questionBankCount > 0 &&
                    questionBankCount < 10 ? (
                      <button
                        key="all-small-bank"
                        type="button"
                        onClick={() => setTestQuestionCount(questionBankCount)}
                        className={pillClassNeutral(
                          testQuestionCount === questionBankCount && questionBankCount > 0
                        )}
                      >
                        {questionBankCount} Q (all available)
                      </button>
                    ) : null}
                    {questionBankCount !== null && questionBankCount > 0 ? (
                      <div className="mt-2 flex w-full min-w-[min(100%,18rem)] flex-col gap-1.5 sm:mt-0 sm:ml-1 sm:w-auto">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
                          Custom
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            id="create-tests-custom-q"
                            type="number"
                            min={1}
                            max={questionBankCount}
                            value={questionCountDraft}
                            onChange={(e) => setQuestionCountDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                applyCustomQuestionCount();
                              }
                            }}
                            aria-label="Custom number of questions"
                            className="h-10 w-24 rounded-xl border border-white/10 bg-[#0b1020] px-3 text-sm tabular-nums outline-none focus:border-emerald-400"
                          />
                          <button
                            type="button"
                            onClick={applyCustomQuestionCount}
                            className="h-10 rounded-xl border border-emerald-400/40 bg-emerald-500/15 px-4 text-sm font-semibold text-emerald-100"
                          >
                            Apply
                          </button>
                        </div>
                        <span className="text-[11px] text-slate-500">
                          1–{questionBankCount} questions
                        </span>
                      </div>
                    ) : null}
                  </div>
                  {questionBankCount > 0 ? (
                    <p className="mt-2 text-xs text-slate-500">
                      This test will use up to{" "}
                      <span className="font-semibold text-slate-300">
                        {effectiveTestQuestionCount}
                      </span>{" "}
                      question
                      {effectiveTestQuestionCount === 1 ? "" : "s"} from the bank.
                    </p>
                  ) : null}
                </div>
              ) : null}
              <div className={stepFooterClass}>
                <p className="order-first text-center text-xs text-slate-500 sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
                  Step 3 of 5
                </p>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStepSynced(2)}
                    className="rounded-full border border-white/10 px-4 py-2 text-[13px] text-slate-300 sm:px-5 sm:text-sm"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={!canProceedStep3}
                    onClick={() => setStepSynced(4)}
                    className="inline-flex h-10 items-center rounded-full bg-emerald-500 px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next: Source & Duration <ChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div className={embedded ? "flex min-h-0 flex-1 flex-col gap-3" : "space-y-4"}>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                Question source
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div
                  className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-3 text-left sm:p-4"
                  aria-disabled="true"
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="text-lg" aria-hidden>
                      🤖
                    </span>
                    <span className="rounded-full border border-amber-400/40 bg-amber-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-100">
                      Coming soon
                    </span>
                  </div>
                  <div className="font-semibold text-slate-400">Created by AI</div>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                    Auto-generated papers are not available yet. Use the question bank for now.
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-400/45 bg-emerald-500/10 p-3 text-left ring-1 ring-emerald-400/15 sm:p-4">
                  <div className="mb-1 text-lg" aria-hidden>
                    📚
                  </div>
                  <div className="font-semibold text-emerald-200">From Question Bank</div>
                  <p className="mt-1 text-xs text-emerald-100/70">MCQs from your syllabus scope.</p>
                </div>
              </div>
              <div
                className={`rounded-xl border p-3 transition-colors sm:p-4 ${
                  duration === null
                    ? "border-amber-400/50 bg-amber-500/[0.07] ring-1 ring-amber-400/25"
                    : "border-white/10 bg-[#0e1325]"
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500">
                    Test duration
                  </div>
                  {duration === null ? (
                    <span className="text-[11px] font-bold uppercase tracking-wide text-amber-200">
                      Required — pick one
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">
                  For{" "}
                  <span className="font-semibold text-slate-200">{effectiveTestQuestionCount}</span>{" "}
                  question{effectiveTestQuestionCount === 1 ? "" : "s"}, about{" "}
                  <span className="font-semibold text-emerald-200/90">{suggestedDuration} min</span>{" "}
                  is a comfortable pace (~2 min per question). Choose a duration that fits your
                  period.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {DURATION_CHOICES.map((mins) => {
                    const isSuggested = mins === suggestedDuration;
                    const active = duration === mins;
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => setDuration(mins)}
                        className={`${pillClassNeutral(active)} ${
                          duration === null && isSuggested
                            ? "ring-2 ring-emerald-400/45 ring-offset-2 ring-offset-[#0e1325]"
                            : ""
                        }`}
                      >
                        {mins} min
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => setDuration(suggestedDuration)}
                    className="ml-0 rounded-full border border-emerald-400/35 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/15 sm:ml-1"
                  >
                    Use {suggestedDuration} min
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-300">
                  Test name (optional)
                </label>
                <input
                  value={testName}
                  onChange={(e) => setTestName(e.target.value)}
                  placeholder={`e.g. ${examType} - ${scope} Test - April 2026`}
                  className="h-10 w-full max-w-xl rounded-xl border border-white/10 bg-[#0b1020] px-3 text-sm outline-none placeholder:text-slate-500 focus:border-emerald-400 sm:h-11"
                />
              </div>
              <div className={stepFooterClass}>
                <p className="order-first text-center text-xs text-slate-500 sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
                  Step 4 of 5
                </p>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setStepSynced(3)}
                    className="rounded-full border border-white/10 px-4 py-2 text-[13px] text-slate-300 sm:px-5 sm:text-sm"
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    disabled={!canProceedStep4}
                    onClick={() => setStepSynced(5)}
                    className="inline-flex h-10 items-center rounded-full bg-emerald-500 px-5 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Preview & Generate <ChevronRight className="ml-1 h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 5 ? (
            generatedTest ? (
              <div className={embedded ? "flex min-h-0 flex-1 flex-col" : undefined}>
                <GeneratedTestPreview
                  test={generatedTest}
                  createPdfLoading={createPdfLoading}
                  onEditSettings={() => {
                    setGeneratedTest(null);
                    setGenerateError(null);
                    setStepSynced(4);
                  }}
                  onCreatePdf={() => {
                    void handleCreatePdf();
                  }}
                  onAssignClassroom={() => {
                    openAssignDialog();
                  }}
                />
              </div>
            ) : (
              <div className={embedded ? "flex min-h-0 flex-1 flex-col gap-3" : "space-y-5"}>
                <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Review your test configuration
                </div>

                <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c1022] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
                  <div className="grid md:grid-cols-2">
                    <div
                      className={`border-b border-white/[0.08] md:border-b-0 md:border-r ${embedded ? "p-4 md:p-4" : "p-5 md:p-6"}`}
                    >
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Exam type
                      </div>
                      <div className="mb-6 font-serif text-2xl font-bold tracking-tight text-slate-100 sm:text-3xl">
                        {examType}
                      </div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Class
                      </div>
                      <div className="mb-6 text-lg font-semibold text-slate-200">{classLevel}</div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Subject
                      </div>
                      <div className="mb-6 text-lg font-semibold text-slate-200">{subject}</div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Question bank
                      </div>
                      <div className="text-lg font-semibold text-slate-200">
                        {questionBankCount !== null
                          ? `${questionBankCount} available for this scope`
                          : "—"}
                      </div>
                    </div>

                    <div className={`bg-[#080c18]/80 ${embedded ? "p-4 md:p-4" : "p-5 md:p-6"}`}>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Test name
                      </div>
                      <div className="mb-6 font-serif text-xl font-bold leading-snug tracking-tight text-slate-50 sm:text-2xl">
                        {computedTestName}
                      </div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Scope
                      </div>
                      <div className="mb-2 text-lg font-semibold text-slate-100">{scope}</div>
                      <div className="mb-6 text-sm leading-relaxed text-slate-400">
                        {scopeDetails.map((row) => (
                          <div key={row}>{row}</div>
                        ))}
                      </div>
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        Source · Duration
                      </div>
                      <div className="text-base font-semibold leading-relaxed text-slate-100 sm:text-lg">
                        {source === "From Question Bank" ? "Question bank" : source} ·{" "}
                        {duration !== null ? `${duration} min` : "—"} ·{" "}
                        {questionBankCount !== null
                          ? `${effectiveTestQuestionCount} question${effectiveTestQuestionCount === 1 ? "" : "s"}`
                          : "—"}
                      </div>
                      {questionBankCount !== null && questionBankCount > 0 ? (
                        <p className="mt-2 text-xs text-slate-500">
                          Drawing up to {effectiveTestQuestionCount} of {questionBankCount} bank
                          questions for this test.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                {generateError ? (
                  <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                    {generateError}
                  </div>
                ) : null}

                <div className="flex justify-center pt-1">
                  <button
                    type="button"
                    disabled={!canGenerateNow || generateLoading}
                    onClick={() => {
                      void handleGenerateTestNow();
                    }}
                    className="inline-flex h-11 min-w-[min(100%,18rem)] items-center justify-center gap-2 rounded-full bg-emerald-500 px-6 text-sm font-bold text-black shadow-[0_0_24px_-4px_rgba(52,211,153,0.45)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60 sm:h-12 sm:min-w-[min(100%,20rem)] sm:px-10 sm:text-base"
                  >
                    <Code2 className="h-4 w-4 shrink-0 opacity-90 sm:h-5 sm:w-5" strokeWidth={2.25} aria-hidden />
                    {generateLoading
                      ? "Generating..."
                      : `Generate Test Now (-${teacherRdmCosts.generate_test} RDM)`}
                  </button>
                </div>

                <div className={step5FooterClass}>
                  <p className="order-first text-center text-xs text-slate-500 sm:absolute sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2">
                    Step 5 of 5 — Review and generate
                  </p>
                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={() => setStepSynced(4)}
                      className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-slate-300 hover:border-white/20 hover:bg-white/[0.04]"
                    >
                      ← Back to settings
                    </button>
                  </div>
                </div>
              </div>
            )
          ) : null}
        </div>
      </div>

      {/* Test History Section — separate card below the wizard (full page only) */}
      {!embedded ? (
      <div className="mt-4 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#101428] shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] sm:mt-6">
        <div className="border-b border-white/[0.08] px-3 py-2.5 sm:px-5 sm:py-4 lg:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-200">Your Generated Test History</h3>
          </div>
        </div>
        <div className="p-3 sm:p-5 lg:p-6">
          {historyLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-slate-300" />
              Loading history...
            </div>
          ) : testHistory.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-[#0c1020] p-3 text-center sm:p-6">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/50 text-slate-500">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A2.25 2.25 0 0113.5 6.25v-1.5a2.25 2.25 0 00-2.25-2.25H8.25A2.25 2.25 0 006 4.75v15a2.25 2.25 0 002.25 2.25h10.5"
                  />
                </svg>
              </div>
              <p className="text-sm text-slate-400">No tests generated yet</p>
              <p className="mt-1 text-xs text-slate-600">
                Generate your first test above — it will appear here
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
              {testHistory.map((item) => (
                <div
                  key={item.id}
                  className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#0b1020] p-3.5 transition hover:border-white/20 hover:bg-[#0d1223] sm:p-4"
                >
                  <div className="absolute right-3 top-3">
                    <span className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                      {item.scope}
                    </span>
                  </div>
                  <div className="mb-1 text-xs font-medium text-violet-400">
                    {new Date(item.generated_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                  <div className="mb-2 pr-14 text-sm font-semibold text-slate-100 line-clamp-2 sm:mb-3 sm:pr-16">
                    {item.topic_title || item.unit_title || item.chapter_title || "Generated Test"}
                  </div>
                  <div className="mb-3 flex items-center gap-2 text-xs text-slate-500 sm:mb-4 sm:gap-3">
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      {item.question_count} questions
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-400" />
                      {item.duration_minutes || 30} min
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const historyTest: GeneratedTeacherTest = {
                          id: item.id,
                          name: `CBSE Board — ${item.chapter_title || item.unit_title || "Generated Test"}`,
                          examType: "CBSE Board" as ExamType,
                          board: "CBSE Board",
                          classLevelLabel:
                            item.class_level === 11 ? "Class 11 (PUC 1)" : "Class 12 (PUC 2)",
                          classLevelNumeric: item.class_level as 11 | 12,
                          subjectLabel:
                            item.subject.charAt(0).toUpperCase() + item.subject.slice(1),
                          sourceLabel: "Question bank",
                          scopeLabel: item.scope,
                          scopeDetails: [item.topic_title || item.unit_title || ""].filter(Boolean),
                          durationMinutes: item.duration_minutes || 30,
                          requestedCount: item.question_count,
                          pickedCount: item.question_count,
                          bankAvailable: item.question_count,
                          classLevelUsed: item.class_level as 11 | 12,
                          generatedAtIso: item.generated_at,
                          questions: (
                            item.questions as Array<{
                              id: string;
                              question: string;
                              options: string[];
                              correctAnswerIndex: number;
                              explanation?: string;
                            }>
                          ).map((q) => ({
                            ...q,
                            topic: "",
                            subtopicName: "",
                            level: "unknown" as const,
                            solution: q.explanation ?? "",
                          })),
                        };
                        void openTeacherTestPrintPreview(historyTest);
                      }}
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-white/10 hover:text-white sm:px-3 sm:py-2"
                    >
                      Print
                    </button>
                    <button
                      type="button"
                      disabled={!canAssignToClassroom}
                      onClick={() => {
                        const historyTest: GeneratedTeacherTest = {
                          id: item.id,
                          name: `CBSE Board — ${item.chapter_title || item.unit_title || "Generated Test"}`,
                          examType: "CBSE Board" as ExamType,
                          board: "CBSE Board",
                          classLevelLabel:
                            item.class_level === 11 ? "Class 11 (PUC 1)" : "Class 12 (PUC 2)",
                          classLevelNumeric: item.class_level as 11 | 12,
                          subjectLabel:
                            item.subject.charAt(0).toUpperCase() + item.subject.slice(1),
                          sourceLabel: "Question bank",
                          scopeLabel: item.scope,
                          scopeDetails: [item.topic_title || item.unit_title || ""].filter(Boolean),
                          durationMinutes: item.duration_minutes || 30,
                          requestedCount: item.question_count,
                          pickedCount: item.question_count,
                          bankAvailable: item.question_count,
                          classLevelUsed: item.class_level as 11 | 12,
                          generatedAtIso: item.generated_at,
                          questions: (
                            item.questions as Array<{
                              id: string;
                              question: string;
                              options: string[];
                              correctAnswerIndex: number;
                              explanation?: string;
                            }>
                          ).map((q) => ({
                            ...q,
                            topic: "",
                            subtopicName: "",
                            level: "unknown" as const,
                            solution: q.explanation ?? "",
                          })),
                        };
                        setGeneratedTest(historyTest);
                        openAssignDialog();
                      }}
                      className="flex-1 rounded-lg border border-violet-500/20 bg-violet-500/10 px-2.5 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/15 hover:text-violet-200 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-violet-500/10 disabled:hover:text-violet-300 sm:px-3 sm:py-2"
                    >
                      Assign to class
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      ) : null}

      {assignError ? (
        <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {assignError}
        </div>
      ) : null}
      {assignSuccess ? (
        <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {assignSuccess}
        </div>
      ) : null}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-lg rounded-2xl border-white/10 bg-[#0d1223] text-slate-100">
          <DialogHeader>
            <DialogTitle className="font-serif text-2xl">Assign Test to Classroom</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-300">Classroom</label>
              <select
                value={assignClassroomId}
                onChange={(e) => setAssignClassroomId(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 text-sm outline-none focus:border-emerald-400"
              >
                {classrooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} ({room.studentCount} students)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-300">Due date</label>
              <input
                type="date"
                value={assignDueDate}
                onChange={(e) => setAssignDueDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 text-sm outline-none focus:border-emerald-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-300">
                Student instructions
              </label>
              <textarea
                value={assignInstructions}
                onChange={(e) => setAssignInstructions(e.target.value)}
                rows={4}
                className="w-full rounded-xl border border-white/10 bg-[#0b1020] px-3 py-2 text-sm outline-none focus:border-emerald-400"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAssignDialogOpen(false)}
                className="rounded-full border border-white/10 px-4 py-2 text-sm text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={assignLoading || !assignClassroomId}
                onClick={() => {
                  void submitAssignToClassroom();
                }}
                className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {assignLoading ? "Assigning..." : "Assign now"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
