import { cbseMcqOnboardingMockHubHref } from "@/lib/onboarding/cbseMcqOnboardingFlow";
import { prepClassesOnboardingClassroomsHref } from "@/lib/onboarding/prepClassesOnboardingFlow";
import { earnChallengeOnboardingHref } from "@/lib/onboarding/earnChallengeOnboardingFlow";
import { edufundOnboardingHref } from "@/lib/onboarding/edufundOnboardingFlow";
import { lessonsOnboardingExploreHref } from "@/lib/onboarding/lessonsOnboardingFlow";
import type { NoteColor } from "@/lib/onboarding/onboardingRewardTaskUi";
import { ONBOARDING_REWARD_TASK_IDS } from "@/lib/subscription/onboardingRewardConstants";

const GYAN_PLUS_ONBOARDING_HREF = "/doubts?onboarding_gyan=1";

export type OnboardingRewardTaskData = {
  id: string;
  title: string;
  boardTitle: string;
  teaser: string;
  time: string;
  steps: string[];
  hints: string[];
  href: string;
  color: NoteColor;
};

export const ONBOARDING_REWARD_NOTE_COLOR_CYCLE: NoteColor[] = [
  "teal",
  "amber",
  "purple",
  "teal",
  "amber",
  "purple",
  "teal",
  "amber",
  "purple",
  "teal",
];

