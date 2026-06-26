import {
  BookOpen,
  Coins,
  GraduationCap,
  MessageSquare,
  Newspaper,
  Sparkles,
  User,
  Users,
  Wand2,
} from "lucide-react";
import type { OnboardingTask } from "@/lib/onboarding/onboardingRewardTaskUi";
import { ONBOARDING_REWARD_TASKS_DATA } from "@/lib/onboarding/onboardingRewardTasksData";
import { getOnboardingTaskRdmReward } from "@/lib/onboarding/onboardingChecklistRdm";

const ONBOARDING_TASK_ICONS: Record<string, typeof Wand2> = {
  magic_wall: Wand2,
  lessons: BookOpen,
  prep_classes: GraduationCap,
  prep_mcq: GraduationCap,
  gyan_plus: MessageSquare,
  earn_buddy: Users,
  earn_challenge: Sparkles,
  news_blog: Newspaper,
  edufund: Coins,
  profile: User,
};

/** Day-1 checklist tasks with Lucide icons — shared by dialog, carousel, and next-task helpers. */
export const ONBOARDING_REWARD_TASKS: OnboardingTask[] = ONBOARDING_REWARD_TASKS_DATA.map(
  (task) => ({
    ...task,
    icon: ONBOARDING_TASK_ICONS[task.id] ?? BookOpen,
    rdmReward: getOnboardingTaskRdmReward(task.id),
  })
);
