"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Book,
  BookOpen,
  Building,
  Building2,
  Calendar,
  Check,
  Coins,
  Flame,
  Gift,
  Heart,
  HelpCircle,
  Info,
  Laptop,
  ListChecks,
  Minus,
  MoreHorizontal,
  PartyPopper,
  PenLine,
  Play,
  Rocket,
  School,
  Sparkles,
  Star,
  Stethoscope,
  Trophy,
  UserCheck,
  Users,
  Video,
  X,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { activateFreeTrial, cacheFreeTrialActivatedAt } from "@/lib/subscription/freeTrialClient";
import {
  deriveObjectiveSub,
  hasSavedTrialOnboardingAnswers,
  parseTrialOnboardingAnswersFromProfile,
  type TrialObjectiveSub,
} from "@/lib/subscription/trialOnboardingAnswers";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  INITIAL_TRIAL_ONBOARDING_ANSWERS,
  TRIAL_OTHER_EDTECH_PLATFORM,
  TRIAL_OTHER_STATE_BOARD,
  TRIAL_PRIMARY_SCHOOL_ONLY,
  TRIAL_STEP_PCTS,
  type TrialOnboardingAnswers,
} from "@/components/dashboard/free-trial-onboarding/types";
import {
  displayBoard,
  displayClass,
  displayPrimaryPlatform,
  displaySecondaryPlatforms,
  hasOtherEdtechSecondary,
  isSchoolOnlyPrimary,
  isOtherStateBoard,
  validateScreen1,
  validateScreen2,
  validateScreen3,
  validateScreen4,
  type TrialValidationErrors,
} from "@/components/dashboard/free-trial-onboarding/validation";

type FreeTrialPromoDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  welcomeRdm?: number;
  checklistRewardRdm?: number;
};

