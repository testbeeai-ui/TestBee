"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  RotateCcw,
  BookOpen,
  Check,
  Clock,
  Coins,
  ExternalLink,
  GraduationCap,
  ListChecks,
  MessageSquare,
  Newspaper,
  Sparkles,
  User,
  Users,
  Wand2,
  X,
  ArrowLeft,
  ArrowRight,
  Bolt,
  Calendar,
  Flame,
  HelpCircle,
  Lock,
  LogOut,
  Pencil,
  Trophy,
  Gift,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useIsAppAdmin } from "@/hooks/useIsAppAdmin";
import { fetchEarnBuddyOnboardingStatus } from "@/lib/onboarding/earnBuddyCompanionApi";
import { isStudentProfileBasicInfoComplete } from "@/lib/profile/studentProfileBasicInfo";
import {
  FREE_TRIAL_ACTIVATED_EVENT,
  ONBOARDING_PROGRESS_EVENT,
  ONBOARDING_REWARD_CLAIMED_EVENT,
  enableAdminManualOnboardingChecklist,
  getMergedOnboardingProgress,
  getOnboardingProgress,
  maybeMarkEarnBuddyOnboardingFromBuddyActivation,
  maybeMarkProfileOnboardingFromBasicInfo,
  resetOnboardingRewardChecklist,
  resolveFreeTrialActivatedAt,
  toggleOnboardingTaskForAdmin,
  setOnboardingRewardDismissedCooldown,
  isOnboardingTaskComplete,
  isOnboardingRewardClaimed,
} from "@/lib/subscription/freeTrialClient";
import {
  formatFreeTrialElapsedTimer,
  getFreeTrialElapsedMs,
  isFreeTrialPeriodEnded,
} from "@/lib/subscription/freeTrialTimer";
import { launchOnboardingChecklistTask } from "@/lib/onboarding/launchOnboardingChecklistTask";
import { cbseMcqOnboardingMockHubHref } from "@/lib/onboarding/cbseMcqOnboardingFlow";
import { earnChallengeOnboardingHref } from "@/lib/onboarding/earnChallengeOnboardingFlow";
import { GYAN_PLUS_ONBOARDING_HREF } from "@/lib/onboarding/gyanPlusOnboarding";
import type { OnboardingDailyTaskDoneDetail } from "@/lib/onboarding/dailyChecklistTaskStorage";
import {
  getActiveStreakDayNumber,
  getMaxReachableStreakDay,
  getStreakTrackerProgressPct,
  isStreakDayClaimed,
  isStreakDayLockedByTrialEnd,
  isWaitingForDay2Unlock,
  loadDailyChecklistCompleted,
  armDailyStreakTaskFlow,
  getLocalCalendarDateIso,
  parseDailyStreakServerState,
  reconcileDailyCbseMcqChecklistState,
  markDailyChecklistTaskDone,
  dailyCbseMcqDoneDateKey,
  ONBOARDING_DAILY_TASK_DONE_EVENT,
} from "@/lib/onboarding/dailyChecklistTaskStorage";
import { startDailyCbseMcqChecklistTracking } from "@/lib/onboarding/dailyCbseMcqChecklist";
import { startDailyLessonsChecklistTracking } from "@/lib/onboarding/dailyLessonsChecklist";
import { startDailyChecklistCompanionRetry } from "@/lib/onboarding/dailyChecklistCompanionRetry";
import { isPathRelevantForOnboardingTask } from "@/lib/onboarding/onboardingTaskCompanionRoutes";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import type { NoteColor, OnboardingTask } from "@/lib/onboarding/onboardingRewardTaskUi";
import { NOTE_COLOR_STYLES } from "@/lib/onboarding/onboardingRewardTaskUi";
import {
  ONBOARDING_CHECKLIST_COMPLETION_BONUS_RDM,
  ONBOARDING_CHECKLIST_TOTAL_RDM,
  getOnboardingTaskRdmReward,
} from "@/lib/onboarding/onboardingChecklistRdm";
import { ONBOARDING_REWARD_TASKS } from "@/lib/onboarding/onboardingRewardTasks";
import { OnboardingTaskDetailCard } from "@/components/onboarding/OnboardingTaskDetailCard";
import {
  fetchOnboardingRewardState,
  claimDailyStreakReward,
} from "@/lib/subscription/onboardingRewardApi";
import {
  mergeDailyChecklistCompleted,
  prepareDailyStreakClaim,
  resetDailyStreakDayProgress,
  ensureDailyStreakSyncRetryListeners,
} from "@/lib/onboarding/dailyStreakSync";
import {
  armDailyStreakChecklistSuppress,
  dailyStreakClaimKey,
  dispatchDailyStreakAllComplete,
  scheduleDailyStreakTomorrowModal,
} from "@/lib/onboarding/dailyStreakClient";

export type { NoteColor, OnboardingTask } from "@/lib/onboarding/onboardingRewardTaskUi";
export { ONBOARDING_REWARD_TASKS } from "@/lib/onboarding/onboardingRewardTasks";

type DailyTask = {
  id: string;
  name: string;
  sub: string;
  rdm: string;
  time: string;
  stripe: string;
  ico: string;
  icon: string;
  iwBg: string;
  rc: string;
  rb: string;
  rbd: string;
  steps: string[];
};

export const DAILY_TASKS: DailyTask[] = [
  {
    id: "t1",
    name: "Dashboard - DailyDose",
    sub: "Complete DailyDose in Play (Academic or Funbrain)",
    rdm: "+10 RDM",
    time: "~3 min",
    stripe: "#1D9E75",
    ico: "#1D9E75",
    iwBg: "#0A2A20",
    rc: "#9FE1CB",
    rb: "#0A2A20",
    rbd: "#0F6E56",
    icon: "bolt",
    steps: [
      "Open Play from the checklist.",
      "Tap DailyDose in Academic Arena or Funbrain Forge.",
      "Answer all DailyDose questions in the session.",
      "View today's leaderboard when you finish.",
    ],
  },
  {
    id: "t2",
    name: "Lessons",
    sub: "Pick a sub-topic you are studying → Mark as complete",
    rdm: "+30 RDM",
    time: "~5 min",
    stripe: "#378ADD",
    ico: "#378ADD",
    iwBg: "#0D1E30",
    rc: "#85B7EB",
    rb: "#0D1E30",
    rbd: "#1E3A52",
    icon: "book",
    steps: [
      "Open Lessons — your saved chapters are already there from Day 1.",
      "Go to any topic and sub-topic you want to study today.",
      "Read, quiz, or Instacue at your own pace (no extra setup).",
      "Tap Mark as complete when you finish that sub-topic.",
    ],
  },
  {
    id: "t3",
    name: "Prep + Mock - MCQ quiz",
    sub: "One chapter-level MCQ quiz under timed conditions",
    rdm: "+10 RDM",
    time: "~3 min",
    stripe: "#EF9F27",
    ico: "#EF9F27",
    iwBg: "#281C08",
    rc: "#FAC775",
    rb: "#281C08",
    rbd: "#4a3010",
    icon: "pencil",
    steps: [
      "Open Prep + Mock → Mock tests card → tap View all.",
      "Go to the CBSE MCQ's tab.",
      "Pick any chapter and attempt the quiz timed.",
      "Submit and review at least one answer explanation.",
    ],
  },
  {
    id: "t4",
    name: "Gyan++",
    sub: "Post a question + browse Q&A + upvote one answer",
    rdm: "+10 RDM",
    time: "~3 min",
    stripe: "#D85A30",
    ico: "#D85A30",
    iwBg: "#241008",
    rc: "#F0997B",
    rb: "#241008",
    rbd: "#5a1e08",
    icon: "help-circle",
    steps: [
      "Open Gyan++ → browse the Doubt Wall for 90 seconds.",
      "Upvote one answer you found helpful or well-written.",
      "Post one question from any topic you are currently studying.",
      "Return in 5 minutes and accept the AI answer if it helped.",
    ],
  },
  {
    id: "t5",
    name: "Earn & Learn - Mentamill",
    sub: "Complete one challenge round + post result to Wall",
    rdm: "+10 RDM",
    time: "~2 min",
    stripe: "#7F77DD",
    ico: "#7F77DD",
    iwBg: "#1A1535",
    rc: "#C4BCFF",
    rb: "#1A1535",
    rbd: "#2e2860",
    icon: "flame",
    steps: [
      "Open Earn & Learn → Mentamill.",
      "Complete one full timed speed round.",
      "Note your questions-per-minute score versus yesterday's baseline.",
      "Post your score to Magic Wall and challenge your learning buddy to beat it.",
    ],
  },
  {
    id: "t6",
    name: "News & Blog",
    sub: "Read one news article or blog post",
    rdm: "+10 RDM",
    time: "~2 min",
    stripe: "#639922",
    ico: "#639922",
    iwBg: "#131D08",
    rc: "#97C459",
    rb: "#131D08",
    rbd: "#2a4010",
    icon: "news",
    steps: [
      "Open News & Blog from the main menu.",
      "Read one exam update OR one Tips & Tricks blog post.",
      "Find one technique you can apply in today's study session.",
      "Leave a comment on the article to earn a small community bonus.",
    ],
  },
];

const REWARD_RDM = DEFAULT_RDM_CONFIG.free_trial_checklist_reward_rdm;

function taskRdmReward(task: OnboardingTask): number {
  return task.rdmReward ?? getOnboardingTaskRdmReward(task.id);
}

function sumCompletedTaskRdm(progress: Record<string, boolean>): number {
  return ONBOARDING_REWARD_TASKS.reduce((sum, task) => {
    if (!progress[task.id]) return sum;
    return sum + taskRdmReward(task);
  }, 0);
}

type OnboardingRewardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checklistRewardRdm?: number;
  /** When true, show Claim RDM CTA in the footer (all 10 tasks done). */
  allTasksComplete?: boolean;
  onRequestClaimReward?: () => void;
};

type StickyNoteProps = {
  task: OnboardingTask;
  done: boolean;
  perTaskReward: number;
  isLast: boolean;
  onOpen: () => void;
};

function StickyNote({ task, done, perTaskReward, isLast, onOpen }: StickyNoteProps) {
  const Icon = task.icon;
  const styles = NOTE_COLOR_STYLES[task.color];

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group relative flex h-[5.8rem] w-full flex-col justify-between rounded-xl border bg-slate-950/40 p-3 text-left transition-all duration-300 backdrop-blur-sm",
        "hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
        styles.border,
        styles.hoverBorder,
        done && "cursor-default hover:translate-y-0 hover:shadow-none",
        isLast && "col-span-2 sm:col-span-1 sm:col-start-2"
      )}
      aria-label={`${task.boardTitle}${done ? ", completed" : ""}`}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4 shrink-0 transition-transform group-hover:scale-110 duration-300",
            styles.icon
          )}
          aria-hidden
        />
        <span className="text-xs font-bold leading-tight text-zinc-200 group-hover:text-white transition-colors">
          {task.boardTitle}
        </span>
      </div>
      <p className="line-clamp-2 text-[10px] leading-relaxed text-zinc-400 group-hover:text-zinc-300 transition-colors">
        {task.teaser}
      </p>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[9px] font-extrabold tracking-wide uppercase transition-colors",
            styles.pillBg,
            styles.pillBorder,
            styles.pillText
          )}
        >
          <Coins className="h-2.5 w-2.5" aria-hidden />+{perTaskReward} RDM
        </span>
        <span className="flex items-center gap-0.5 text-[9px] font-extrabold uppercase tracking-widest text-zinc-500 transition-colors group-hover:text-white">
          Open
          <ExternalLink
            className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            aria-hidden
          />
        </span>
      </div>
      {done ? (
        <div
          className="absolute inset-0 flex items-center justify-center rounded-xl bg-emerald-950/20 backdrop-blur-[2px] border border-emerald-500/30"
          aria-hidden
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.4)] animate-in zoom-in-75 duration-200">
            <Check className="h-5 w-5 text-emerald-300" strokeWidth={2.5} />
          </span>
        </div>
      ) : null}
    </button>
  );
}

