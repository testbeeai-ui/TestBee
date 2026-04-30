"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { Subject, ExamType, ClassLevel } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { examTypeToTargetExam } from "@/lib/targetExam";
import { cn } from "@/lib/utils";
import { Atom, Calculator, FlaskConical } from "lucide-react";

const subjectList: {
  value: Subject;
  label: string;
  color: string;
  bg: string;
  ring: string;
  icon: typeof Atom;
  iconWrap: string;
}[] = [
  {
    value: "physics",
    label: "Physics",
    color: "text-sky-100",
    bg: "from-sky-950/80 via-blue-950/40 to-background",
    ring: "ring-sky-500/25 hover:ring-sky-400/50",
    icon: Atom,
    iconWrap: "border-sky-400/35 bg-sky-500/15 text-sky-200",
  },
  {
    value: "chemistry",
    label: "Chemistry",
    color: "text-violet-100",
    bg: "from-violet-950/80 via-purple-950/40 to-background",
    ring: "ring-violet-500/25 hover:ring-violet-400/50",
    icon: FlaskConical,
    iconWrap: "border-violet-400/35 bg-violet-500/15 text-violet-200",
  },
  {
    value: "math",
    label: "Mathematics",
    color: "text-amber-100",
    bg: "from-amber-950/70 via-orange-950/35 to-background",
    ring: "ring-amber-500/25 hover:ring-amber-400/50",
    icon: Calculator,
    iconWrap: "border-amber-400/35 bg-amber-500/15 text-amber-200",
  },
];

const examOptions: { value: ExamType | null; label: string; emoji: string }[] = [
  { value: null, label: "CBSE", emoji: "📘" },
  { value: "JEE_Mains", label: "JEE Mains", emoji: "🎯" },
  { value: "JEE_Advance", label: "JEE Advance", emoji: "🏆" },
  { value: "KCET", label: "KCET", emoji: "📋" },
  { value: "other", label: "Other", emoji: "📝" },
];

const STUDENT_COMING_SOON_EXAMS = new Set<ExamType>(["JEE_Mains", "JEE_Advance", "KCET", "other"]);

interface SubjectChipsProps {
  onSelectSubject: (subject: Subject, exam: ExamType | null) => void;
}