/** Shared Day-1 site tour checklist copy — used by sticky board + carousel tour. */
export const ONBOARDING_REWARD_TASKS_DATA: OnboardingRewardTaskData[] = [
  {
    id: "magic_wall",
    title: "Magic Wall",
    boardTitle: "Magic Wall",
    teaser: "Open Magic Wall, pick topics, save changes",
    time: "~2 min",
    steps: [
      "Open Magic Wall from the main menu.",
      "Browse Magic Wall and select at least one topic you want to read.",
      'Tap "Save changes" to keep your topic picks in your reading basket.',
    ],
    hints: ["Open Magic Wall, select at least one topic, then tap Save changes"],
    href: "/magic-wall",
    color: ONBOARDING_REWARD_NOTE_COLOR_CYCLE[0],
  },
  {
    id: "lessons",
    title: "Lessons",
    boardTitle: "Lessons",
    teaser: "Pick chapters, explore a topic, try quiz or InstaCue",
    time: "~4 min",
    steps: [
      "Go to Lessons and pick a subject: 1 Physics, 2 Chemistry, or 3 Maths.",
      "Browse any chapter — all chapters are open on every plan.",
      "Open a sub-topic and explore the lesson panels.",
      "On a sub-topic, try Set 1 quiz free; Question bank unlocks extra sets on Starter & Pro.",
    ],
    hints: [
      "Subject → any chapter → sub-topic → quiz / numerals / InstaCue (premium inside panels)",
    ],
    href: lessonsOnboardingExploreHref(),
    color: ONBOARDING_REWARD_NOTE_COLOR_CYCLE[1],
  },
  {
    id: "prep_classes",
    title: "Prep + Mock · Classes",
    boardTitle: "Classes",
    teaser: "Classes + Mock tests on one hub",
    time: "~3 min",
    steps: [
      "Open Classrooms to see your enrolled classes.",
      "Tap any class card (or View class) to open it.",
      "On the class Home tab, play the intro video to preview the lesson.",
      "Open the Live tab to check upcoming sessions.",
    ],
    hints: ["Classrooms → pick a class → watch intro video → Live tab"],
    href: prepClassesOnboardingClassroomsHref(),
    color: ONBOARDING_REWARD_NOTE_COLOR_CYCLE[2],
  },
  {
    id: "prep_mcq",
    title: "Prep + Mock · CBSE MCQ",
    boardTitle: "Mock test",
    teaser: "CBSE MCQ quiz (same Prep + Mock hub)",
    time: "~5 min",
    steps: [
      'Open Prep + Mock → Mock tests card → tap "View all".',
      "Go to the CBSE MCQ's tab.",
      "Pick any chapter and attempt the quiz.",
      "Read the explanation for at least one answer.",
    ],
    hints: ["Mock tests card → View all → CBSE MCQ's tab → Quiz on any chapter"],
    href: cbseMcqOnboardingMockHubHref(),
    color: ONBOARDING_REWARD_NOTE_COLOR_CYCLE[3],
  },
  {
    id: "gyan_plus",
    title: "Gyan++",
    boardTitle: "Gyan++",
    teaser: "Post a doubt & upvote one answer",
    time: "~3 min",
    steps: [
      "Open Gyan++ and browse the Doubt Wall for 1 minute.",
      "Upvote one answer you found helpful.",
      "Post one question from any chapter you are studying.",
      "Comment on one existing doubt thread — this step earns 5 RDM toward your +100.",
    ],
    hints: [
      "Browse the doubt wall, post one question, then upvote or comment on a doubt or answer",
    ],
    href: GYAN_PLUS_ONBOARDING_HREF,
    color: ONBOARDING_REWARD_NOTE_COLOR_CYCLE[4],
  },
  {
    id: "earn_buddy",
    title: "Earn & Learn · Buddy",
    boardTitle: "Buddy",
    teaser: "Invite a learning buddy",
    time: "~2 min",
    steps: [
      "Copy your invite link or share it with a friend.",
      "Ask them to sign up and join through your link.",
      "The step completes when their invite is accepted.",
    ],
    hints: ["Invite a learning buddy", "Done when they sign up and join through your link"],
    href: "/refer-earn?tab=learning_buddy&onboarding_buddy=1",
    color: ONBOARDING_REWARD_NOTE_COLOR_CYCLE[5],
  },
  {
    id: "earn_challenge",
    title: "Earn & Learn · Challenge",
    boardTitle: "Challenge",
    teaser: "Mentamill or Funbrain round",
    time: "~2 min",
    steps: [
      "Tap Start challenge to begin your speed round.",
      "Finish the full round (win or lose).",
      "Post your result to the community feed.",
    ],
    hints: ["Try Mentamill or Funbrain challenge"],
    href: earnChallengeOnboardingHref(),
    color: ONBOARDING_REWARD_NOTE_COLOR_CYCLE[6],
  },
  {
    id: "news_blog",
    title: "News & Blogs",
    boardTitle: "News & Blogs",
    teaser: "Read one article or blog post",
    time: "~2 min",
    steps: [
      "Open News & Blogs from the main menu.",
      "Pick any news article or blog post.",
      "Read through the full piece.",
      "Return to the checklist when finished.",
    ],
    hints: ["Read one news article or blog post"],
    href: "/news-blog",
    color: ONBOARDING_REWARD_NOTE_COLOR_CYCLE[7],
  },
  {
    id: "edufund",
    title: "EduFund",
    boardTitle: "EduFund",
    teaser: "Open your grant proposal",
    time: "~2 min",
    steps: [
      "Open EduFund from the main menu.",
      "Scroll down to see proposals & grant tiers.",
      'Tap "Create Proposal" to open your application shell.',
      "See how many RDM you need for the Sprout grant.",
    ],
    hints: ['Click "Create Proposal"'],
    href: edufundOnboardingHref(),
    color: ONBOARDING_REWARD_NOTE_COLOR_CYCLE[8],
  },
  {
    id: "profile",
    title: "Profile",
    boardTitle: "Profile",
    teaser: "Save your basic details",
    time: "~2 min",
    steps: [
      "Open Profile → Basic information.",
      "Fill in name, location, mobile, gender, and category.",
      "Save — all required fields must be filled.",
      "Add a profile photo — this step earns 5 RDM toward your +100.",
    ],
    hints: [
      "Open Profile → Basic information",
      "Save first name, location, mobile, gender, and category",
    ],
    href: "/profile?section=personal",
    color: ONBOARDING_REWARD_NOTE_COLOR_CYCLE[9],
  },
];

export function getOnboardingRewardTaskData(taskId: string): OnboardingRewardTaskData | undefined {
  return ONBOARDING_REWARD_TASKS_DATA.find((t) => t.id === taskId);
}

export function isKnownOnboardingRewardTaskId(taskId: string): boolean {
  return (ONBOARDING_REWARD_TASK_IDS as readonly string[]).includes(taskId);
}

/** Tasks tracked on the server — OK requires real completion, not self-ack only. */
export function isOnboardingRewardTaskVerifiable(taskId: string): boolean {
  return isKnownOnboardingRewardTaskId(taskId);
}