type TaskDetailDrawerProps = {
  task: OnboardingTask;
  done: boolean;
  perTaskReward: number;
  isAdminManualChecklist: boolean;
  onClose: () => void;
  onAdminToggle: () => void;
  onOpenTask: () => void;
};

function TaskDetailDrawer({
  task,
  done,
  perTaskReward,
  isAdminManualChecklist,
  onClose,
  onAdminToggle,
  onOpenTask,
}: TaskDetailDrawerProps) {
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent
        hideClose
        overlayClassName="z-[70]"
        onPointerDownOutside={onClose}
        onInteractOutside={onClose}
        onEscapeKeyDown={onClose}
        className={cn(
          "z-[71] flex w-[min(calc(100vw-2rem),370px)] max-w-[370px] flex-col gap-0 overflow-hidden",
          "border border-[#222a3d]/60 bg-[#070b13]/97 p-0 text-zinc-100 shadow-2xl backdrop-blur-xl sm:rounded-2xl"
        )}
      >
        <DialogTitle className="sr-only">{task.title} site tour task</DialogTitle>
        <DialogDescription className="sr-only">
          Steps to complete {task.title} and earn {perTaskReward} RDM
        </DialogDescription>
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/80 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          aria-label={`Close ${task.title} task`}
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
        <OnboardingTaskDetailCard
          task={task}
          done={done}
          perTaskReward={perTaskReward}
          variant={isAdminManualChecklist ? "admin" : "student"}
          onOpenTask={onOpenTask}
          onAdminToggle={onAdminToggle}
        />
      </DialogContent>
    </Dialog>
  );
}

