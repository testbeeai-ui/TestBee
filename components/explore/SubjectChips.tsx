"use client";

import { useState, useCallback, useEffect } from "react";
import type { Subject, ExamType, ClassLevel } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { examTypeToTargetExam } from "@/lib/profile/targetExam";
import { OnboardingClickHerePointer } from "@/components/onboarding/OnboardingClickHerePointer";
import { cn } from "@/lib/utils";
import {
  Atom,
  Calculator,
  FlaskConical,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Dna,
  Monitor,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

const subjectList = [
  {
    value: "physics" as Subject,
    label: "Physics",
    color: "text-sky-100",
    bg: "from-sky-950/40 via-blue-950/20 to-background/60",
    ring: "ring-sky-500/30 hover:ring-sky-400/60",
    border: "border-sky-500/50 hover:border-sky-400/80 shadow-[0_0_18px_rgba(56,189,248,0.08)] hover:shadow-[0_0_25px_rgba(56,189,248,0.18)]",
    icon: Atom,
    iconWrap: "border-sky-400/50 bg-sky-500/20 text-sky-200",
    subtitle: "Mechanics · Electrostatics · Current electricity · Magnetism",
    active: true,
  },
  {
    value: "chemistry" as Subject,
    label: "Chemistry",
    color: "text-violet-100",
    bg: "from-violet-950/40 via-purple-950/20 to-background/60",
    ring: "ring-violet-500/30 hover:ring-violet-400/60",
    border: "border-violet-500/50 hover:border-violet-400/80 shadow-[0_0_18px_rgba(139,92,246,0.08)] hover:shadow-[0_0_25px_rgba(139,92,246,0.18)]",
    icon: FlaskConical,
    iconWrap: "border-violet-400/50 bg-violet-500/20 text-violet-200",
    subtitle: "Organic chemistry · Inorganic chemistry · Physical chemistry · Equilibrium",
    active: true,
  },
  {
    value: "math" as Subject,
    label: "Mathematics",
    color: "text-amber-100",
    bg: "from-amber-950/30 via-orange-950/15 to-background/60",
    ring: "ring-amber-500/30 hover:ring-amber-400/60",
    border: "border-amber-500/50 hover:border-amber-400/80 shadow-[0_0_18px_rgba(245,158,11,0.08)] hover:shadow-[0_0_25px_rgba(245,158,11,0.18)]",
    icon: Calculator,
    iconWrap: "border-amber-400/50 bg-amber-500/20 text-amber-200",
    subtitle: "Calculus · Algebra · Coordinate geometry · Probability",
    active: true,
  },
  {
    value: "biology" as any,
    label: "Biology",
    color: "text-pink-100/60",
    bg: "from-pink-950/15 to-background/30",
    ring: "ring-pink-500/10",
    border: "border-pink-500/20",
    icon: Dna,
    iconWrap: "border-pink-400/15 bg-pink-500/8 text-pink-200/50",
    subtitle: "",
    comingSoon: true,
  },
  {
    value: "cs" as any,
    label: "Computer Science",
    color: "text-cyan-100/60",
    bg: "from-cyan-950/15 to-background/30",
    ring: "ring-cyan-500/10",
    border: "border-cyan-500/20",
    icon: Monitor,
    iconWrap: "border-cyan-400/15 bg-cyan-500/8 text-cyan-200/50",
    subtitle: "",
    comingSoon: true,
  },
  {
    value: "english" as any,
    label: "English",
    color: "text-indigo-100/60",
    bg: "from-indigo-950/15 to-background/30",
    ring: "ring-indigo-500/10",
    border: "border-indigo-500/20",
    icon: BookOpen,
    iconWrap: "border-indigo-400/15 bg-indigo-500/8 text-indigo-200/50",
    subtitle: "",
    comingSoon: true,
  },
];

interface SubjectChipsProps {
  onSelectSubject: (subject: Subject, exam: ExamType | null, classLevel: ClassLevel) => void;
  /** Onboarding popup only: point at one subject card until tapped. */
  showSubjectPickGuide?: boolean;
  onSubjectPickGuideDismiss?: () => void;
}

/** Onboarding pointer targets Chemistry; any subject tap still counts. */
const ONBOARDING_GUIDE_SUBJECT: Subject = "chemistry";

const CLASS_CONFIRM_KEY = (userId: string) => `edublast_class_confirmed_${userId}`;

export default function SubjectChips({
  onSelectSubject,
  showSubjectPickGuide = false,
  onSubjectPickGuideDismiss,
}: SubjectChipsProps) {
  const [selectedClass, setSelectedClass] = useState<ClassLevel>(11);
  const { user, profile, refreshProfile } = useAuth();

  // Sync selectedClass with profile's class level on load or change
  useEffect(() => {
    if (profile?.class_level === 11 || profile?.class_level === 12) {
      setSelectedClass(profile.class_level as ClassLevel);
    }
  }, [profile?.class_level]);

  // Class confirmation dialog state (free trial only)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingSubject, setPendingSubject] = useState<Subject | null>(null);
  const [confirmPickedClass, setConfirmPickedClass] = useState<ClassLevel>(11);
  const [notSureShown, setNotSureShown] = useState(false);

  const persistStudentPrefs = async (exam: ExamType | null, classLevel: ClassLevel) => {
    if (!user?.id || profile?.role !== "student") return;
    const target_exam = examTypeToTargetExam(exam);
    const { error } = await supabase
      .from("profiles")
      .update({ class_level: classLevel, target_exam })
      .eq("id", user.id);
    if (!error) await refreshProfile();
  };

  const isFreeTrial = profile?.free_trial_activated === true;

  const handleSubjectCardClick = useCallback(
    async (subject: Subject) => {
      if (showSubjectPickGuide) {
        onSubjectPickGuideDismiss?.();
      }

      const hasConfirmedClass =
        profile?.class_level === 11 ||
        profile?.class_level === 12 ||
        (user?.id ? !!localStorage.getItem(CLASS_CONFIRM_KEY(user.id)) : false);

      // For free trial students who haven't confirmed class yet → show modal
      if (isFreeTrial && user?.id && !hasConfirmedClass) {
        setPendingSubject(subject);
        setConfirmPickedClass(selectedClass);
        setNotSureShown(false);
        setConfirmDialogOpen(true);
        return;
      }

      // Otherwise proceed normally
      await persistStudentPrefs(null, selectedClass);
      onSelectSubject(subject, null, selectedClass);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isFreeTrial,
      user?.id,
      selectedClass,
      showSubjectPickGuide,
      onSubjectPickGuideDismiss,
      profile?.class_level,
    ]
  );

  const handleConfirmYes = async () => {
    if (!user?.id || !pendingSubject) return;
    // Save confirmation to localStorage so we don't show again
    localStorage.setItem(CLASS_CONFIRM_KEY(user.id), String(confirmPickedClass));
    setSelectedClass(confirmPickedClass);
    setConfirmDialogOpen(false);
    await persistStudentPrefs(null, confirmPickedClass);
    onSelectSubject(pendingSubject, null, confirmPickedClass);
    setPendingSubject(null);
  };

  const handleNotSure = () => {
    setNotSureShown(true);
  };

  return (
    <>
      <section
        className={cn(
          "relative mx-auto w-full max-w-7xl rounded-xl border border-border/60 bg-card/40 p-4 shadow-md ring-1 ring-white/[0.04] backdrop-blur-sm sm:rounded-2xl sm:p-5 sm:shadow-lg lg:p-6",
          showSubjectPickGuide ? "overflow-visible" : "overflow-hidden"
        )}
        aria-labelledby="browse-by-subject-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-30%,hsl(var(--primary)/0.08),transparent_50%)]"
          aria-hidden
        />
        <div className="relative">
          <div className="mb-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-emerald-400">
              Start here
            </p>
            <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <h3
                id="browse-by-subject-heading"
                className="text-xl font-bold tracking-tight text-foreground sm:text-2xl lg:text-3xl"
              >
                Browse by subject
              </h3>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                {([11, 12] as const).map((cl) => (
                  <button
                    key={cl}
                    type="button"
                    onClick={() => {
                      setSelectedClass(cl);
                      persistStudentPrefs(null, cl).catch(() => {});
                    }}
                    className={cn(
                      "rounded-full px-4 py-1.5 text-xs font-bold transition-all border",
                      selectedClass === cl
                        ? "border-blue-500 bg-blue-500/10 text-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                        : "border-border/60 bg-muted/20 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Class {cl}th
                  </button>
                ))}
                <span className="rounded-full border border-blue-500/30 bg-blue-500/5 px-4 py-1.5 text-xs font-bold text-blue-400">
                  CBSE Board
                </span>
              </div>
            </div>
            <p className="mt-2 text-xs leading-snug text-muted-foreground sm:text-sm max-w-2xl">
              {showSubjectPickGuide
                ? "Click here on Chemistry to open topics and continue your checklist."
                : "Pick a subject to open topics, lessons, and practice aligned to your board and class."}
            </p>
          </div>

          <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subjectList.map((s) => {
              const Icon = s.icon;
              const showGuide = showSubjectPickGuide && s.value === ONBOARDING_GUIDE_SUBJECT;
              
              if (s.comingSoon) {
                return (
                  <div
                    key={s.value}
                    className={cn(
                      "relative flex flex-col items-start text-left p-5 min-h-[148px] rounded-xl border bg-gradient-to-br opacity-50 select-none",
                      s.bg,
                      s.border
                    )}
                  >
                    <span className="absolute top-3 right-3 rounded border border-border/40 bg-muted/30 px-2 py-0.5 text-[8px] font-bold tracking-widest text-muted-foreground/80 uppercase">
                      COMING SOON
                    </span>
                    <div className="flex items-center gap-3">
                      <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl border shadow-inner", s.iconWrap)}>
                        <Icon className="h-4.5 w-4.5" strokeWidth={1.75} />
                      </span>
                      <span className={cn("text-base font-extrabold tracking-tight", s.color)}>
                        {s.label}
                      </span>
                    </div>
                  </div>
                );
              }

              return (
                <div key={s.value} className="relative h-full">
                  {showGuide ? (
                    <div className="pointer-events-none absolute -top-9 left-1/2 z-30 -translate-x-1/2 sm:-top-10">
                      <OnboardingClickHerePointer label="Click here" variant="violet" />
                    </div>
                  ) : null}
                  <button
                    type="button"
                    data-lessons-subject-chip="1"
                    onClick={() => handleSubjectCardClick(s.value as Subject)}
                    className={cn(
                      "group relative flex h-full min-h-[148px] w-full flex-col items-start text-left rounded-xl border bg-gradient-to-br p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      s.bg,
                      s.border,
                      showGuide &&
                        "border-violet-400/55 shadow-[0_0_0_2px_hsl(var(--background)),0_0_0_4px_rgba(167,139,250,0.35)]"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 items-center justify-center rounded-xl border shadow-inner transition-transform duration-200 group-hover:scale-[1.03]",
                          s.iconWrap
                        )}
                        aria-hidden
                      >
                        <Icon
                          className="h-4.5 w-4.5"
                          strokeWidth={1.75}
                        />
                      </span>
                      <span
                        className={cn(
                          "text-base font-extrabold tracking-tight",
                          s.color
                        )}
                      >
                        {s.label}
                      </span>
                    </div>
                    {s.subtitle && (
                      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground line-clamp-2">
                        {s.subtitle}
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                      <span className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-blue-300">
                        CBSE
                      </span>
                      <span className="rounded border border-border/50 bg-muted/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                        Class {selectedClass}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Free Trial: Class Level Confirmation Dialog ── */}
      <Dialog
        open={confirmDialogOpen}
        onOpenChange={(open) => {
          if (!open) setConfirmDialogOpen(false);
        }}
      >
        <DialogContent
          className="max-w-sm rounded-2xl border border-violet-500/20 bg-[#080d19]/97 p-0 shadow-2xl backdrop-blur-xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          {/* Glowing gradient blob */}
          <div
            className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
            aria-hidden
          >
            <div className="absolute -top-16 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-violet-600/10 blur-3xl" />
          </div>

          <div className="relative flex flex-col gap-0">
            {/* Header */}
            <div className="flex flex-col items-center gap-3 px-6 pb-4 pt-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/25 bg-violet-500/15 shadow-inner">
                <BookOpen className="h-7 w-7 text-violet-300" strokeWidth={1.75} />
              </div>
              <DialogHeader className="text-center">
                <DialogTitle className="text-base font-extrabold text-white sm:text-lg">
                  Confirm Your Class Level
                </DialogTitle>
                <DialogDescription className="mt-1 text-[13px] leading-relaxed text-zinc-400">
                  You are about to explore the curriculum for{" "}
                  <span className="font-semibold text-violet-300">
                    Class {confirmPickedClass}th
                  </span>
                  . Please select the right class before proceeding — this sets up your full study
                  plan.
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Class selector inside dialog */}
            <div className="flex items-center justify-center gap-3 px-6 pb-2">
              {([11, 12] as const).map((cl) => (
                <button
                  key={cl}
                  type="button"
                  onClick={() => {
                    setConfirmPickedClass(cl);
                    setNotSureShown(false);
                  }}
                  className={cn(
                    "flex-1 rounded-xl border py-3 text-sm font-bold transition-all duration-150",
                    confirmPickedClass === cl
                      ? "border-violet-400/60 bg-violet-500/20 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.25)]"
                      : "border-border/50 bg-white/5 text-zinc-400 hover:border-violet-400/30 hover:text-white"
                  )}
                >
                  Class {cl}th
                </button>
              ))}
            </div>

            {/* "Not sure" warning message */}
            {notSureShown && (
              <div className="mx-6 mb-2 flex items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <p className="text-[12px] leading-relaxed text-amber-300">
                  Please verify and select the correct class above — Class 11th or Class 12th. Once
                  confirmed, your study plan will be tailored to that level.
                </p>
              </div>
            )}

            {/* Action buttons */}
            <DialogFooter className="flex flex-col gap-2 px-6 pb-6 pt-2 sm:flex-col">
              <Button
                id="class-confirm-yes-btn"
                onClick={handleConfirmYes}
                className="w-full gap-2 rounded-xl bg-violet-600 font-bold text-white shadow-md hover:bg-violet-500 active:scale-[0.98]"
              >
                <CheckCircle2 className="h-4 w-4" />
                Yes, I&apos;m sure — Go to Class {confirmPickedClass}th
              </Button>
              <Button
                id="class-confirm-not-sure-btn"
                variant="ghost"
                onClick={handleNotSure}
                className="w-full rounded-xl border border-border/50 text-zinc-400 hover:border-border hover:text-foreground"
              >
                Not sure — let me select the right class
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