export default function SubjectChips({ onSelectSubject }: SubjectChipsProps) {
  const [pendingSubject, setPendingSubject] = useState<Subject | null>(null);
  const [dialogClass, setDialogClass] = useState<ClassLevel>(11);
  const { user, profile, refreshProfile } = useAuth();

  useEffect(() => {
    if (!pendingSubject) return;
    const cl = profile?.class_level;
    setDialogClass(cl === 12 ? 12 : 11);
  }, [pendingSubject, profile?.class_level]);

  const persistStudentPrefs = async (exam: ExamType | null) => {
    if (!user?.id || profile?.role !== "student") return;
    const target_exam = examTypeToTargetExam(exam);
    const { error } = await supabase
      .from("profiles")
      .update({ class_level: dialogClass, target_exam })
      .eq("id", user.id);
    if (!error) await refreshProfile();
  };

  return (
    <>
      <section
        className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-border/60 bg-card/50 p-3 shadow-md ring-1 ring-white/[0.04] backdrop-blur-sm sm:max-w-4xl sm:rounded-2xl sm:p-4 sm:shadow-lg lg:max-w-4xl lg:p-5 [@media(max-height:760px)]:p-3 [@media(max-height:760px)]:sm:p-3"
        aria-labelledby="browse-by-subject-heading"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-30%,hsl(var(--primary)/0.08),transparent_50%)]"
          aria-hidden
        />
        <div className="relative">
          <div className="mb-3 sm:mb-4 [@media(max-height:760px)]:mb-2.5">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.16em] text-muted-foreground sm:text-[10px]">
              Start here
            </p>
            <h3
              id="browse-by-subject-heading"
              className="mt-1 text-lg font-bold tracking-tight text-foreground sm:text-xl lg:text-2xl [@media(max-height:760px)]:text-base [@media(max-height:760px)]:sm:text-lg"
            >
              Browse by subject
            </h3>
            <p className="mt-1 max-w-xl text-[11px] leading-snug text-muted-foreground sm:mt-1.5 sm:text-xs lg:text-sm [@media(max-height:760px)]:line-clamp-2 [@media(max-height:760px)]:sm:line-clamp-none">
              Pick a subject to open topics, lessons, and practice.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-2.5 lg:gap-3 [@media(max-height:760px)]:gap-2">
            {subjectList.map((s) => {
              const Icon = s.icon;
              return (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setPendingSubject(s.value)}
                  className={cn(
                    "group relative flex min-h-[72px] flex-col items-center justify-center gap-1.5 rounded-lg border bg-gradient-to-br px-3 py-3 text-center shadow-sm transition-all duration-200 sm:min-h-[84px] sm:gap-2 sm:rounded-xl sm:border-2 sm:py-3.5 lg:min-h-[92px] [@media(max-height:760px)]:min-h-[68px] [@media(max-height:760px)]:py-2.5",
                    s.bg,
                    "border-border/70 hover:-translate-y-px hover:border-primary/30 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:hover:-translate-y-0.5 sm:hover:shadow-lg",
                    s.ring
                  )}
                >
                  <span
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-xl border shadow-inner transition-transform duration-200 group-hover:scale-[1.03] sm:h-10 sm:w-10 sm:rounded-2xl lg:h-11 lg:w-11",
                      s.iconWrap
                    )}
                    aria-hidden
                  >
                    <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px] lg:h-5 lg:w-5" strokeWidth={1.75} />
                  </span>
                  <span
                    className={cn(
                      "text-sm font-bold tracking-tight sm:text-base lg:text-[1.05rem]",
                      s.color
                    )}
                  >
                    {s.label}
                  </span>
                  <span className="absolute bottom-1.5 right-1.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:bottom-2 sm:right-2 sm:text-[10px]">
                    Open →
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <Dialog
        open={!!pendingSubject}
        onOpenChange={(open) => {
          if (!open) setPendingSubject(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Choose your exam</DialogTitle>
            <DialogDescription>
              Select your exam to see relevant{" "}
              {pendingSubject ? subjectList.find((s) => s.value === pendingSubject)?.label : ""}{" "}
              topics
            </DialogDescription>
          </DialogHeader>

          {profile?.role === "student" && (
            <div className="space-y-2 pt-1">
              <p className="text-xs font-extrabold text-foreground uppercase tracking-wide">
                Class
              </p>
              <div className="flex rounded-xl border border-border/80 bg-muted/40 p-1 gap-1">
                {([11, 12] as const).map((cl) => (
                  <button
                    key={cl}
                    type="button"
                    onClick={() => setDialogClass(cl)}
                    className={cn(
                      "flex-1 py-2.5 rounded-lg text-sm font-extrabold transition-all",
                      dialogClass === cl
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
                    )}
                  >
                    Class {cl}th
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mt-2">
            {examOptions.map((exam) => {
              const isAdmin = profile?.role === "admin";
              const isComingSoonForUser =
                !isAdmin && exam.value !== null && STUDENT_COMING_SOON_EXAMS.has(exam.value);
              return (
                <button
                  key={exam.label}
                  type="button"
                  disabled={isComingSoonForUser}
                  onClick={async () => {
                    if (!pendingSubject || isComingSoonForUser) return;
                    await persistStudentPrefs(exam.value);
                    onSelectSubject(pendingSubject, exam.value);
                    setPendingSubject(null);
                  }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                    isComingSoonForUser
                      ? "border-border/60 bg-muted/30 text-muted-foreground cursor-not-allowed opacity-75"
                      : "border-border hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
                  )}
                >
                  <span className="text-xl">{exam.emoji}</span>
                  <div className="flex min-w-0 flex-col">
                    <span
                      className={cn(
                        "text-sm font-semibold transition-colors",
                        isComingSoonForUser
                          ? "text-muted-foreground"
                          : "text-foreground group-hover:text-primary"
                      )}
                    >
                      {exam.label}
                    </span>
                    {isComingSoonForUser && (
                      <span className="text-[11px] font-medium text-amber-500">Coming Soon</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