export function OnboardingRewardDialog({
  open,
  onOpenChange,
  checklistRewardRdm = REWARD_RDM,
  allTasksComplete = false,
  onRequestClaimReward,
}: OnboardingRewardDialogProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const { profile, user, refreshProfile } = useAuth();
  const isAppAdmin = useIsAppAdmin();
  const isAdminManualChecklist = isAppAdmin;
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [trialTimerNow, setTrialTimerNow] = useState(
    () => Date.now() + (profile?.time_travel_offset_ms ?? 0)
  );
  const [showConfirmCloseDialog, setShowConfirmCloseDialog] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const pendingLaunchTaskIdRef = useRef<string | null>(null);
  const dailyStreakClaimRef = useRef(false);

  const trialActivatedAt = useMemo(
    () => resolveFreeTrialActivatedAt(profile),
    [profile?.free_trial_activated_at]
  );

  const trialElapsedMs = useMemo(
    () => getFreeTrialElapsedMs(trialActivatedAt, trialTimerNow, profile?.trial_second_round_activated),
    [trialActivatedAt, trialTimerNow, profile?.trial_second_round_activated]
  );

  const trialEnded = useMemo(
    () => isFreeTrialPeriodEnded(trialActivatedAt, trialTimerNow, profile?.trial_second_round_activated),
    [trialActivatedAt, trialTimerNow, profile?.trial_second_round_activated]
  );

  const [claimedLocally, setClaimedLocally] = useState(false);

  useEffect(() => {
    const onClaimed = () => {
      setClaimedLocally(true);
    };
    window.addEventListener(ONBOARDING_REWARD_CLAIMED_EVENT, onClaimed);
    return () => window.removeEventListener(ONBOARDING_REWARD_CLAIMED_EVENT, onClaimed);
  }, []);

  const isDay2Plus = useMemo(() => {
    return claimedLocally || isOnboardingRewardClaimed(profile);
  }, [profile, claimedLocally]);

  const day2UnlockTime = useMemo(() => {
    const claimedAt = profile?.onboarding_reward_claimed_at;
    if (!claimedAt) return 0;
    const claimDate = new Date(claimedAt);
    const nextDay = new Date(claimDate);
    nextDay.setDate(claimDate.getDate() + 1);
    nextDay.setHours(9, 0, 0, 0); // 9:00 AM of next day
    return nextDay.getTime();
  }, [profile?.onboarding_reward_claimed_at]);

  const isWaitingForDay2 = useMemo(() => {
    return isWaitingForDay2Unlock(profile?.onboarding_reward_claimed_at, trialTimerNow);
  }, [profile?.onboarding_reward_claimed_at, trialTimerNow]);

  const serverStreak = useMemo(
    () => parseDailyStreakServerState(profile?.free_trial_daily_streak),
    [profile?.free_trial_daily_streak]
  );

  const trialDayNumber = useMemo(() => {
    return getActiveStreakDayNumber({
      claimedAt: profile?.onboarding_reward_claimed_at,
      nowMs: trialTimerNow,
      userId: profile?.id,
      serverStreak,
    });
  }, [profile?.onboarding_reward_claimed_at, profile?.id, trialTimerNow, serverStreak]);

  const maxReachableStreakDay = useMemo(() => {
    return getMaxReachableStreakDay({
      claimedAt: profile?.onboarding_reward_claimed_at,
      nowMs: trialTimerNow,
      userId: profile?.id,
      freeTrialActivatedAt: trialActivatedAt,
      serverStreak,
    });
  }, [
    profile?.onboarding_reward_claimed_at,
    profile?.id,
    trialTimerNow,
    trialActivatedAt,
    serverStreak,
  ]);

  const streakLockedByTrialEnd = useMemo(() => {
    return isStreakDayLockedByTrialEnd({
      streakDay: trialDayNumber,
      claimedAt: profile?.onboarding_reward_claimed_at,
      nowMs: trialTimerNow,
      userId: profile?.id,
      freeTrialActivatedAt: trialActivatedAt,
      serverStreak,
    });
  }, [
    trialDayNumber,
    profile?.onboarding_reward_claimed_at,
    profile?.id,
    trialTimerNow,
    trialActivatedAt,
    serverStreak,
  ]);

  const streakProgressPct = useMemo(() => {
    return getStreakTrackerProgressPct({
      siteTourClaimed: Boolean(profile?.onboarding_reward_claimed_at),
      userId: profile?.id,
      serverStreak,
    });
  }, [profile?.onboarding_reward_claimed_at, profile?.id, serverStreak]);

  const [dailyCompleted, setDailyCompleted] = useState<string[]>([]);
  const dailyCompletedRef = useRef(dailyCompleted);
  useEffect(() => {
    dailyCompletedRef.current = dailyCompleted;
  }, [dailyCompleted]);
  const dailyAllCompleteHandledRef = useRef<number | null>(null);

  /** Stable for the whole local calendar day (timer ticks every 1s while open but this string does not). */
  const reconcileDayKey = getLocalCalendarDateIso(trialTimerNow);

  const reconcileDailyChecklistForDay = useCallback(
    (userId: string, dayNumber: number, currentList: string[]) => {
      const reconcileMs = Date.parse(`${reconcileDayKey}T12:00:00`);
      const merged = mergeDailyChecklistCompleted(
        userId,
        dayNumber,
        currentList,
        serverStreak,
        reconcileMs
      );
      return reconcileDailyCbseMcqChecklistState(
        userId,
        dayNumber,
        merged,
        reconcileMs,
        serverStreak
      );
    },
    [reconcileDayKey, serverStreak]
  );

  const applyDailyCompleted = useCallback(
    (userId: string, dayNumber: number, raw: string[]) => {
      const next = reconcileDailyChecklistForDay(userId, dayNumber, raw);
      setDailyCompleted((prev) => {
        if (prev.length === next.length && prev.every((id) => next.includes(id))) {
          return prev;
        }
        return next;
      });
    },
    [reconcileDailyChecklistForDay]
  );

  useEffect(() => {
    ensureDailyStreakSyncRetryListeners();
  }, []);

  useEffect(() => {
    dailyAllCompleteHandledRef.current = null;
  }, [trialDayNumber]);

  useEffect(() => {
    if (!profile?.id) return;
    const raw = loadDailyChecklistCompleted(profile.id, trialDayNumber);
    applyDailyCompleted(profile.id, trialDayNumber, raw);
  }, [trialDayNumber, profile?.id, applyDailyCompleted, serverStreak]);

  useEffect(() => {
    if (!open || !profile?.id) return;
    const raw = loadDailyChecklistCompleted(profile.id, trialDayNumber);
    applyDailyCompleted(profile.id, trialDayNumber, raw);
  }, [open, profile?.id, trialDayNumber, applyDailyCompleted, serverStreak]);

  const saveDailyCompleted = (completedList: string[]) => {
    setDailyCompleted(completedList);
    if (typeof window === "undefined" || !profile?.id) return;
    const key = `edublast_day_${trialDayNumber}_completed_${profile.id}`;
    window.localStorage.setItem(key, JSON.stringify(completedList));
  };

  const [activeDailyTaskId, setActiveDailyTaskId] = useState<string | null>(null);
  const activeDailyTask = useMemo(
    () => DAILY_TASKS.find((t) => t.id === activeDailyTaskId) || null,
    [activeDailyTaskId]
  );

  const [showExitWarning, setShowExitWarning] = useState(false);

  const allDailyTasksComplete = dailyCompleted.length >= DAILY_TASKS.length;

  const handleAllDailyTasksComplete = useCallback(
    async (completedList: string[]) => {
      if (!profile?.id || dailyStreakClaimRef.current) return;
      if (completedList.length < DAILY_TASKS.length) return;
      if (trialDayNumber < 2) return;
      if (streakLockedByTrialEnd) return;

      const claimKey = dailyStreakClaimKey(profile.id, trialDayNumber);
      const alreadyClaimedLocally =
        typeof window !== "undefined" && window.localStorage.getItem(claimKey) === "1";

      if (!alreadyClaimedLocally) {
        dailyStreakClaimRef.current = true;

        const prepared = await prepareDailyStreakClaim(profile.id, trialDayNumber);
        if (!prepared.ready) {
          dailyStreakClaimRef.current = false;
          toast({
            title: "Could not sync daily tasks",
            description:
              prepared.syncError === "sync_pending"
                ? "Still saving your progress — check your connection and try again."
                : "Complete all 6 tasks from the checklist, then claim again.",
            variant: "destructive",
          });
          return;
        }

        const result = await claimDailyStreakReward(trialDayNumber, completedList);
        if (!result.ok) {
          dailyStreakClaimRef.current = false;
          toast({
            title: "Could not credit daily streak RDM",
            description:
              result.error === "wrong_day" && result.expectedDay
                ? `Complete Day ${result.expectedDay} first (streak days are sequential).`
                : "Please try again in a moment.",
            variant: "destructive",
          });
          return;
        }

        if (typeof window !== "undefined") {
          window.localStorage.setItem(claimKey, "1");
        }

        if (result.amount > 0) {
          toast({
            title: `+${result.amount} RDM credited! 🎉`,
            description: `Day ${trialDayNumber} daily tasks reward added to your wallet.`,
            duration: 5000,
          });
        }
        await refreshProfile();
        armDailyStreakChecklistSuppress(profile.id, trialTimerNow);
      }

      scheduleDailyStreakTomorrowModal(profile.id, trialDayNumber, trialTimerNow);
      dispatchDailyStreakAllComplete(trialDayNumber);
      toast({
        title: "All daily tasks complete! 🎉",
        description: "Your “come back tomorrow” summary appears in about 30 seconds.",
        duration: 6000,
      });
    },
    [profile?.id, trialDayNumber, trialTimerNow, toast, refreshProfile, streakLockedByTrialEnd]
  );

  useEffect(() => {
    if (!open || !profile?.id || !allDailyTasksComplete) return;
    if (dailyAllCompleteHandledRef.current === trialDayNumber) return;
    dailyAllCompleteHandledRef.current = trialDayNumber;
    void handleAllDailyTasksComplete(dailyCompletedRef.current);
  }, [open, profile?.id, allDailyTasksComplete, trialDayNumber, handleAllDailyTasksComplete]);

  /** Launch companion + route for a Day-2+ daily task (first open or "Done — Open again"). */
  const launchDailyTaskFlow = (task: DailyTask) => {
    if (!profile?.id || trialDayNumber < 2) return;

    armDailyStreakTaskFlow({
      dailyTaskId: task.id,
      trialDayNumber,
      userId: profile.id,
    });

    let onboardingId = "";
    let href = "";

    if (task.id === "t2") {
      startDailyLessonsChecklistTracking();
      launchOnboardingChecklistTask("lessons");
      setActiveDailyTaskId(null);
      onOpenChange(false);
      router.push("/explore-1");
      return;
    }

    if (task.id === "t1") {
      startDailyChecklistCompanionRetry("t1", trialDayNumber, profile.id);
      onboardingId = "play_dailydose";
      href = "/play";
    } else if (task.id === "t3") {
      startDailyCbseMcqChecklistTracking(trialDayNumber, profile.id);
      onboardingId = "prep_mcq";
      href = cbseMcqOnboardingMockHubHref();
    } else if (task.id === "t4") {
      startDailyChecklistCompanionRetry("t4", trialDayNumber, profile.id);
      onboardingId = "gyan_plus";
      href = GYAN_PLUS_ONBOARDING_HREF;
    } else if (task.id === "t5") {
      startDailyChecklistCompanionRetry("t5", trialDayNumber, profile.id);
      onboardingId = "earn_challenge";
      href = earnChallengeOnboardingHref();
    } else if (task.id === "t6") {
      startDailyChecklistCompanionRetry("t6", trialDayNumber, profile.id);
      onboardingId = "news_blog";
      href = "/news-blog";
    }

    if (onboardingId) {
      launchOnboardingChecklistTask(onboardingId);
    }

    setActiveDailyTaskId(null);
    onOpenChange(false);

    if (href) {
      router.push(href);
    }
  };

  const handleOpenDailyTask = (task: DailyTask) => {
    launchDailyTaskFlow(task);
  };

  useEffect(() => {
    const onDailyDone = (event: Event) => {
      const detail = (event as CustomEvent<OnboardingDailyTaskDoneDetail>).detail;
      if (!detail?.userId || detail.userId !== profile?.id) return;
      if (detail.trialDayNumber !== trialDayNumber) return;
      const loaded = loadDailyChecklistCompleted(profile.id, trialDayNumber);
      applyDailyCompleted(profile.id, trialDayNumber, loaded);
      const merged = reconcileDailyChecklistForDay(profile.id, trialDayNumber, loaded);
      void refreshProfile();
      if (merged.length >= DAILY_TASKS.length) {
        if (dailyAllCompleteHandledRef.current !== trialDayNumber) {
          dailyAllCompleteHandledRef.current = trialDayNumber;
          void handleAllDailyTasksComplete(merged);
        }
      }
    };
    window.addEventListener(ONBOARDING_DAILY_TASK_DONE_EVENT, onDailyDone);
    return () => window.removeEventListener(ONBOARDING_DAILY_TASK_DONE_EVENT, onDailyDone);
  }, [
    profile?.id,
    trialDayNumber,
    handleAllDailyTasksComplete,
    reconcileDailyChecklistForDay,
    refreshProfile,
  ]);

  const resetDailyChecklist = () => {
    if (dailyCompleted.length === 0) return;
    if (!window.confirm("Reset the whole checklist? All steps will be marked incomplete.")) return;
    if (!profile?.id) return;
    void resetDailyStreakDayProgress(profile.id, trialDayNumber).then((result) => {
      if (!result.ok) {
        toast({
          title: "Could not reset on server",
          description: "Try again when you are back online.",
          variant: "destructive",
        });
        return;
      }
      saveDailyCompleted([]);
      void refreshProfile();
      toast({
        title: "Checklist reset",
        description: "All tasks are incomplete. Click a card to start again.",
        duration: 4000,
      });
    });
  };

  const syncProgress = useCallback(() => {
    setProgress(getMergedOnboardingProgress(profile));
  }, [profile]);

  const syncProgressFromServer = useCallback(() => {
    void fetchOnboardingRewardState()
      .then((state) => {
        setProgress((prev) => {
          const local = getOnboardingProgress();
          const merged = { ...local, ...state.progress };
          if (Object.keys(merged).length === 0 && Object.keys(prev).length === 0) return prev;
          return merged;
        });
      })
      .catch(() => {
        /* keep local/profile merged progress */
      });
  }, []);

  /** Stay in sync after route changes while the checklist is open (local progress updates on child pages). */
  useEffect(() => {
    if (!open) return;
    syncProgress();
    syncProgressFromServer();
  }, [open, pathname, syncProgress, syncProgressFromServer]);

  const selectedTask = useMemo(
    () => ONBOARDING_REWARD_TASKS.find((t) => t.id === selectedTaskId) ?? null,
    [selectedTaskId]
  );

  useEffect(() => {
    if (!open) {
      setSelectedTaskId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const offset = profile?.time_travel_offset_ms ?? 0;
    setTrialTimerNow(Date.now() + offset);
    const id = window.setInterval(() => {
      const currentOffset = profile?.time_travel_offset_ms ?? 0;
      setTrialTimerNow(Date.now() + currentOffset);
    }, 1000);
    return () => window.clearInterval(id);
  }, [open, profile?.time_travel_offset_ms]);

  useEffect(() => {
    if (!open) return;
    if (!trialActivatedAt && profile?.free_trial_activated) {
      void refreshProfile();
    }
  }, [open, trialActivatedAt, profile?.free_trial_activated, refreshProfile]);

  useEffect(() => {
    if (!open) return;
    const onActivated = () => setTrialTimerNow(Date.now());
    window.addEventListener(FREE_TRIAL_ACTIVATED_EVENT, onActivated);
    return () => window.removeEventListener(FREE_TRIAL_ACTIVATED_EVENT, onActivated);
  }, [open]);

  useEffect(() => {
    if (!isAdminManualChecklist) return;
    enableAdminManualOnboardingChecklist();
  }, [isAdminManualChecklist]);

  useEffect(() => {
    if (!open) return;
    syncProgress();
    syncProgressFromServer();
    if (isAdminManualChecklist) return;
    if (profile?.role === "student") {
      maybeMarkProfileOnboardingFromBasicInfo(
        isStudentProfileBasicInfoComplete(profile, user?.email),
        profile,
        user?.email
      );
    }
    void fetchEarnBuddyOnboardingStatus()
      .then((status) =>
        maybeMarkEarnBuddyOnboardingFromBuddyActivation(status.hasInvitedBuddyJoined)
      )
      .catch(() => {});
  }, [open, syncProgress, syncProgressFromServer, profile, user?.email, isAdminManualChecklist]);

  useEffect(() => {
    const onProgress = () => {
      syncProgress();
      syncProgressFromServer();
    };
    window.addEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
    return () => window.removeEventListener(ONBOARDING_PROGRESS_EVENT, onProgress);
  }, [syncProgress, syncProgressFromServer]);

  const completedCount = useMemo(
    () => ONBOARDING_REWARD_TASKS.filter((t) => isOnboardingTaskComplete(t.id, progress)).length,
    [progress]
  );
  const totalCount = ONBOARDING_REWARD_TASKS.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const earnedRdm = useMemo(() => sumCompletedTaskRdm(progress), [progress]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (selectedTaskId) {
        setSelectedTaskId(null);
        return;
      }
      setShowConfirmCloseDialog(true);
      return;
    }
    onOpenChange(next);
  };

  const handleGo = (taskId: string) => {
    launchOnboardingChecklistTask(taskId);
    syncProgress();
  };

  const handleAdminToggleTask = (taskId: string, done: boolean) => {
    toggleOnboardingTaskForAdmin(taskId, !done);
    syncProgress();
  };

  const handleAdminToggleDailyTask = useCallback(
    (taskId: string) => {
      if (!isAdminManualChecklist || !profile?.id || trialDayNumber < 2) return;
      if (dailyCompleted.includes(taskId)) return;

      if (taskId === "t3") {
        window.localStorage.setItem(
          dailyCbseMcqDoneDateKey(profile.id, trialDayNumber),
          getLocalCalendarDateIso(trialTimerNow)
        );
      }

      markDailyChecklistTaskDone(profile.id, trialDayNumber, taskId);
      const task = DAILY_TASKS.find((row) => row.id === taskId);
      toast({
        title: "Task marked complete",
        description: task
          ? `${task.name} — Day ${trialDayNumber} (${dailyCompleted.length + 1}/6)`
          : `Day ${trialDayNumber} checklist updated.`,
        duration: 2500,
      });
    },
    [
      isAdminManualChecklist,
      profile?.id,
      trialDayNumber,
      dailyCompleted,
      trialTimerNow,
      toast,
    ]
  );

  const handleResetChecklist = () => {
    const hadProgress = Object.keys(getMergedOnboardingProgress(profile)).length > 0;
    if (
      hadProgress &&
      !window.confirm(
        isAdminManualChecklist
          ? "Reset the whole checklist? All steps will be marked incomplete."
          : "Reset the whole checklist? All steps will be marked incomplete and violet hints will start fresh."
      )
    ) {
      return;
    }
    resetOnboardingRewardChecklist();
    syncProgress();
    toast({
      title: "Checklist reset",
      description: isAdminManualChecklist
        ? "All steps are incomplete. Tap a sticky note to mark complete."
        : "All steps are incomplete again. Open each task to restart.",
      duration: 4000,
    });
  };

  const finishSiteTourAfterTaskLaunch = useCallback(() => {
    pendingLaunchTaskIdRef.current = null;
    setSelectedTaskId(null);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenTaskFromDrawer = () => {
    if (!selectedTask) return;
    const taskId = selectedTask.id;
    const href = selectedTask.href;

    launchOnboardingChecklistTask(taskId);
    syncProgress();
    setSelectedTaskId(null);

    if (isPathRelevantForOnboardingTask(taskId, pathname)) {
      finishSiteTourAfterTaskLaunch();
      return;
    }

    pendingLaunchTaskIdRef.current = taskId;
    router.push(href);
  };

  useEffect(() => {
    const pendingTaskId = pendingLaunchTaskIdRef.current;
    if (!pendingTaskId || !open) return;
    if (!isPathRelevantForOnboardingTask(pendingTaskId, pathname)) return;
    finishSiteTourAfterTaskLaunch();
  }, [pathname, open, finishSiteTourAfterTaskLaunch]);

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          hideClose
          overlayClassName="z-[60]"
          onPointerDownOutside={(e) => {
            if (selectedTaskId || activeDailyTaskId) return;
            e.preventDefault();
          }}
          onInteractOutside={(e) => {
            if (selectedTaskId || activeDailyTaskId) return;
            e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (selectedTaskId) {
              setSelectedTaskId(null);
              return;
            }
            if (activeDailyTaskId) {
              setActiveDailyTaskId(null);
              return;
            }
            e.preventDefault();
            if (isDay2Plus) {
              setShowExitWarning(true);
            } else {
              setShowConfirmCloseDialog(true);
            }
          }}
          className={cn(
            "z-[61] !flex flex-col gap-0 overflow-hidden p-0 text-zinc-100 shadow-2xl backdrop-blur-xl transition-all duration-300",
            isDay2Plus
              ? "bg-[#0A0B10] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] transition-all duration-300 focus:outline-none focus-visible:outline-none"
              : "w-[min(calc(100vw-1rem),46rem)] max-w-[46rem] border border-[#222a3d]/60 bg-[#070b13]/97 ring-1 ring-white/5 sm:rounded-2xl max-h-[min(94dvh,52rem)] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
          )}
          style={
            isDay2Plus
              ? {
                  width: "min(calc(100vw - 1.5rem), 960px)",
                  height: "min(92dvh, 500px)",
                  maxWidth: "none",
                  maxHeight: "none",
                  outline: "none",
                  border: "1px solid rgba(255, 255, 255, 0.07)",
                }
              : undefined
          }
        >
          {isDay2Plus ? (
            <div className="popup daily-streak-popup w-full h-full flex flex-col justify-between">
              <DialogTitle className="sr-only">Daily Streak Checklist and Tasks</DialogTitle>
              <DialogDescription className="sr-only">
                Streak progress and daily tasks to earn RDM rewards and free trial extensions.
              </DialogDescription>
              {/* Scoped styles */}
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                .daily-streak-popup {
                  --teal: #10B981;
                  --amber: #F59E0B;
                  --purple: #818CF8;
                  --blue: #3B82F6;
                  --coral: #EF4444;
                  --green: #10B981;
                  --s1: #0A0B10;
                  --s2: rgba(255, 255, 255, 0.015);
                  --s3: rgba(255, 255, 255, 0.02);
                  --b1: rgba(255, 255, 255, 0.04);
                  --b2: rgba(255, 255, 255, 0.08);
                  --t1: #FFFFFF;
                  --t2: rgba(255, 255, 255, 0.7);
                  --t3: rgba(255, 255, 255, 0.45);
                }
                .noskip {
                  background: linear-gradient(90deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.04));
                  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                  padding: 6px 14px;
                  padding-right: 180px;
                  display: flex; align-items: center; gap: 8px;
                  font-size: 11px; color: rgba(165, 180, 252, 0.95); flex-shrink: 0;
                  line-height: 1.4;
                  font-weight: 500;
                }
                @media (max-width: 640px) {
                  .noskip {
                    padding-right: 14px;
                    padding-bottom: 34px;
                  }
                }
                .body-cols { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; }
                @media (min-width: 640px) {
                  .body-cols {
                    flex-direction: row;
                    overflow: hidden;
                  }
                }
                
                .col-left {
                  width: 100%; flex-shrink: 0;
                  padding: 14px 16px 12px;
                  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                  display: flex; flex-direction: column; gap: 10px;
                }
                @media (min-width: 640px) {
                  .col-left {
                    width: 300px;
                    flex: 0 0 300px;
                    min-height: 0;
                    overflow-x: hidden;
                    overflow-y: auto;
                    border-right: 1px solid rgba(255, 255, 255, 0.05);
                    border-bottom: none;
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255, 255, 255, 0.08) transparent;
                  }
                  .col-left::-webkit-scrollbar { width: 3px; }
                  .col-left::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.08);
                    border-radius: 20px;
                  }
                  .body-cols {
                    align-items: stretch;
                  }
                }
                .coin-row { display: flex; align-items: center; gap: 8px; }
                .coin-ico {
                  width: 28px; height: 28px; border-radius: 50%;
                  background: rgba(245, 158, 11, 0.08); border: 1.5px solid rgba(245, 158, 11, 0.3);
                  display: flex; items: center; justify-content: center; flex-shrink: 0;
                  color: #F59E0B;
                  box-shadow: 0 0 10px rgba(245, 158, 11, 0.15);
                }
                .rdm-badge {
                  background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05);
                  border-radius: 20px; padding: 4px 10px; font-size: 11px;
                  font-weight: 600; color: #E2E8F0; display: inline-flex;
                  align-items: center; gap: 4px;
                }
                .rdm-dot { width: 5px; height: 5px; border-radius: 50%; background: #10B981; box-shadow: 0 0 8px #10B981; }
                .pop-title { font-size: 16px; font-weight: 700; color: #FFFFFF; line-height: 1.3; letter-spacing: -0.01em; }
                .pop-day { font-size: 11.5px; color: rgba(255, 255, 255, 0.4); margin-top: 1px; }
                .pop-sub { font-size: 11.5px; color: rgba(255, 255, 255, 0.55); line-height: 1.5; }
                .ht { color: #818CF8; font-weight: 600; }
                .ha { color: #F59E0B; font-weight: 600; }
                .hp { color: #C084FC; font-weight: 600; }
                .ben-row { display: flex; flex-direction: column; gap: 5px; }
                .ben {
                  display: flex; align-items: center; gap: 8px;
                  font-size: 11.5px; font-weight: 500; padding: 8px 10px;
                  border-radius: 8px; background: rgba(255, 255, 255, 0.02);
                  border: 1px solid rgba(255, 255, 255, 0.04);
                   color: rgba(255, 255, 255, 0.7);
                  transition: all 0.2s ease;
                }
                .ben:hover {
                  background: rgba(255, 255, 255, 0.035);
                  border-color: rgba(255, 255, 255, 0.06);
                  color: #FFFFFF;
                }
                .ben.ba svg { color: #F59E0B; }
                .ben.bg svg { color: #10B981; }
                .ben.bp svg { color: #A855F7; }
                
                .dots-section {
                  padding-top: 2px;
                  padding-bottom: 4px;
                }
                .dots-lbl {
                  font-size: 10px;
                  color: rgba(255, 255, 255, 0.4);
                  margin-bottom: 8px;
                  text-transform: uppercase;
                  letter-spacing: 0.06em;
                  font-weight: 600;
                }
                .sbar-row {
                  display: flex;
                  align-items: center;
                  justify-content: space-between;
                  margin-bottom: 4px;
                }
                .sbar-lbl { font-size: 10.5px; color: rgba(255, 255, 255, 0.4); font-weight: 600; }
                .sbar-pct { font-size: 11.5px; font-weight: 700; color: #818CF8; }
                .sbar-track { height: 5px; background: rgba(255, 255, 255, 0.05); border-radius: 20px; overflow: hidden; }
                .sbar-fill { height: 100%; border-radius: 20px; background: linear-gradient(90deg, #6366F1, #A855F7); transition: width .3s; }
                .day-tracker-block { width: 100%; margin-top: 8px; }
                .day-dots {
                  display: grid;
                  grid-template-columns: repeat(10, minmax(0, 1fr));
                  gap: 2px;
                  width: 100%;
                  padding-bottom: 2px;
                }
                .dd-w {
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: flex-start;
                  gap: 3px;
                  min-width: 0;
                }
                .dd {
                  width: 22px;
                  height: 22px;
                  flex-shrink: 0;
                  border-radius: 6px;
                  background: rgba(255, 255, 255, 0.06);
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 10px;
                  line-height: 1;
                  font-weight: 700;
                  color: rgba(255, 255, 255, 0.55);
                  border: 1px solid rgba(255, 255, 255, 0.12);
                  transition: all 0.2s ease;
                }
                .dd.done { background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: #10B981; font-weight: 700; }
                .dd.today {
                  background: rgba(99, 102, 241, 0.15); border-color: #6366F1; color: #FFFFFF; font-weight: 700;
                  box-shadow: 0 0 8px rgba(99, 102, 241, 0.25);
                  animation: pulse-glow 2s infinite ease-in-out;
                }
                @keyframes pulse-glow {
                  0%, 100% { box-shadow: 0 0 4px rgba(99, 102, 241, 0.2); }
                  50% { box-shadow: 0 0 10px rgba(99, 102, 241, 0.4); border-color: #818CF8; }
                }
                .dd-sub {
                  font-size: 7.5px;
                  line-height: 1;
                  min-height: 9px;
                  color: rgba(255, 255, 255, 0.35);
                  text-align: center;
                  width: 100%;
                }
                @media (max-width: 420px) {
                  .day-dots { gap: 1px; }
                  .dd { width: 20px; height: 20px; font-size: 9px; border-radius: 5px; }
                  .dd-sub { font-size: 7px; }
                }
                
                .hdr-btns {
                  position: absolute;
                  top: 5px;
                  right: 12px;
                  display: flex;
                  gap: 8px;
                  align-items: center;
                  z-index: 20;
                  flex-shrink: 0;
                  width: max-content;
                  white-space: nowrap;
                }
                @media (max-width: 640px) {
                  .hdr-btns {
                    top: 26px;
                  }
                }
                .hbtn {
                  display: flex; align-items: center; gap: 4px; background: rgba(255, 255, 255, 0.02);
                  border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 6px; padding: 4px 8px;
                  font-size: 11px; font-weight: 600; color: rgba(255, 255, 255, 0.7); cursor: pointer;
                  transition: all 0.2s ease;
                  flex-shrink: 0;
                }
                .hbtn:hover { background: rgba(255, 255, 255, 0.05); border-color: rgba(255, 255, 255, 0.1); color: #FFFFFF; }
                .hbtn-exit { border-color: rgba(239, 68, 68, 0.2); color: rgba(239, 68, 68, 0.7); }
                .hbtn-exit:hover { background: rgba(239, 68, 68, 0.06); border-color: rgba(239, 68, 68, 0.35); color: #EF4444; }
                
                .col-right { flex: 1; display: flex; flex-direction: column; min-width: 0; }
                .task-scroll {
                  flex: 1; overflow-y: auto; padding: 12px 14px 8px;
                  display: flex; flex-direction: column; gap: 6px;
                  scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.06) transparent;
                }
                .task-scroll::-webkit-scrollbar { width: 3px; }
                .task-scroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 20px; }
                
                .task-row {
                  display: flex; align-items: center;
                  border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.04);
                  background: rgba(255, 255, 255, 0.015);
                  cursor: pointer;
                  overflow: hidden;
                  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .task-row:hover { border-color: rgba(99, 102, 241, 0.25); background: rgba(255, 255, 255, 0.035); transform: translateX(2px); }
                .task-row.done { background: rgba(16, 185, 129, 0.015); border-color: rgba(16, 185, 129, 0.12); }
                .task-row.done:hover { border-color: rgba(16, 185, 129, 0.25); background: rgba(16, 185, 129, 0.03); }
                .t-inner { display: flex; items: center; gap: 10px; flex: 1; padding: 9px 12px; min-width: 0; }
                .chk {
                  width: 16px; height: 16px; border-radius: 50%; border: 1.5px solid rgba(255, 255, 255, 0.2);
                  display: flex; items: center; justify-content: center; flex-shrink: 0; transition: all 0.2s ease; margin-right: 2px;
                }
                .task-row.done .chk { background: #10B981; border-color: #10B981; box-shadow: 0 0 8px rgba(16, 185, 129, 0.4); }
                .chk svg { display: none; }
                .task-row.done .chk svg { display: block; color: #fff; }
                .tsk-ico-wrapper {
                  width: 26px; height: 26px; border-radius: 6px; display: flex; items: center; justify-content: center; flex-shrink: 0;
                  background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.04); transition: all 0.2s ease;
                }
                .task-row:hover .tsk-ico-wrapper { background: rgba(99, 102, 241, 0.05); border-color: rgba(99, 102, 241, 0.15); }
                .tsk-ico { flex-shrink: 0; }
                .tsk-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
                .tsk-name { font-size: 13px; font-weight: 600; color: rgba(255, 255, 255, 0.95); transition: color 0.2s ease; }
                .task-row:hover .tsk-name { color: #FFFFFF; }
                .task-row.done .tsk-name { color: rgba(255, 255, 255, 0.8); }
                .tsk-sub { font-size: 11px; color: rgba(255, 255, 255, 0.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .task-row.done .tsk-sub { color: rgba(255, 255, 255, 0.35); }
                
                .t-right { display: flex; items: center; gap: 8px; padding: 0 12px 0 4px; flex-shrink: 0; }
                .rdm-chip {
                  display: inline-flex; align-items: center; gap: 4px; border-radius: 20px; padding: 3px 8px; font-size: 11px; font-weight: 600; white-space: nowrap;
                  background: rgba(99, 102, 241, 0.05); border: 1px solid rgba(99, 102, 241, 0.15); color: #A5B4FC; transition: all 0.2s ease;
                }
                .task-row.done .rdm-chip { background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.15); color: #6EE7B7; }
                .row-arrow {
                  color: rgba(255, 255, 255, 0.2); transition: all 0.2s ease; display: flex; items: center; justify-content: center;
                  width: 18px; height: 18px; border-radius: 4px;
                }
                .task-row:hover .row-arrow { color: #A5B4FC; transform: translateX(2px); background: rgba(99, 102, 241, 0.08); }
                
                .total-strip {
                  display: flex; items: center; justify-content: space-between;
                  background: rgba(99, 102, 241, 0.03); border-top: 1px solid rgba(255, 255, 255, 0.04);
                  padding: 7px 14px; flex-shrink: 0;
                }
                .ts-lbl { font-size: 11.5px; color: rgba(255, 255, 255, 0.45); font-weight: 500; text-transform: uppercase; letter-spacing: 0.02em; }
                .ts-val { font-size: 12.5px; font-weight: 700; color: #818CF8; display: flex; align-items: center; gap: 3px; }
                
                .pop-footer {
                  display: flex; items: center; justify-content: space-between;
                  background: rgba(255, 255, 255, 0.01); border-top: 1px solid rgba(255, 255, 255, 0.04);
                  padding: 8px 14px; flex-shrink: 0;
                }
                .fl { display: flex; align-items: center; gap: 5px; font-size: 11.5px; color: rgba(255, 255, 255, 0.4); }
                .fl svg { color: #818CF8; }
                .fcnt { font-size: 13px; font-weight: 700; color: #10B981; margin-left: 2px; }
                .fr { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
                .fr-lbl { font-size: 9.5px; color: rgba(255, 255, 255, 0.35); text-transform: uppercase; letter-spacing: 0.02em; font-weight: 600; }
                .fr-timer { font-size: 13px; font-weight: 700; color: #F59E0B; font-variant-numeric: tabular-nums; }

                /* Waiting State Scoped CSS */
                .waiting-card {
                  display: flex; flex-direction: column; align-items: center; justify-content: center;
                  padding: 24px; text-align: center; height: calc(100% - 24px);
                  background: radial-gradient(circle at center, rgba(99, 102, 241, 0.04), transparent);
                  border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.04);
                  margin: 12px; gap: 16px;
                }
                .waiting-title { font-size: 15px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.01em; }
                .waiting-desc { font-size: 11px; color: rgba(255, 255, 255, 0.55); line-height: 1.5; margin-top: 6px; max-w: 240px; }
                .unlock-timer-box {
                  background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.04);
                  border-radius: 8px; padding: 10px 14px; width: 100%; max-w: 220px; text-align: left;
                }

                /* Futuristic Details Drawer Scoped CSS */
                 .dbg {
                   position: absolute;
                   inset: 0;
                   background: rgba(3, 4, 7, 0.82);
                   backdrop-filter: blur(8px);
                   display: none;
                   align-items: center;
                   justify-content: center;
                   z-index: 200;
                   padding: 16px;
                   animation: fadeIn 0.22s ease-out;
                 }
                 .dbg.open { display: flex; }

                 /* ── Lesson Sub-topic Picker Scoped CSS ── */
                 .lpick-bg {
                   position: absolute;
                   inset: 0;
                   background: rgba(3, 4, 7, 0.86);
                   backdrop-filter: blur(10px);
                   display: none;
                   align-items: center;
                   justify-content: center;
                   z-index: 250;
                   padding: 16px;
                   animation: fadeIn 0.22s ease-out;
                 }
                 .lpick-bg.open { display: flex; }
                 .lpick-panel {
                   background: radial-gradient(circle at top right, #0F111A, #07080C);
                   border: 1px solid rgba(99, 102, 241, 0.18);
                   border-radius: 18px;
                   width: 100%;
                   max-width: 400px;
                   max-height: calc(100% - 20px);
                   display: flex;
                   flex-direction: column;
                   overflow: hidden;
                   box-shadow: 0 30px 70px rgba(0, 0, 0, 0.85), 0 0 50px rgba(99, 102, 241, 0.05);
                   animation: drawerSlideIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
                 }
                 .lpick-hdr {
                   padding: 16px 18px 12px;
                   display: flex;
                   align-items: center;
                   gap: 10px;
                   border-bottom: 1px solid rgba(255, 255, 255, 0.04);
                   flex-shrink: 0;
                 }
                 .lpick-hdr-ico {
                   width: 36px; height: 36px; border-radius: 10px;
                   background: rgba(99, 102, 241, 0.1); border: 1px solid rgba(99, 102, 241, 0.2);
                   display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                   color: #818CF8;
                 }
                 .lpick-title { font-size: 14px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.01em; flex: 1; }
                 .lpick-body {
                   padding: 14px 18px 18px;
                   overflow-y: auto;
                   flex: 1;
                   display: flex;
                   flex-direction: column;
                   gap: 10px;
                 }
                 .lpick-desc {
                   font-size: 11.5px;
                   color: rgba(255, 255, 255, 0.55);
                   line-height: 1.55;
                   margin-bottom: 2px;
                 }
                 .lpick-desc .lh { color: #10B981; font-weight: 600; }
                 .lesson-card {
                   display: flex;
                   align-items: center;
                   gap: 12px;
                   padding: 11px 14px;
                   border-radius: 12px;
                   background: rgba(255, 255, 255, 0.015);
                   border: 1px solid rgba(255, 255, 255, 0.05);
                   cursor: pointer;
                   transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                   text-decoration: none;
                 }
                 .lesson-card:hover {
                   background: rgba(99, 102, 241, 0.06);
                   border-color: rgba(99, 102, 241, 0.25);
                   transform: translateY(-1px);
                   box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
                 }
                 .lc-ico {
                   width: 36px; height: 36px; border-radius: 10px;
                   display: flex; align-items: center; justify-content: center; flex-shrink: 0;
                   font-size: 17px;
                 }
                 .lc-info { flex: 1; min-width: 0; }
                 .lc-subject {
                   display: inline-flex; align-items: center;
                   border-radius: 20px; padding: 2px 8px;
                   font-size: 9.5px; font-weight: 700; text-transform: uppercase;
                   letter-spacing: 0.04em; margin-bottom: 3px;
                 }
                 .lc-subject.phy { background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); color: #93C5FD; }
                 .lc-subject.chem { background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); color: #6EE7B7; }
                 .lc-subject.math { background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); color: #FCD34D; }
                 .lc-name { font-size: 12.5px; font-weight: 600; color: rgba(255, 255, 255, 0.9); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                 .lc-meta { font-size: 10.5px; color: rgba(255, 255, 255, 0.4); margin-top: 1px; }
                 .lc-arrow {
                   flex-shrink: 0; color: rgba(99, 102, 241, 0.5);
                   transition: all 0.2s ease;
                 }
                 .lesson-card:hover .lc-arrow { color: #818CF8; transform: translateX(2px); }
                 .lpick-divider {
                   height: 1px; background: rgba(255, 255, 255, 0.04);
                   margin: 2px 0;
                 }
                 .lpick-browse {
                   display: flex; align-items: center; justify-content: center; gap: 6px;
                   padding: 9px 14px; border-radius: 10px;
                   border: 1px solid rgba(255, 255, 255, 0.06);
                   background: transparent;
                   font-size: 12px; font-weight: 600; color: rgba(255, 255, 255, 0.5);
                   cursor: pointer; transition: all 0.2s ease;
                   width: 100%; text-decoration: none;
                 }
                 .lpick-browse:hover { background: rgba(255, 255, 255, 0.04); border-color: rgba(255, 255, 255, 0.12); color: rgba(255, 255, 255, 0.8); }

                 .drawer {
                   background: radial-gradient(circle at top right, #0F111A, #07080C);
                   border: 1px solid rgba(255, 255, 255, 0.08);
                   border-radius: 16px;
                   width: 100%;
                   max-width: 380px;
                   max-height: calc(100% - 20px);
                   display: flex;
                   flex-direction: column;
                   overflow: hidden;
                   box-shadow: 0 30px 70px rgba(0, 0, 0, 0.85), 0 0 50px rgba(99, 102, 241, 0.03);
                   animation: drawerSlideIn 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
                 }
                 @keyframes drawerSlideIn {
                   from { transform: translateY(20px) scale(0.97); opacity: 0; }
                   to { transform: translateY(0) scale(1); opacity: 1; }
                 }

                 .dh {
                   padding: 16px 18px 12px;
                   display: flex;
                   align-items: center;
                   gap: 10px;
                   border-bottom: 1px solid rgba(255, 255, 255, 0.03);
                 }

                 .diw {
                   width: 40px;
                   height: 40px;
                   border-radius: 10px;
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   flex-shrink: 0;
                   box-shadow: 0 0 15px rgba(255, 255, 255, 0.02), inset 0 0 8px rgba(255, 255, 255, 0.05);
                 }

                 .dtitle {
                   font-size: 15px;
                   font-weight: 600;
                   color: #FFFFFF;
                   letter-spacing: -0.01em;
                   margin-bottom: 2px;
                 }

                 .dpill {
                   display: inline-flex;
                   align-items: center;
                   gap: 4px;
                   border-radius: 20px;
                   padding: 2px 9px;
                   font-size: 11px;
                   font-weight: 600;
                   box-shadow: 0 0 10px rgba(16, 185, 129, 0.08);
                 }

                 .dclose {
                   margin-left: auto;
                   background: rgba(255, 255, 255, 0.02);
                   border: 1px solid rgba(255, 255, 255, 0.04);
                   border-radius: 8px;
                   color: var(--t3);
                   cursor: pointer;
                   padding: 5px;
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   transition: all 0.2s ease;
                 }
                 .dclose:hover {
                   color: #FFFFFF;
                   background: rgba(255, 255, 255, 0.06);
                   border-color: rgba(255, 255, 255, 0.1);
                 }

                 .dbody {
                   padding: 14px 18px 18px;
                   overflow-y: auto;
                   flex: 1;
                 }

                 .dtime {
                   display: inline-flex;
                   align-items: center;
                   gap: 5px;
                   background: rgba(255, 255, 255, 0.02);
                   border: 1px solid rgba(255, 255, 255, 0.04);
                   border-radius: 20px;
                   padding: 2px 8px;
                   font-size: 11px;
                   color: rgba(255, 255, 255, 0.5);
                 }

                 .dsteps {
                   display: flex;
                   flex-direction: column;
                   gap: 8px;
                   margin-bottom: 16px;
                 }

                 .dstep {
                   display: flex;
                   align-items: flex-start;
                   gap: 10px;
                   padding: 10px 12px;
                   background: rgba(255, 255, 255, 0.015);
                   border-radius: 10px;
                   border: 1px solid rgba(255, 255, 255, 0.03);
                   transition: all 0.2s ease;
                 }
                 .dstep:hover {
                   background: rgba(255, 255, 255, 0.025);
                   border-color: rgba(255, 255, 255, 0.06);
                   transform: translateY(-1px);
                 }

                 .dnum {
                   width: 20px;
                   height: 20px;
                   border-radius: 50%;
                   background: rgba(255, 255, 255, 0.03);
                   border: 1px solid rgba(255, 255, 255, 0.15);
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   flex-shrink: 0;
                   margin-top: 1px;
                 }
                 .dnum span {
                   font-size: 10.5px;
                   font-weight: 600;
                   color: rgba(255, 255, 255, 0.85);
                 }

                 .dtxt {
                   font-size: 12.5px;
                   color: rgba(255, 255, 255, 0.75);
                   line-height: 1.5;
                 }

                 .dbtn {
                   width: 100%;
                   background: linear-gradient(135deg, #10B981, #059669);
                   color: #FFFFFF;
                   border: none;
                   border-radius: 22px;
                   padding: 11px 20px;
                   font-size: 13.5px;
                   font-weight: 600;
                   letter-spacing: 0.01em;
                   cursor: pointer;
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   gap: 6px;
                   box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3), 0 0 25px rgba(16, 185, 129, 0.1);
                   transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                 }
                 .dbtn:hover {
                   filter: brightness(1.08);
                   transform: translateY(-1px);
                   box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35), 0 0 30px rgba(16, 185, 129, 0.15);
                 }
                 .dbtn:active {
                   transform: translateY(0);
                 }
                 .dbtn:disabled {
                   background: rgba(255, 255, 255, 0.02);
                   border: 1px solid rgba(255, 255, 255, 0.05);
                   color: rgba(255, 255, 255, 0.3);
                   cursor: default;
                   box-shadow: none;
                   filter: none;
                   transform: none;
                 }
                 .dbtn-primary {
                   background: linear-gradient(135deg, #8B5CF6, #6366F1) !important;
                   box-shadow: 0 4px 15px rgba(139, 92, 246, 0.3), 0 0 25px rgba(139, 92, 246, 0.1) !important;
                 }
                 .dbtn-primary:hover {
                   box-shadow: 0 6px 20px rgba(139, 92, 246, 0.35), 0 0 30px rgba(139, 92, 246, 0.15) !important;
                 }
                 .dbtn-secondary {
                   background: transparent !important;
                   border: 1.5px solid rgba(255, 255, 255, 0.12) !important;
                   color: rgba(255, 255, 255, 0.65) !important;
                   box-shadow: none !important;
                 }
                 .dbtn-secondary:hover {
                   background: rgba(255, 255, 255, 0.05) !important;
                   border-color: rgba(255, 255, 255, 0.2) !important;
                   color: #ffffff !important;
                   box-shadow: none !important;
                 }

                /* Exit warning Scoped CSS */
                 .exit-bg {
                   position: absolute;
                   inset: 0;
                   background: rgba(3, 4, 7, 0.75);
                   backdrop-filter: blur(10px);
                   display: none;
                   align-items: center;
                   justify-content: center;
                   z-index: 300;
                   padding: 16px;
                   animation: fadeIn 0.2s ease-out;
                 }
                 @keyframes fadeIn {
                   from { opacity: 0; }
                   to { opacity: 1; }
                 }
                 .exit-bg.open { display: flex; }

                 .exit-modal {
                   background: radial-gradient(circle at top left, #0D0E12, #07080B);
                   border: 1px solid rgba(239, 68, 68, 0.15);
                   border-radius: 14px;
                   width: 100%;
                   max-width: 380px;
                   padding: 24px;
                   text-align: center;
                   box-shadow: 0 24px 60px rgba(0, 0, 0, 0.8), 0 0 40px rgba(239, 68, 68, 0.04);
                   animation: scaleUp 0.22s cubic-bezier(0.16, 1, 0.3, 1);
                 }
                 @keyframes scaleUp {
                   from { transform: scale(0.96); opacity: 0; }
                   to { transform: scale(1); opacity: 1; }
                 }

                 .eico-wrapper {
                   width: 52px;
                   height: 52px;
                   border-radius: 50%;
                   background: rgba(239, 68, 68, 0.08);
                   border: 1px solid rgba(239, 68, 68, 0.2);
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   margin: 0 auto 16px;
                   box-shadow: 0 0 20px rgba(239, 68, 68, 0.15);
                 }

                 .etitle {
                   font-size: 17px;
                   font-weight: 600;
                   color: #FFFFFF;
                   letter-spacing: -0.01em;
                   margin-bottom: 8px;
                 }

                 .ebody {
                   font-size: 12.5px;
                   color: rgba(255, 255, 255, 0.65);
                   line-height: 1.6;
                   margin-bottom: 16px;
                 }
                 .ebody .w {
                   color: #EF4444;
                   font-weight: 600;
                 }

                 .eloss {
                   background: rgba(255, 255, 255, 0.015);
                   border: 1px solid rgba(255, 255, 255, 0.04);
                   border-radius: 10px;
                   padding: 12px 14px;
                   margin-bottom: 16px;
                   text-align: left;
                 }

                 .el-row {
                   display: flex;
                   align-items: center;
                   gap: 10px;
                   padding: 6px 0;
                   border-bottom: 1px solid rgba(255, 255, 255, 0.02);
                   font-size: 12px;
                   color: rgba(255, 255, 255, 0.85);
                   font-weight: 500;
                 }
                 .el-row:last-child {
                   border-bottom: none;
                 }

                 .el-dot {
                   width: 5px;
                   height: 5px;
                   border-radius: 50%;
                   background: #EF4444;
                   box-shadow: 0 0 6px #EF4444;
                   flex-shrink: 0;
                 }

                 .ebtns {
                   display: flex;
                   gap: 10px;
                   margin-top: 18px;
                 }

                 .e-stay {
                   flex: 1.2;
                   background: linear-gradient(135deg, #10B981, #059669);
                   color: #FFFFFF;
                   border: none;
                   border-radius: 20px;
                   padding: 10px 18px;
                   font-size: 12.5px;
                   font-weight: 600;
                   cursor: pointer;
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   gap: 4px;
                   box-shadow: 0 4px 12px rgba(16, 185, 129, 0.25), 0 0 20px rgba(16, 185, 129, 0.1);
                   transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                 }
                 .e-stay:hover {
                   filter: brightness(1.06);
                   transform: translateY(-1px);
                   box-shadow: 0 6px 16px rgba(16, 185, 129, 0.3), 0 0 25px rgba(16, 185, 129, 0.15);
                 }
                 .e-stay:active {
                   transform: translateY(0);
                 }

                 .e-exit {
                   flex: 1;
                   background: rgba(255, 255, 255, 0.02);
                   border: 1px solid rgba(255, 255, 255, 0.06);
                   color: rgba(255, 255, 255, 0.5);
                   border-radius: 20px;
                   padding: 10px 18px;
                   font-size: 12.5px;
                   font-weight: 500;
                   cursor: pointer;
                   transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
                 }
                 .e-exit:hover {
                   background: rgba(239, 68, 68, 0.05);
                   border-color: rgba(239, 68, 68, 0.3);
                   color: #EF4444;
                 }

                /* Spectacular Celebration Overlay Scoped CSS */
                 .celebration-overlay {
                   position: absolute;
                   inset: 0;
                   background: radial-gradient(circle at center, rgba(6, 32, 24, 0.85), rgba(3, 7, 6, 0.95));
                   backdrop-filter: blur(8px);
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   z-index: 400;
                   padding: 20px;
                   animation: fadeIn 0.3s ease-out;
                 }
                 .celebration-modal {
                   background: radial-gradient(circle at top left, #121A2A, #0A0F1A);
                   border: 1px solid rgba(16, 185, 129, 0.2);
                   border-radius: 16px;
                   max-width: 350px;
                   width: 100%;
                   padding: 24px 20px;
                   text-align: center;
                   box-shadow: 0 30px 70px rgba(0, 0, 0, 0.9), 0 0 50px rgba(16, 185, 129, 0.06);
                   animation: drawerSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
                 }
                 
                 .trophy-wrapper {
                   width: 64px;
                   height: 64px;
                   border-radius: 50%;
                   background: rgba(16, 185, 129, 0.08);
                   border: 1px solid rgba(16, 185, 129, 0.2);
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   margin: 0 auto 16px;
                   box-shadow: 0 0 25px rgba(16, 185, 129, 0.2);
                 }
                 
                 .celebration-title {
                   font-size: 18px;
                   font-weight: 700;
                   color: #FFFFFF;
                   margin-bottom: 6px;
                   letter-spacing: -0.01em;
                 }
                 .celebration-sub {
                   font-size: 12px;
                   color: rgba(255, 255, 255, 0.6);
                   margin-bottom: 16px;
                   line-height: 1.6;
                 }
                 .celebration-grid {
                   display: grid;
                   grid-template-columns: 1fr 1fr;
                   gap: 8px;
                   margin-bottom: 16px;
                 }
                 .celebration-grid-cell {
                   background: rgba(255, 255, 255, 0.015);
                   border: 1px solid rgba(255, 255, 255, 0.03);
                   border-radius: 10px;
                   padding: 10px 8px;
                   transition: all 0.2s ease;
                 }
                 .celebration-grid-cell:hover {
                   background: rgba(255, 255, 255, 0.03);
                   border-color: rgba(255, 255, 255, 0.06);
                 }
                 
                 .cell-val {
                   font-size: 18px;
                   font-weight: 700;
                 }
                 .cell-lbl {
                   font-size: 9.5px;
                   color: rgba(255, 255, 255, 0.4);
                   margin-top: 3px;
                   text-transform: uppercase;
                   letter-spacing: 0.02em;
                   font-weight: 600;
                 }
                 .celebration-footer-note {
                   background: rgba(129, 140, 248, 0.04);
                   border: 1px solid rgba(129, 140, 248, 0.08);
                   border-radius: 8px;
                   padding: 10px 12px;
                   margin-bottom: 16px;
                   font-size: 11px;
                   color: #A5B4FC;
                   line-height: 1.6;
                   text-align: left;
                 }
                 .celebration-btn {
                   width: 100%;
                   background: linear-gradient(135deg, #10B981, #059669);
                   color: #FFFFFF;
                   border: none;
                   border-radius: 22px;
                   padding: 11px;
                   font-size: 13.5px;
                   font-weight: 600;
                   cursor: pointer;
                   display: flex;
                   align-items: center;
                   justify-content: center;
                   gap: 6px;
                   box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
                   transition: all 0.2s ease;
                 }
                 .celebration-btn:hover {
                   filter: brightness(1.08);
                   transform: translateY(-1px);
                   box-shadow: 0 6px 20px rgba(16, 185, 129, 0.35);
                 }
              `,
                }}
              />

              <div className="noskip">
                <Lock size={13} aria-hidden="true" />
                <span>
                  Miss a day and you lose eligibility for the FREE trial extension and ONE Month
                  FREE bonus. Stay consistent — all tasks take under 20 minutes!
                </span>
              </div>

              <div className="hdr-btns">
                <button className="hbtn" onClick={resetDailyChecklist}>
                  <RotateCcw size={12} aria-hidden="true" />
                  <span>Reset</span>
                </button>
                <button className="hbtn hbtn-exit" onClick={() => setShowExitWarning(true)}>
                  <LogOut size={12} aria-hidden="true" />
                  <span>Exit</span>
                </button>
              </div>

              <div className="body-cols">
                {/* LEFT */}
                <div className="col-left">
                  <div className="coin-row">
                    <div className="coin-ico">
                      <Coins size={14} aria-hidden="true" />
                    </div>
                    <div className="rdm-badge">
                      <div className="rdm-dot"></div>
                      <span>+80 RDM per day</span>
                    </div>
                  </div>
                  <div>
                    <div className="pop-title">Daily tasks — Day {trialDayNumber} of 10</div>
                    <div className="pop-day">
                      {streakLockedByTrialEnd
                        ? `Trial time left — streak can reach Day ${maxReachableStreakDay} only`
                        : "One day at a time — missed calendar days don\u2019t skip ahead"}
                    </div>
                    {isAdminManualChecklist ? (
                      <p className="mt-1.5 text-[10px] font-semibold text-violet-300/90">
                        Admin: tap a circle beside a task to mark it complete instantly.
                      </p>
                    ) : null}
                  </div>
                  <div className="dots-section">
                    <div>
                      <div className="sbar-row">
                        <span className="sbar-lbl">10-day streak progress</span>
                        <span className="sbar-pct">{streakProgressPct}%</span>
                      </div>
                      <div className="sbar-track">
                        <div className="sbar-fill" style={{ width: `${streakProgressPct}%` }}></div>
                      </div>
                    </div>
                    <div className="day-tracker-block">
                      <div className="dots-lbl">Day tracker</div>
                      <div className="day-dots" aria-label="10-day trial streak">
                      {Array.from({ length: 10 }).map((_, idx) => {
                        const dayVal = idx + 1;
                        const siteTourDone = Boolean(profile?.onboarding_reward_claimed_at);
                        const isDone =
                          dayVal === 1
                            ? siteTourDone
                            : isStreakDayClaimed(profile?.id, dayVal, serverStreak);
                        const isLocked = dayVal > maxReachableStreakDay;
                        const isToday =
                          !isLocked &&
                          dayVal === trialDayNumber &&
                          !(dayVal >= 2 && allDailyTasksComplete && isDone);
                        return (
                          <div key={idx} className="dd-w">
                            <div
                              className={cn(
                                "dd",
                                isDone && "done",
                                isToday && "today",
                                isLocked && "opacity-40"
                              )}
                            >
                              {dayVal}
                            </div>
                            <div className="dd-sub">
                              {isDone ? "✓" : isToday ? "now" : isLocked ? "—" : ""}
                            </div>
                          </div>
                        );
                      })}
                      </div>
                    </div>
                  </div>
                  <div className="pop-sub">
                    Do these tasks daily to earn <span className="ha">bonus RDM</span>, keep your
                    streak alive, and qualify for an{" "}
                    <span className="ht">additional 2-week FREE trial</span> +{" "}
                    <span className="hp">ONE Month FREE</span> bonus thereafter.
                  </div>
                  <div className="ben-row">
                    <div className="ben ba">
                      <Coins size={12} aria-hidden="true" />
                      <span>Daily RDM bonus</span>
                    </div>
                    <div className="ben bg">
                      <Calendar size={12} aria-hidden="true" />
                      <span>+14 day FREE trial extension</span>
                    </div>
                    <div className="ben bp">
                      <Gift size={12} aria-hidden="true" />
                      <span>ONE Month FREE bonus</span>
                    </div>
                  </div>
                </div>

                {/* RIGHT */}
                <div className="col-right">
                  {isWaitingForDay2 ? (
                    <div className="waiting-card">
                      <Clock className="text-amber-400 animate-pulse" size={40} />
                      <div>
                        <h3 className="waiting-title">All Day 1 tasks complete! 🎉</h3>
                        <p className="waiting-desc mx-auto">
                          You have successfully finished the Site Tour onboarding. Come back
                          tomorrow at <strong className="text-violet-400">9:00 AM</strong> to unlock
                          your Day 2 tasks and continue your streak!
                        </p>
                      </div>
                      <div className="unlock-timer-box mx-auto">
                        <div className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">
                          Unlocks in
                        </div>
                        <div className="font-mono text-base font-bold text-amber-400 mt-0.5 tabular-nums">
                          {(() => {
                            const remainingMs = Math.max(0, day2UnlockTime - trialTimerNow);
                            const secs = Math.floor(remainingMs / 1000);
                            const h = Math.floor(secs / 3600);
                            const m = Math.floor((secs % 3600) / 60);
                            const s = secs % 60;
                            return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : streakLockedByTrialEnd ? (
                    <div className="waiting-card">
                      <Clock className="text-zinc-400" size={40} />
                      <div>
                        <h3 className="waiting-title">Day {trialDayNumber} isn&apos;t available</h3>
                        <p className="waiting-desc mx-auto">
                          Your free trial can still reach up to Day {maxReachableStreakDay}.
                          Complete each streak day in order — you won&apos;t skip ahead on the
                          calendar.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="task-scroll">
                        {DAILY_TASKS.map((t) => {
                          const isDone = dailyCompleted.includes(t.id);
                          const IconComponent =
                            t.icon === "bolt"
                              ? Bolt
                              : t.icon === "book"
                                ? BookOpen
                                : t.icon === "pencil"
                                  ? Pencil
                                  : t.icon === "help-circle"
                                    ? HelpCircle
                                    : t.icon === "flame"
                                      ? Flame
                                      : Newspaper;
                          return (
                            <div
                              key={t.id}
                              className={cn("task-row", isDone && "done")}
                              onClick={() => setActiveDailyTaskId(t.id)}
                            >
                              <div className="t-inner">
                                <div
                                  className={cn(
                                    "chk",
                                    isAdminManualChecklist &&
                                      !isDone &&
                                      "cursor-pointer ring-0 hover:border-violet-400/70 hover:bg-violet-500/10"
                                  )}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isAdminManualChecklist && !isDone) {
                                      handleAdminToggleDailyTask(t.id);
                                    }
                                  }}
                                  role={isAdminManualChecklist ? "checkbox" : undefined}
                                  aria-checked={isDone}
                                  aria-label={
                                    isAdminManualChecklist
                                      ? isDone
                                        ? `${t.name} completed`
                                        : `Mark ${t.name} complete (admin)`
                                      : undefined
                                  }
                                  title={
                                    isAdminManualChecklist && !isDone
                                      ? "Tap to mark complete (admin)"
                                      : undefined
                                  }
                                >
                                  <Check size={9} style={{ display: isDone ? "block" : "none" }} />
                                </div>
                                <div className="tsk-ico-wrapper">
                                  <IconComponent
                                    className="tsk-ico text-[13px]"
                                    style={{ color: t.ico }}
                                    size={13}
                                  />
                                </div>
                                <div className="tsk-body">
                                  <div className="tsk-name">{t.name}</div>
                                  <div className="tsk-sub">{t.sub}</div>
                                </div>
                              </div>
                              <div className="t-right">
                                <div
                                  className="rdm-chip"
                                  style={{
                                    background: t.rb,
                                    border: `0.5px solid ${t.rbd}`,
                                    color: t.rc,
                                  }}
                                >
                                  <Coins size={9} style={{ marginRight: "2px" }} />
                                  {t.rdm}
                                </div>
                                <div className="row-arrow">
                                  <ArrowRight size={12} />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="total-strip">
                        <span className="ts-lbl">Total RDM if all tasks done today</span>
                        <span className="ts-val">
                          <Coins
                            size={11}
                            style={{
                              marginRight: "2px",
                              display: "inline-block",
                              verticalAlign: "-1px",
                            }}
                          />
                          80 RDM
                        </span>
                      </div>
                      <div className="pop-footer">
                        <div className="fl">
                          <ListChecks size={13} aria-hidden="true" />
                          <span>Today&apos;s checklist</span>
                          <span className="fcnt">{dailyCompleted.length}/6 done</span>
                        </div>
                        <div className="fr">
                          <div className="fr-lbl">Trial timer</div>
                          <div className="fr-timer">
                            {trialActivatedAt
                              ? formatFreeTrialElapsedTimer(trialElapsedMs, profile?.trial_second_round_activated)
                              : "--:--:--"}
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Subtle violet ambient top glow */}
              <div
                className="absolute inset-0 overflow-hidden rounded-2xl pointer-events-none"
                aria-hidden
              >
                <div className="absolute -top-28 left-1/2 -translate-x-1/2 w-96 h-48 bg-violet-500/10 rounded-full blur-[80px]" />
              </div>

              <div className="shrink-0 border-b border-[#222a3d]/40 bg-slate-950/20 px-4 py-3 sm:px-5 relative z-10">
                <DialogHeader className="space-y-0 text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.15)] mt-0.5">
                        <Coins className="h-5 w-5 text-amber-400" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <span className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide uppercase text-amber-400">
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"
                            aria-hidden
                          />
                          +{ONBOARDING_CHECKLIST_TOTAL_RDM} RDM total — split by task (+
                          {ONBOARDING_CHECKLIST_COMPLETION_BONUS_RDM} bonus when all done)
                        </span>
                        <DialogTitle className="text-sm sm:text-base font-extrabold tracking-tight text-zinc-100">
                          Complete the Site Tour to Claim Your Reward
                        </DialogTitle>
                        <DialogDescription className="text-xs text-zinc-400 mt-0.5 leading-relaxed">
                          {isAdminManualChecklist ? (
                            <>
                              <span className="font-extrabold text-amber-400">Admin:</span> tap a
                              card to mark complete or open the page.
                            </>
                          ) : (
                            "Explore each task below. Tapping a card opens the steps to complete and earn RDM."
                          )}
                        </DialogDescription>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-stretch sm:items-end gap-2.5 border-t border-[#222a3d]/45 sm:border-t-0 pt-2.5 sm:pt-0">
                      <div className="flex items-center justify-end gap-3">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 rounded-lg border border-zinc-800 bg-transparent px-2.5 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 hover:bg-zinc-800 hover:text-white transition-all active:scale-[0.97]"
                          onClick={handleResetChecklist}
                        >
                          <RotateCcw className="mr-1.5 h-3 w-3" aria-hidden />
                          Reset
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleOpenChange(false)}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900/50 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
                          aria-label="Close site tour"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <p className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-wider">
                            {completedCount} of {totalCount} completed
                          </p>
                        </div>
                        <div className="h-1.5 w-[120px] overflow-hidden rounded-full bg-zinc-800/80 sm:w-[150px]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.3)] transition-all duration-500 ease-out"
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <p className="flex items-center gap-1 text-[10px] font-extrabold tracking-wider uppercase text-amber-400 mt-0.5">
                          <Coins className="h-3 w-3" aria-hidden />
                          {earnedRdm} / {checklistRewardRdm} RDM earned
                        </p>
                      </div>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="flex shrink-0 justify-center px-4 py-3 sm:px-5 relative z-10">
                <div
                  className={cn(
                    "w-full max-w-[720px] rounded-2xl border border-[#222a3d]/50 bg-[#0a0d15]/60 backdrop-blur-sm p-4",
                    "grid grid-cols-2 gap-3 sm:grid-cols-3"
                  )}
                >
                  {ONBOARDING_REWARD_TASKS.map((task, index) => (
                    <StickyNote
                      key={task.id}
                      task={task}
                      done={isOnboardingTaskComplete(task.id, progress)}
                      perTaskReward={taskRdmReward(task)}
                      isLast={index === ONBOARDING_REWARD_TASKS.length - 1}
                      onOpen={() => setSelectedTaskId(task.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="shrink-0 border-t border-[#222a3d]/40 bg-slate-950/40 px-4 py-3 relative z-10 space-y-2">
                {allTasksComplete && onRequestClaimReward ? (
                  <div className="mx-auto max-w-[720px]">
                    <Button
                      type="button"
                      onClick={onRequestClaimReward}
                      className="h-11 w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-sm font-bold text-white shadow-lg shadow-emerald-950/30 hover:from-emerald-400 hover:to-emerald-500"
                    >
                      <Sparkles className="mr-2 h-4 w-4" aria-hidden />
                      Claim {checklistRewardRdm} RDM
                    </Button>
                  </div>
                ) : null}
                <div className="mx-auto flex max-w-[720px] items-center justify-between gap-3 rounded-xl border border-[#222a3d]/60 bg-[#0d1221]/60 backdrop-blur-sm px-4 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <ListChecks className="h-4 w-4 shrink-0 text-violet-400" aria-hidden />
                    <div className="min-w-0 leading-none">
                      <p className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">
                        Checklist
                      </p>
                      <p className="font-mono text-xs sm:text-sm font-bold tabular-nums text-emerald-400 mt-0.5">
                        {completedCount} / {totalCount} completed
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    <Clock className="h-4 w-4 shrink-0 text-amber-400 animate-pulse" aria-hidden />
                    <div className="leading-none">
                      <p className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">
                        Trial timer
                      </p>
                      <p
                        className="font-mono text-xs sm:text-sm font-bold tabular-nums text-amber-400 mt-0.5"
                        aria-live="polite"
                        title={
                          trialActivatedAt
                            ? `Free trial started ${new Date(trialActivatedAt).toLocaleString()}`
                            : undefined
                        }
                      >
                        {trialActivatedAt
                          ? formatFreeTrialElapsedTimer(trialElapsedMs, profile?.trial_second_round_activated)
                          : "--:--:--"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Day 2+ Interactive Drawer Modal */}
          {activeDailyTask && (
            <div
              className="dbg open"
              onClick={(e) => e.target === e.currentTarget && setActiveDailyTaskId(null)}
            >
              <div className="drawer">
                <div className="dh">
                  <div className="diw" style={{ backgroundColor: activeDailyTask.iwBg }}>
                    {(() => {
                      const IconComp =
                        activeDailyTask.icon === "bolt"
                          ? Bolt
                          : activeDailyTask.icon === "book"
                            ? BookOpen
                            : activeDailyTask.icon === "pencil"
                              ? Pencil
                              : activeDailyTask.icon === "help-circle"
                                ? HelpCircle
                                : activeDailyTask.icon === "flame"
                                  ? Flame
                                  : Newspaper;
                      return <IconComp size={18} style={{ color: activeDailyTask.ico }} />;
                    })()}
                  </div>
                  <div>
                    <div className="dtitle">{activeDailyTask.name}</div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexWrap: "wrap",
                        marginTop: "4px",
                      }}
                    >
                      <div
                        className="dpill"
                        style={{
                          background: activeDailyTask.rb,
                          border: `0.5px solid ${activeDailyTask.rbd}`,
                          color: activeDailyTask.rc,
                        }}
                      >
                        {activeDailyTask.rdm}
                      </div>
                      <div className="dtime">
                        <Clock size={11} />
                        <span>{activeDailyTask.time}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    className="dclose"
                    onClick={() => setActiveDailyTaskId(null)}
                    aria-label="Close"
                  >
                    <X size={15} />
                  </button>
                </div>
                <div className="dbody">
                  <div className="dsteps">
                    {activeDailyTask.steps.map((step, idx) => (
                      <div key={idx} className="dstep">
                        <div className="dnum">
                          <span>{idx + 1}</span>
                        </div>
                        <div className="dtxt">{step}</div>
                      </div>
                    ))}
                  </div>
                  {dailyCompleted.includes(activeDailyTask.id) ? (
                    <div className="w-full mt-4">
                      <button
                        className="dbtn"
                        style={{
                          background: "linear-gradient(135deg, #10B981, #059669)",
                          color: "#FFFFFF",
                          border: "none",
                          cursor: "pointer",
                        }}
                        onClick={() => launchDailyTaskFlow(activeDailyTask)}
                      >
                        <Check size={14} />
                        <span>Done — Open again</span>
                      </button>
                    </div>
                  ) : (
                    <div className="w-full mt-4">
                      <button
                        className="dbtn dbtn-primary"
                        onClick={() => handleOpenDailyTask(activeDailyTask)}
                      >
                        <Check className="animate-pulse" size={14} />
                        <span>Open task — earn {activeDailyTask.rdm}!</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Day 2+ Exit Confirmation Modal */}
          {showExitWarning && (
            <div className="exit-bg open">
              <div className="exit-modal">
                <div className="eico-wrapper">
                  <AlertTriangle size={18} style={{ color: "#EF4444" }} />
                </div>
                <div className="etitle">Wait — are you sure you want to exit?</div>
                <div className="ebody">
                  If you exit now you will <span className="w">lose your streak eligibility</span>{" "}
                  for these rewards:
                </div>
                <div className="eloss">
                  <div className="el-row">
                    <div className="el-dot" />
                    <span>Additional 2-week FREE trial extension</span>
                  </div>
                  <div className="el-row">
                    <div className="el-dot" />
                    <span>ONE Month FREE bonus subscription</span>
                  </div>
                  <div className="el-row">
                    <div className="el-dot" />
                    <span>Today&apos;s RDM bonus (up to 80 RDM)</span>
                  </div>
                  <div className="el-row">
                    <div className="el-dot" />
                    <span>Streak progress towards EduFund grant</span>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "11.5px",
                    color: "var(--t3)",
                    marginBottom: "18px",
                    lineHeight: "1.6",
                  }}
                >
                  All tasks take under 20 minutes total. Complete at least 4 to keep your streak
                  alive for today.
                </div>
                <div className="ebtns">
                  <button className="e-stay" onClick={() => setShowExitWarning(false)}>
                    <ArrowLeft size={13} style={{ verticalAlign: "-1px" }} />
                    Stay &amp; continue
                  </button>
                  <button
                    className="e-exit"
                    onClick={() => {
                      setShowExitWarning(false);
                      setOnboardingRewardDismissedCooldown();
                      onOpenChange(false);
                    }}
                  >
                    Yes, exit anyway
                  </button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedTask ? (
        <TaskDetailDrawer
          task={selectedTask}
          done={isOnboardingTaskComplete(selectedTask.id, progress)}
          perTaskReward={taskRdmReward(selectedTask)}
          isAdminManualChecklist={isAdminManualChecklist}
          onClose={() => setSelectedTaskId(null)}
          onAdminToggle={() => {
            const done = isOnboardingTaskComplete(selectedTask.id, progress);
            handleAdminToggleTask(selectedTask.id, done);
          }}
          onOpenTask={handleOpenTaskFromDrawer}
        />
      ) : null}

      <Dialog open={showConfirmCloseDialog} onOpenChange={setShowConfirmCloseDialog}>
        <DialogContent
          hideClose={true}
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          className="z-[61] flex w-[min(calc(100vw-2rem),360px)] flex-col gap-4 border border-violet-500/15 bg-[#070A0F] p-6 text-center shadow-[0_24px_50px_rgba(0,0,0,0.85),0_0_30px_rgba(139,92,246,0.03)] sm:rounded-2xl animate-in fade-in-50 zoom-in-95 duration-200"
          overlayClassName="z-[60]"
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Confirm Close Reward Checklist</DialogTitle>
            <DialogDescription>
              Confirm if you really want to close the onboarding reward checklist dialog and
              temporarily hide it.
            </DialogDescription>
          </DialogHeader>
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/8 shadow-[0_0_15px_rgba(245,158,11,0.08)]">
            <Clock className="h-5 w-5 text-amber-500 animate-pulse" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Hold on! 🎁</h3>
            <p className="mt-2 text-xs leading-relaxed text-slate-300">
              Are you sure you want to lose the chance to earn{" "}
              <strong className="font-extrabold text-violet-400">{checklistRewardRdm} RDM</strong>{" "}
              and also qualify for{" "}
              <strong className="font-extrabold text-[#1D9E75]">ONE Month FREE Bonus</strong>?
            </p>
          </div>
          <div className="mt-2 flex gap-2.5">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 rounded-xl border-white/5 bg-white/2 text-xs font-bold text-slate-300 hover:bg-white/5 hover:text-white transition-all duration-200"
              onClick={() => setShowConfirmCloseDialog(false)}
            >
              No, stay!
            </Button>
            <Button
              type="button"
              className="h-10 flex-1 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-xs font-bold text-white shadow-md shadow-violet-950/30 hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-950/40 transition-all duration-200"
              onClick={() => {
                setShowConfirmCloseDialog(false);
                setOnboardingRewardDismissedCooldown();
                onOpenChange(false);
              }}
            >
              Yes, close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
