export const WAITLIST_INTERESTS: Record<string, string[]> = {
  student: [
    "Social learning feed (Magic Wall)",
    "Daily quiz and rewards (DailyDose + RDM)",
    "Mock tests and exam prep (Testbee)",
    "Doubt wall (Gyan++)",
    "EduFund financial grants",
    "Learning buddy and peer study",
  ],
  teacher: [
    "Exam creation and question tools",
    "Student analytics dashboard",
    "Gyan++ teaching wall",
    "Live and recorded classes",
    "AI Calendar and study planner",
    "EduFund programme for students",
  ],
  parent: [
    "Progress visibility dashboard",
    "Streak and activity monitoring",
    "EduFund grant eligibility",
    "Platform content safety",
    "Subscription value and plans",
    "Community and peer interactions",
  ],
  other: [
    "Platform concept and vision",
    "EduFund CSR / donation",
    "Partnership or integration",
    "Investment opportunity",
    "Content or media interest",
    "Research and education policy",
  ],
};

/** Single source of truth — keep page copy in sync with stats row */
export const WAITLIST_METRICS = {
  waitlistJoined: 253,
  earlyPreviewCapacity: 300,
  ambassadorPhase1Capacity: 30,
  ambassadorsSelected: 17,
} as const;

export function earlyPreviewSpotsRemaining(): number {
  return Math.max(0, WAITLIST_METRICS.earlyPreviewCapacity - WAITLIST_METRICS.waitlistJoined);
}

export function ambassadorSpotsRemaining(): number {
  return Math.max(
    0,
    WAITLIST_METRICS.ambassadorPhase1Capacity - WAITLIST_METRICS.ambassadorsSelected
  );
}

export function spotWord(count: number): string {
  return count === 1 ? "spot" : "spots";
}

export const WAITLIST_STATS = [
  {
    num: String(WAITLIST_METRICS.waitlistJoined),
    lbl: "on the waitlist",
    color: "text-[#1D9E75]",
  },
  {
    num: String(WAITLIST_METRICS.ambassadorsSelected),
    lbl: "ambassadors selected",
    color: "text-[#EF9F27]",
  },
  { num: "India-wide", lbl: "Phase 1 launch", color: "text-[#7F77DD]" },
] as const;

export function ambassadorUrgencyLine(): { lead: string; detail: string } {
  return {
    lead: "Only a few ambassador applications are remaining",
    detail: "Phase 1 slots are filling quickly · join the waitlist to stay in the loop",
  };
}

export const ROLE_OPTIONS = [
  {
    id: "student",
    name: "Student",
    desc: "PUC 1 or PUC 2 — learning and exam prep",
    badge: "Student Ambassador opportunity",
  },
  {
    id: "teacher",
    name: "Teacher / Tutor",
    desc: "Teaching PUC Physics, Chemistry or Maths",
    badge: "Teacher Ambassador opportunity",
  },
  {
    id: "parent",
    name: "Parent / Guardian",
    desc: "Supporting a PUC student at home",
    badge: null,
  },
  {
    id: "other",
    name: "Other",
    desc: "Donor, investor, institution, media",
    badge: null,
  },
];
