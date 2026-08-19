export type EduDecaWalkthroughAccent = "teal" | "blue" | "violet" | "amber";

export type EduDecaWalkthroughStep = {
  id: number;
  pillLabel: string;
  stepLabel: string;
  accent: EduDecaWalkthroughAccent;
};

export const EDUDECA_WALKTHROUGH_STEPS: EduDecaWalkthroughStep[] = [
  { id: 1, pillLabel: "Join free", stepLabel: "STEP 1 · JOIN FREE", accent: "teal" },
  { id: 2, pillLabel: "Go viral", stepLabel: "STEP 2 · GO VIRAL", accent: "blue" },
  { id: 3, pillLabel: "Level up", stepLabel: "STEP 3 · LEVEL UP", accent: "violet" },
  { id: 4, pillLabel: "Go national", stepLabel: "STEP 4 · GO NATIONAL", accent: "violet" },
  { id: 5, pillLabel: "Pick path", stepLabel: "STEP 5 · YOUR PATH", accent: "amber" },
  { id: 6, pillLabel: "Sign in", stepLabel: "FINAL STEP · SIGN IN", accent: "teal" },
];

export const EDUDECA_SIGN_IN_STEP = 6;