function ProgressDots({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-[5px] py-3 pb-1">
      {Array.from({ length: 5 }, (_, i) => {
        const step = i + 1;
        const done = step < current;
        const active = step === current;
        return (
          <div
            key={step}
            className={cn(
              "h-1.5 rounded-full bg-[#334060] transition-all duration-200",
              done && "bg-[#1D9E75]",
              active ? "w-5 rounded" : "w-1.5"
            )}
          />
        );
      })}
    </div>
  );
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#5C6480]">
      {children}
      <span className="ml-0.5 text-[#D85A30]" aria-hidden>
        *
      </span>
      <span className="sr-only"> (required)</span>
    </p>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1.5 text-[11px] text-[#F0997B]">{message}</p>;
}

function CustomTextInput({
  id,
  label,
  placeholder,
  value,
  onChange,
  error,
  required = true,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  required?: boolean;
}) {
  return (
    <div className="mt-2.5">
      <label htmlFor={id} className="mb-1.5 block text-[11px] font-medium text-[#9BA3B8]">
        {label}
        {required ? (
          <span className="ml-0.5 text-[#D85A30]" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-lg border bg-[#1C2333] px-3 py-2.5 text-[13px] text-[#E8EAF0] placeholder:text-[#5C6480] outline-none transition-colors focus:border-[#1D9E75] focus:ring-1 focus:ring-[#1D9E75]/40",
          error ? "border-[#D85A30]" : "border-[#334060]"
        )}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[11px] text-[#F0997B]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function BenefitRow({
  icon,
  iconBg,
  iconColor,
  text,
  rdm,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  text: React.ReactNode;
  rdm?: string;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-[#2A3347]/80 py-1.5 last:border-b-0">
      <div
        className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]", iconBg)}
        style={{ color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-xs leading-snug text-[#9BA3B8]">{text}</div>
      {rdm ? (
        <span className="ml-auto shrink-0 whitespace-nowrap text-[11px] font-medium text-[#1D9E75]">
          {rdm}
        </span>
      ) : null}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border-[1.5px] border-[#334060] bg-transparent px-3.5 py-1.5 text-xs font-medium text-[#9BA3B8] transition-all hover:border-[#1D9E75] hover:text-[#1D9E75]",
        active && "border-[#1D9E75] bg-[#1D9E75] text-white hover:text-white",
        className
      )}
    >
      {children}
    </button>
  );
}

function YnBtn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 rounded-lg border-[1.5px] border-[#334060] bg-transparent px-2 py-2.5 text-center text-[13px] font-medium text-[#9BA3B8] transition-all hover:border-[#1D9E75] hover:text-[#1D9E75]",
        active && "border-[#1D9E75] bg-[#1D9E75] text-white hover:text-white"
      )}
    >
      {children}
    </button>
  );
}

function formatTrialEndDate(days = 14) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function formatTimer(elapsedSeconds: number) {
  const totalDurationSeconds = 14 * 24 * 60 * 60;
  const remainingSeconds = Math.max(0, totalDurationSeconds - elapsedSeconds);
  const days = Math.floor(remainingSeconds / 86400);
  const h = Math.floor((remainingSeconds % 86400) / 3600);
  const m = Math.floor((remainingSeconds % 3600) / 60);
  const s = remainingSeconds % 60;
  const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  if (days > 0) return `${days}d ${time}`;
  return time;
}

function summaryTargetExam(answers: TrialOnboardingAnswers) {
  if (answers.objective === "Clear Board Exams") {
    if (answers.boardExam === TRIAL_OTHER_STATE_BOARD) {
      return answers.boardExamCustom.trim() || "Other state board";
    }
    return answers.boardExam ?? "Board exams";
  }
  if (answers.objective === "Engineering entrance") {
    return answers.engExams.length > 0 ? answers.engExams.join(" + ") : "Engineering entrance";
  }
  if (answers.objective === "Medical entrance") {
    return answers.medExams.length > 0 ? answers.medExams.join(" + ") : "Medical entrance";
  }
  if (answers.objective === "Other / not sure yet") return "Full PUC syllabus";
  return "Not set";
}

export function FreeTrialPromoDialog({
  open,
  onOpenChange,
  welcomeRdm = DEFAULT_RDM_CONFIG.free_trial_welcome_rdm,
  checklistRewardRdm = DEFAULT_RDM_CONFIG.free_trial_checklist_reward_rdm,
}: FreeTrialPromoDialogProps) {
  const { profile, refreshProfile } = useAuth();
  const [screen, setScreen] = useState(0);
  const [answers, setAnswers] = useState<TrialOnboardingAnswers>(INITIAL_TRIAL_ONBOARDING_ANSWERS);
  const [objectiveSub, setObjectiveSub] = useState<TrialObjectiveSub>(null);
  const [timerStarted, setTimerStarted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [activating, setActivating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<TrialValidationErrors>({});

  const go = useCallback((n: number) => {
    setScreen(n);
    setValidationErrors({});
  }, []);

  useEffect(() => {
    if (!open) return;
    setScreen(0);
    const saved = profile?.trial_onboarding_answers;
    if (hasSavedTrialOnboardingAnswers(saved)) {
      const parsed = parseTrialOnboardingAnswersFromProfile(saved);
      setAnswers(parsed);
      setObjectiveSub(deriveObjectiveSub(parsed));
    } else {
      setAnswers(INITIAL_TRIAL_ONBOARDING_ANSWERS);
      setObjectiveSub(null);
    }
    setTimerStarted(false);
    setElapsed(0);
    setActivating(false);
    setValidationErrors({});
  }, [open, profile?.trial_onboarding_answers]);

  useEffect(() => {
    if (!timerStarted) return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [timerStarted]);

  const progressWidth = TRIAL_STEP_PCTS[screen] ?? 0;
  const trialEndDate = useMemo(() => formatTrialEndDate(14), [screen === 6]);

  const pickOne = <K extends keyof TrialOnboardingAnswers>(
    key: K,
    value: TrialOnboardingAnswers[K]
  ) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const toggleMulti = (key: "engExams" | "medExams" | "secondaryPlatforms", label: string) => {
    setAnswers((prev) => {
      const list = prev[key];
      const next = list.includes(label) ? list.filter((x) => x !== label) : [...list, label];
      return { ...prev, [key]: next };
    });
  };

  const toggleSecondaryPlatform = (label: string) => {
    setAnswers((prev) => {
      const list = prev.secondaryPlatforms;
      const removing = list.includes(label);
      const next = removing ? list.filter((x) => x !== label) : [...list, label];
      return {
        ...prev,
        secondaryPlatforms: next,
        otherEdtechPlatformName:
          label === TRIAL_OTHER_EDTECH_PLATFORM && removing ? "" : prev.otherEdtechPlatformName,
      };
    });
    setValidationErrors((prev) => {
      const next = { ...prev };
      if (label === TRIAL_OTHER_EDTECH_PLATFORM) delete next.otherEdtechPlatformName;
      return next;
    });
  };

  const handleObjectivePick = (label: string, sub: typeof objectiveSub) => {
    setAnswers((prev) => ({
      ...prev,
      objective: label,
      boardExam: null,
      boardExamCustom: "",
      engExams: [],
      medExams: [],
    }));
    setObjectiveSub(sub);
    setValidationErrors((prev) => {
      const next = { ...prev };
      delete next.objective;
      delete next.boardExam;
      delete next.boardExamCustom;
      delete next.engExams;
      delete next.medExams;
      return next;
    });
  };

  const tryAdvance = (next: number, validate: () => TrialValidationErrors) => {
    const errors = validate();
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    go(next);
  };

  useEffect(() => {
    if (screen === 6) {
      setTimerStarted(true);
    }
  }, [screen]);

  const handleEnterApp = async () => {
    if (activating) return;
    if (!timerStarted) {
      setTimerStarted(true);
      return;
    }
    setActivating(true);

    // Optimistically update client state immediately to show the checklist modal instantly!
    if (typeof window !== "undefined") {
      window.localStorage.setItem("edublast.free_trial_activated_v1", "1");
      cacheFreeTrialActivatedAt(new Date().toISOString());
      window.localStorage.removeItem("edublast.onboarding_reward_dismissed_v1");
      window.dispatchEvent(new CustomEvent("edublast-free-trial-activated"));
    }
    onOpenChange(false);

    try {
      await activateFreeTrial(answers);
      await refreshProfile();
    } catch (err) {
      console.error("Failed to activate free trial in background", err);
    } finally {
      setActivating(false);
    }
  };

  const handleOpenChange = async (nextOpen: boolean) => {
    if (!nextOpen) {
      if (screen !== 6) {
        // Strict lock: do not allow closing on onboarding questionnaire screens 0-5
        return;
      }
      // Optimistically update client state immediately if closing on the final screen
      if (typeof window !== "undefined") {
        window.localStorage.setItem("edublast.free_trial_activated_v1", "1");
        cacheFreeTrialActivatedAt(new Date().toISOString());
        window.localStorage.removeItem("edublast.onboarding_reward_dismissed_v1");
        window.dispatchEvent(new CustomEvent("edublast-free-trial-activated"));
      }
      // Run the background database activation without blocking the UI close
      void activateFreeTrial(answers).catch((err) => {
        console.error("Auto-activation failed on close", err);
      });
    }
    onOpenChange(nextOpen);
  };

  const footerNav = (
    back: number,
    next: number,
    validate?: () => TrialValidationErrors,
    options?: { showSkip?: boolean }
  ) => (
    <div className="flex items-center justify-between px-[22px] pb-5 pt-3">
      {options?.showSkip ? (
        <button
          type="button"
          className="cursor-pointer border-none bg-transparent px-2 py-1 text-[11px] text-[#5C6480] hover:text-[#9BA3B8]"
          onClick={() => go(next)}
        >
          Skip
        </button>
      ) : (
        <p className="px-2 py-1 text-[10px] text-[#5C6480]">
          <span className="text-[#D85A30]">*</span> Required fields
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          className="rounded-full border border-[#334060] bg-transparent px-4 py-2.5 text-[#9BA3B8] hover:bg-[#1C2333]"
          onClick={() => go(back)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full border border-[#334060] bg-transparent px-5 py-2.5 text-[13px] text-[#9BA3B8] hover:bg-[#1C2333]"
          onClick={() => {
            if (validate) tryAdvance(next, validate);
            else go(next);
          }}
        >
          Next <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        hideClose={true}
        onPointerDownOutside={(e) => {
          e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          e.preventDefault();
        }}
        className={cn(
          "flex max-h-[min(95dvh,800px)] w-[min(100vw-2rem,520px)] flex-col gap-0 overflow-hidden",
          "border border-[#334060] bg-[#161B25] p-0 text-[#E8EAF0] shadow-2xl sm:rounded-2xl"
        )}
      >
        <DialogTitle className="sr-only">EduBlast 14-day free trial onboarding</DialogTitle>
        <DialogDescription className="sr-only">
          Sign up confirmation, personalisation questionnaire, welcome screen and countdown timer
        </DialogDescription>

        <div className="h-[3px] overflow-hidden bg-[#2A3347]">
          <div
            className="h-full rounded-full bg-[#1D9E75] transition-all duration-300"
            style={{ width: `${progressWidth}%` }}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {screen === 0 ? (
            <>
              <div className="px-[22px] pb-0 pt-[26px] text-center">
                <div className="mx-auto mb-3 flex h-[70px] w-[70px] items-center justify-center rounded-full border-2 border-[#1D9E75] bg-[#0A2A20]">
                  <Gift className="h-[30px] w-[30px] text-[#1D9E75]" aria-hidden />
                </div>
                <div className="mx-auto mb-3 inline-flex items-center gap-1.5 rounded-full border border-[#3a2810] bg-[#281C08] px-3 py-1 text-[11px] font-medium text-[#FAC775]">
                  <span className="h-[7px] w-[7px] rounded-full bg-[#EF9F27]" />
                  {welcomeRdm} RDM welcome bonus included
                </div>
                <h2 className="text-[22px] font-medium leading-snug text-[#E8EAF0]">
                  Your 2-week FREE trial
                  <br />
                  is ready to activate
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-[#9BA3B8]">
                  No credit card needed. No charge. Cancel any time.
                  <br />
                  Your learning, your pace — for 14 days completely free.
                </p>
              </div>
              <div className="px-[22px] pt-3.5">
                <div className="mb-3.5 rounded-lg border border-[#2A3347] bg-[#1C2333] px-3.5 py-3">
                  <BenefitRow
                    icon={<Users className="h-[15px] w-[15px]" />}
                    iconBg="bg-[#0A2A20]"
                    iconColor="#1D9E75"
                    text="Full Magic Wall and Gyan++ social learning"
                  />
                  <BenefitRow
                    icon={<BookOpen className="h-[15px] w-[15px]" />}
                    iconBg="bg-[#171425]"
                    iconColor="#AFA9EC"
                    text={'Explore 2 chapters per subject "Phy, Chem, Math" + Subtopic Quiz'}
                  />
                  <BenefitRow
                    icon={<PenLine className="h-[15px] w-[15px]" />}
                    iconBg="bg-[#0D1E30]"
                    iconColor="#85B7EB"
                    text="1 full mock test per exam type (JEE, KCET, Board)"
                  />
                  <BenefitRow
                    icon={<Star className="h-[15px] w-[15px]" />}
                    iconBg="bg-[#171425]"
                    iconColor="#AFA9EC"
                    text="Instacue revision cards + MentaMill speed drills"
                  />
                  <BenefitRow
                    icon={<Heart className="h-[15px] w-[15px]" />}
                    iconBg="bg-[#281C08]"
                    iconColor="#FAC775"
                    text="EduFund grant preview — track your path to ₹3,000"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2 px-[22px] pb-5 pt-0">
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border-none bg-[#1D9E75] py-3 text-sm font-medium text-white hover:bg-[#0F6E56]"
                  onClick={() => go(1)}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  Yes — activate my free trial!
                </button>
                <p className="flex items-center justify-center gap-1.5 py-2.5 text-center text-xs text-[#9BA3B8]">
                  <span className="text-[#1D9E75]">💳</span>
                  No card information is required
                </p>
              </div>
            </>
          ) : null}

          {screen === 1 ? (
            <>
              <ProgressDots current={1} />
              <p className="mb-3.5 text-center text-[10px] uppercase tracking-[0.07em] text-[#5C6480]">
                Step 1 of 7 — tell us about yourself
              </p>
              <div className="px-[22px]">
                <h2 className="text-[19px] font-medium text-[#E8EAF0]">Which class are you in?</h2>
                <p className="mt-1 text-xs leading-relaxed text-[#9BA3B8]">
                  We personalise your chapter list, mock papers and study plan based on your class.
                </p>
              </div>
              <div className="space-y-4 px-[22px] py-4">
                <div>
                  <RequiredLabel>Class</RequiredLabel>
                  <div className="mt-2 flex gap-2">
                    {["PUC 1 / Class 11", "PUC 2 / Class 12"].map((label) => (
                      <Pill
                        key={label}
                        active={answers.classLevel === label}
                        onClick={() => {
                          pickOne("classLevel", label);
                          setValidationErrors((prev) => {
                            const next = { ...prev };
                            delete next.classLevel;
                            return next;
                          });
                        }}
                        className="flex-1 justify-center py-3.5 text-[13px]"
                      >
                        {label.includes("11") ? "①" : "②"} {label}
                      </Pill>
                    ))}
                  </div>
                  <FieldError message={validationErrors.classLevel} />
                </div>
                <div className="h-px bg-[#2A3347]" />
                <div>
                  <RequiredLabel>School board</RequiredLabel>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {["CBSE", "Karnataka State Board", TRIAL_OTHER_STATE_BOARD].map((label) => (
                      <Pill
                        key={label}
                        active={answers.board === label}
                        onClick={() => {
                          pickOne("board", label);
                          if (!isOtherStateBoard(label)) pickOne("boardCustom", "");
                          setValidationErrors((prev) => {
                            const next = { ...prev };
                            delete next.board;
                            delete next.boardCustom;
                            return next;
                          });
                        }}
                        className="px-2.5 py-1 text-[11px]"
                      >
                        {label}
                      </Pill>
                    ))}
                  </div>
                  <FieldError message={validationErrors.board} />
                  {isOtherStateBoard(answers.board) ? (
                    <CustomTextInput
                      id="trial-board-custom"
                      label="Enter your state board name"
                      placeholder="e.g. Maharashtra State Board, Tamil Nadu State Board"
                      value={answers.boardCustom}
                      onChange={(value) => {
                        pickOne("boardCustom", value);
                        setValidationErrors((prev) => {
                          const next = { ...prev };
                          delete next.boardCustom;
                          return next;
                        });
                      }}
                      error={validationErrors.boardCustom}
                    />
                  ) : null}
                </div>
              </div>
              {footerNav(0, 2, () => validateScreen1(answers))}
            </>
          ) : null}

          {screen === 2 ? (
            <>
              <ProgressDots current={2} />
              <p className="mb-3.5 text-center text-[10px] uppercase tracking-[0.07em] text-[#5C6480]">
                Step 2 of 7 — your exam goal
              </p>
              <div className="px-[22px]">
                <h2 className="text-[19px] font-medium text-[#E8EAF0]">
                  What is your primary objective?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#9BA3B8]">
                  Choose your main exam goal — you can add more after sign-up. This sets your
                  default mock paper and syllabus mapping.
                </p>
              </div>
              <div className="space-y-3 px-[22px] py-4">
                <div>
                  <RequiredLabel>Primary target</RequiredLabel>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      {
                        label: "Clear Board Exams",
                        sub: "sub-board" as const,
                        icon: <Award className="h-[15px] w-[15px]" />,
                      },
                      {
                        label: "Engineering entrance",
                        sub: "sub-eng" as const,
                        icon: <Building2 className="h-[15px] w-[15px]" />,
                      },
                      {
                        label: "Medical entrance",
                        sub: "sub-med" as const,
                        icon: <Stethoscope className="h-[15px] w-[15px]" />,
                      },
                      {
                        label: "Other / not sure yet",
                        sub: "sub-other" as const,
                        icon: <MoreHorizontal className="h-[15px] w-[15px]" />,
                      },
                    ].map(({ label, sub, icon }) => (
                      <Pill
                        key={label}
                        active={answers.objective === label}
                        onClick={() => handleObjectivePick(label, sub)}
                      >
                        {icon} {label}
                      </Pill>
                    ))}
                  </div>
                  <FieldError message={validationErrors.objective} />
                </div>
                {objectiveSub === "sub-board" ? (
                  <div className="mt-3">
                    <RequiredLabel>Which board exam?</RequiredLabel>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {["CBSE Class 12", "Karnataka Board (PUC 2)", TRIAL_OTHER_STATE_BOARD].map(
                        (label) => (
                          <Pill
                            key={label}
                            active={answers.boardExam === label}
                            onClick={() => {
                              pickOne("boardExam", label);
                              if (label !== TRIAL_OTHER_STATE_BOARD) {
                                pickOne("boardExamCustom", "");
                              }
                              setValidationErrors((prev) => {
                                const next = { ...prev };
                                delete next.boardExam;
                                delete next.boardExamCustom;
                                return next;
                              });
                            }}
                            className="px-2.5 py-1 text-[11px]"
                          >
                            {label}
                          </Pill>
                        )
                      )}
                    </div>
                    <FieldError message={validationErrors.boardExam} />
                    {answers.boardExam === TRIAL_OTHER_STATE_BOARD ? (
                      <CustomTextInput
                        id="trial-board-exam-custom"
                        label="Enter your board exam name"
                        placeholder="e.g. Maharashtra HSC, Tamil Nadu Class 12"
                        value={answers.boardExamCustom}
                        onChange={(value) => {
                          pickOne("boardExamCustom", value);
                          setValidationErrors((prev) => {
                            const next = { ...prev };
                            delete next.boardExamCustom;
                            return next;
                          });
                        }}
                        error={validationErrors.boardExamCustom}
                      />
                    ) : null}
                  </div>
                ) : null}
                {objectiveSub === "sub-eng" ? (
                  <div className="mt-3">
                    <RequiredLabel>Which entrance exam?</RequiredLabel>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {[
                        "JEE Main",
                        "JEE Advanced",
                        "BITSAT",
                        "KCET",
                        "MHT-CET",
                        "Other state CET",
                      ].map((label) => (
                        <Pill
                          key={label}
                          active={answers.engExams.includes(label)}
                          onClick={() => {
                            toggleMulti("engExams", label);
                            setValidationErrors((prev) => {
                              const next = { ...prev };
                              delete next.engExams;
                              return next;
                            });
                          }}
                          className="px-2.5 py-1 text-[11px]"
                        >
                          {label}
                        </Pill>
                      ))}
                    </div>
                    <FieldError message={validationErrors.engExams} />
                  </div>
                ) : null}
                {objectiveSub === "sub-med" ? (
                  <div className="mt-3">
                    <RequiredLabel>Which entrance exam?</RequiredLabel>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {["NEET-UG", "AIIMS", "State medical CET"].map((label) => (
                        <Pill
                          key={label}
                          active={answers.medExams.includes(label)}
                          onClick={() => {
                            toggleMulti("medExams", label);
                            setValidationErrors((prev) => {
                              const next = { ...prev };
                              delete next.medExams;
                              return next;
                            });
                          }}
                          className="px-2.5 py-1 text-[11px]"
                        >
                          {label}
                        </Pill>
                      ))}
                    </div>
                    <FieldError message={validationErrors.medExams} />
                  </div>
                ) : null}
                {objectiveSub === "sub-other" ? (
                  <p className="mt-3 rounded-lg border border-[#2A3347] bg-[#1C2333] px-3 py-2.5 text-xs text-[#9BA3B8]">
                    No problem — EduBlast covers the full PUC 1 and PUC 2 syllabus across Physics,
                    Chemistry and Maths. You can set your target exam anytime in your profile.
                  </p>
                ) : null}
              </div>
              {footerNav(1, 3, () => validateScreen2(answers, objectiveSub))}
            </>
          ) : null}

          {screen === 3 ? (
            <>
              <ProgressDots current={3} />
              <p className="mb-3.5 text-center text-[10px] uppercase tracking-[0.07em] text-[#5C6480]">
                Step 3 of 7 — your learning setup
              </p>
              <div className="px-[22px]">
                <h2 className="text-[19px] font-medium text-[#E8EAF0]">
                  How are you studying right now?
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#9BA3B8]">
                  EduBlast works alongside any approach. Telling us your setup helps us personalise
                  your schedule and suggestions.
                </p>
              </div>
              <div className="space-y-4 px-[22px] py-4">
                <div>
                  <RequiredLabel>Primary learning platform</RequiredLabel>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[
                      { label: "Self-study", icon: <Book className="h-3 w-3" /> },
                      { label: "Personal tutor", icon: <UserCheck className="h-3 w-3" /> },
                      { label: "Mentor", icon: <Star className="h-3 w-3" /> },
                      { label: TRIAL_PRIMARY_SCHOOL_ONLY, icon: <School className="h-3 w-3" /> },
                    ].map(({ label, icon }) => (
                      <Pill
                        key={label}
                        active={answers.primaryPlatform === label}
                        onClick={() => {
                          setAnswers((prev) => ({
                            ...prev,
                            primaryPlatform: label,
                            schoolName:
                              label === TRIAL_PRIMARY_SCHOOL_ONLY ? prev.schoolName : "",
                          }));
                          setValidationErrors((prev) => {
                            const next = { ...prev };
                            delete next.primaryPlatform;
                            return next;
                          });
                        }}
                        className="px-2.5 py-1 text-[11px]"
                      >
                        {icon} {label}
                      </Pill>
                    ))}
                  </div>
                  <FieldError message={validationErrors.primaryPlatform} />
                </div>
                {isSchoolOnlyPrimary(answers) ? (
                  <CustomTextInput
                    id="trial-school-name"
                    label="Which school do you attend?"
                    placeholder="e.g. Delhi Public School, Kendriya Vidyalaya"
                    value={answers.schoolName}
                    required={false}
                    onChange={(value) => pickOne("schoolName", value)}
                  />
                ) : null}
                <div className="h-px bg-[#2A3347]" />
                <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#5C6480]">
                  Secondary / additional platform (select all that apply)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Coaching class", icon: <Building className="h-3 w-3" /> },
                    { label: TRIAL_OTHER_EDTECH_PLATFORM, icon: <Laptop className="h-3 w-3" /> },
                    { label: "YouTube channels", icon: <Video className="h-3 w-3" /> },
                    { label: "None — only EduBlast", icon: <X className="h-3 w-3" /> },
                  ].map(({ label, icon }) => (
                    <Pill
                      key={label}
                      active={answers.secondaryPlatforms.includes(label)}
                      onClick={() => toggleSecondaryPlatform(label)}
                      className="px-2.5 py-1 text-[11px]"
                    >
                      {icon} {label}
                    </Pill>
                  ))}
                </div>
                {hasOtherEdtechSecondary(answers) ? (
                  <CustomTextInput
                    id="trial-other-edtech-name"
                    label="Share the name of the EdTech platform"
                    placeholder="e.g. Physics Wallah, Unacademy, BYJU'S"
                    value={answers.otherEdtechPlatformName}
                    onChange={(value) => {
                      pickOne("otherEdtechPlatformName", value);
                      setValidationErrors((prev) => {
                        const next = { ...prev };
                        delete next.otherEdtechPlatformName;
                        return next;
                      });
                    }}
                    error={validationErrors.otherEdtechPlatformName}
                  />
                ) : null}
                <div className="h-px bg-[#2A3347]" />
                <p className="text-[11px] font-medium uppercase tracking-[0.07em] text-[#5C6480]">
                  Planned study hours per week
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {["5 hrs", "10 hrs", "20 hrs", "40 hrs", "40+ hrs"].map((label) => (
                    <Pill
                      key={label}
                      active={answers.studyHours === label}
                      onClick={() => pickOne("studyHours", label)}
                      className="px-2.5 py-1 text-[11px]"
                    >
                      {label}
                    </Pill>
                  ))}
                </div>
              </div>
              {footerNav(2, 4, () => validateScreen3(answers))}
            </>
          ) : null}

          {screen === 4 ? (
            <>
              <ProgressDots current={4} />
              <p className="mb-3.5 text-center text-[10px] uppercase tracking-[0.07em] text-[#5C6480]">
                Step 4 of 7 — your experience
              </p>
              <div className="px-[22px]">
                <h2 className="text-[19px] font-medium text-[#E8EAF0]">A few quick questions</h2>
                <p className="mt-1 text-xs leading-relaxed text-[#9BA3B8]">
                  Your answers help us tailor the first week of your trial to feel familiar — or
                  wonderfully new.
                </p>
              </div>
              <div className="space-y-4 px-[22px] py-4 pb-2">
                <div>
                  <RequiredLabel>
                    Have you used an AI-driven learning platform before?
                  </RequiredLabel>
                  <div className="mt-2 flex gap-2">
                    <YnBtn
                      active={answers.usedAi === true}
                      onClick={() => {
                        pickOne("usedAi", true);
                        setValidationErrors((prev) => {
                          const next = { ...prev };
                          delete next.usedAi;
                          return next;
                        });
                      }}
                    >
                      <Check className="mr-1 inline h-3.5 w-3.5" />
                      Yes — I have used one
                    </YnBtn>
                    <YnBtn
                      active={answers.usedAi === false}
                      onClick={() => {
                        pickOne("usedAi", false);
                        setValidationErrors((prev) => {
                          const next = { ...prev };
                          delete next.usedAi;
                          return next;
                        });
                      }}
                    >
                      <Sparkles className="mr-1 inline h-3.5 w-3.5" />
                      This is my first time!
                    </YnBtn>
                  </div>
                  <FieldError message={validationErrors.usedAi} />
                </div>
                <div>
                  <RequiredLabel>
                    Have you studied PUC syllabus using Education Social Media — learning while
                    scrolling?
                  </RequiredLabel>
                  <div className="mt-2 flex gap-2">
                    <YnBtn
                      active={answers.usedSocMed === true}
                      onClick={() => {
                        pickOne("usedSocMed", true);
                        setValidationErrors((prev) => {
                          const next = { ...prev };
                          delete next.usedSocMed;
                          return next;
                        });
                      }}
                    >
                      <Check className="mr-1 inline h-3.5 w-3.5" />
                      Yes, I have
                    </YnBtn>
                    <YnBtn
                      active={answers.usedSocMed === false}
                      onClick={() => {
                        pickOne("usedSocMed", false);
                        setValidationErrors((prev) => {
                          const next = { ...prev };
                          delete next.usedSocMed;
                          return next;
                        });
                      }}
                    >
                      <HelpCircle className="mr-1 inline h-3.5 w-3.5" />
                      No — sounds interesting!
                    </YnBtn>
                  </div>
                  <FieldError message={validationErrors.usedSocMed} />
                </div>
                <div>
                  <RequiredLabel>
                    Would you like gamification and rewards while learning?
                  </RequiredLabel>
                  <div className="mt-2 flex gap-2">
                    <YnBtn
                      active={answers.wantsGamification === true}
                      onClick={() => {
                        pickOne("wantsGamification", true);
                        setValidationErrors((prev) => {
                          const next = { ...prev };
                          delete next.wantsGamification;
                          return next;
                        });
                      }}
                    >
                      <Trophy className="mr-1 inline h-3.5 w-3.5" />
                      Yes — I love rewards!
                    </YnBtn>
                    <YnBtn
                      active={answers.wantsGamification === false}
                      onClick={() => {
                        pickOne("wantsGamification", false);
                        setValidationErrors((prev) => {
                          const next = { ...prev };
                          delete next.wantsGamification;
                          return next;
                        });
                      }}
                    >
                      <Minus className="mr-1 inline h-3.5 w-3.5" />
                      Maybe, I will try!
                    </YnBtn>
                  </div>
                  <FieldError message={validationErrors.wantsGamification} />
                </div>
              </div>
              {footerNav(3, 5, () => validateScreen4(answers))}
            </>
          ) : null}

          {screen === 5 ? (
            <>
              <ProgressDots current={5} />
              <p className="mb-3.5 text-center text-[10px] uppercase tracking-[0.07em] text-[#5C6480]">
                Almost done — review your profile
              </p>
              <div className="px-[22px]">
                <h2 className="text-[19px] font-medium text-[#E8EAF0]">
                  Your EduBlast profile is ready
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-[#9BA3B8]">
                  We&apos;ve personalised your 14-day trial based on your answers. Here&apos;s a
                  quick summary — you can always update these in Settings.
                </p>
              </div>
              <div className="space-y-3 px-[22px] py-4">
                <div className="rounded-lg border border-[#2A3347] bg-[#1C2333] px-3.5 py-3">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.06em] text-[#5C6480]">
                    Your setup at a glance
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        label: "Class",
                        value:
                          displayClass(answers) === "—" && displayBoard(answers) === "—"
                            ? "—"
                            : `${displayClass(answers)} · ${displayBoard(answers)}`,
                      },
                      { label: "Target exam", value: summaryTargetExam(answers) },
                      { label: "Primary learning", value: displayPrimaryPlatform(answers) },
                      {
                        label: "Also using",
                        value: displaySecondaryPlatforms(answers),
                      },
                      { label: "Study hours/week", value: answers.studyHours ?? "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg bg-[#222A3A] px-2.5 py-2">
                        <div className="mb-0.5 text-[10px] text-[#5C6480]">{label}</div>
                        <div className="text-[13px] font-medium text-[#E8EAF0]">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-lg border border-[#0F6E56] bg-[#0A2A20] px-3.5 py-2.5">
                  <Coins className="h-5 w-5 shrink-0 text-[#1D9E75]" />
                  <div>
                    <p className="text-xs font-medium text-[#9FE1CB]">
                      {welcomeRdm} RDM welcome bonus
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#1D9E75]">
                      Credited the moment you press Start — use it to reach EduFund grants faster.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2 rounded-lg border border-[#3a2810] bg-[#281C08] px-3.5 py-2.5">
                  <Info className="mt-0.5 h-[15px] w-[15px] shrink-0 text-[#EF9F27]" />
                  <p className="text-[11px] leading-relaxed text-[#FAC775]">
                    Your trial is{" "}
                    <strong className="text-[#E8EAF0]">completely free for 14 days</strong>. No
                    credit card required. If you miss a day, 50 RDM is gently deducted — but your
                    balance can never go below zero. Your full history is kept for 30 days after any
                    subscription ends.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 px-[22px] pb-5 pt-0">
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border-none bg-[#1D9E75] py-3 text-[15px] font-medium text-white hover:bg-[#0F6E56]"
                  onClick={() => go(6)}
                >
                  <Rocket className="h-[17px] w-[17px]" aria-hidden />
                  Start my free trial — let&apos;s go!
                </button>
                <button
                  type="button"
                  className="cursor-pointer border-none bg-transparent py-1 text-[11px] text-[#5C6480] hover:text-[#9BA3B8]"
                  onClick={() => go(4)}
                >
                  <ArrowLeft className="mr-1 inline h-3 w-3" />
                  Back to edit answers
                </button>
              </div>
            </>
          ) : null}

          {screen === 6 ? (
            <div className="px-[22px] py-[20px] text-center">
              <div className="mx-auto mb-2.5 flex h-[72px] w-[72px] items-center justify-center rounded-full border-[2.5px] border-[#1D9E75] bg-[#0A2A20]">
                <PartyPopper className="h-7 w-7 text-[#1D9E75]" aria-hidden />
              </div>
              <h2 className="text-[20px] font-medium text-[#E8EAF0]">Welcome to EduBlast!</h2>
              <p className="mx-auto mb-3 max-w-md text-xs leading-relaxed text-[#9BA3B8]">
                Your 14-day free trial is now live. Your {welcomeRdm} RDM welcome bonus has
                been credited. Press OK to enter and your countdown begins.
              </p>
              <div className="mb-2.5 flex items-center gap-2.5 rounded-lg border border-[#1D9E75] bg-gradient-to-r from-[#0A2A20] to-[#171425] px-3 py-2 text-left">
                <div className="text-[24px] font-medium leading-none text-[#9FE1CB]">14</div>
                <div className="flex-1">
                  <p className="text-[12px] font-medium text-[#E8EAF0]">
                    Days remaining in your free trial
                  </p>
                  <p className="mt-0.5 text-[10px] text-[#5C6480]">Trial ends: {trialEndDate}</p>
                </div>
                <Calendar className="h-4 w-4 shrink-0 text-[#9FE1CB]" />
              </div>
              <div className="mb-2.5 flex flex-col items-center gap-1 rounded-lg border border-[#2A3347] bg-[#1C2333] px-3.5 py-2.5">
                <p className="text-[10px] text-[#5C6480]">Trial countdown timer</p>
                <p className="text-[30px] font-medium tabular-nums tracking-wide text-[#1D9E75]">
                  {formatTimer(elapsed)}
                </p>
                <p
                  className={cn("text-[10px]", timerStarted ? "text-[#1D9E75]" : "text-[#5C6480]")}
                >
                  {timerStarted
                    ? "Trial countdown active — your Day 1 journey has begun."
                    : "Press OK below to start your trial countdown"}
                </p>
              </div>
              <div className="mb-3 rounded-lg border border-[#2A3347] bg-[#1C2333] px-3 py-2.5 text-left">
                <BenefitRow
                  icon={<ListChecks className="h-3.5 w-3.5" />}
                  iconBg="bg-[#0A2A20]"
                  iconColor="#1D9E75"
                  text={
                    <>
                      <strong className="text-[#E8EAF0]">Day 1 task:</strong> Show me ways to earn
                      bonuses everyday!
                    </>
                  }
                  rdm={`+${checklistRewardRdm} RDM`}
                />
                <BenefitRow
                  icon={<Calendar className="h-3.5 w-3.5" />}
                  iconBg="bg-[#171425]"
                  iconColor="#AFA9EC"
                  text={
                    <>
                      I want to do daily task for continuous 7 Days to earn additional{" "}
                      <strong className="text-[#E8EAF0]">FREE 2-Week Trial (Streak Bonus)</strong>
                    </>
                  }
                  rdm="+2 weeks"
                />
                <BenefitRow
                  icon={<Flame className="h-3.5 w-3.5" />}
                  iconBg="bg-[#0D1E30]"
                  iconColor="#85B7EB"
                  text={
                    <>
                      Complete all 14 days uninterrupted → earn a{" "}
                      <strong className="text-[#E8EAF0]">free month extension</strong>
                    </>
                  }
                  rdm="+1 month"
                />
                <BenefitRow
                  icon={<Heart className="h-3.5 w-3.5" />}
                  iconBg="bg-[#281C08]"
                  iconColor="#FAC775"
                  text={
                    <>
                      <strong className="text-[#E8EAF0]">Unlock my journey</strong> → for EduFund
                      Sprout Grant (₹3,000). Conditions apply - check under EduFund menu
                    </>
                  }
                  rdm="₹3,000"
                />
              </div>
              <button
                type="button"
                disabled={activating}
                className={cn(
                  "flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-full border-none py-2.5 text-sm font-medium text-white",
                  timerStarted ? "bg-[#0F6E56]" : "bg-[#1D9E75] hover:bg-[#0F6E56]"
                )}
                onClick={() => void handleEnterApp()}
              >
                {timerStarted ? (
                  <>
                    <Check className="h-4 w-4" aria-hidden />
                    Timer running — enjoy EduBlast!
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" aria-hidden />
                    OK — enter EduBlast now!
                  </>
                )}
              </button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
