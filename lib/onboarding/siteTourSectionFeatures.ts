import type { SiteTourSnapshotRow } from "@/lib/onboarding/siteTourInfoSlideContent";

export type SiteTourSectionFeature = {
  id: string;
  label: string;
  tablerIcon: string;
  color: string;
  rdm: number;
  eyebrow: string;
  title: string;
  description: string;
  snapshots: SiteTourSnapshotRow[];
};

/** Investor HTML sub-features per menu — shown in top carousel when on that section. */
export const SITE_TOUR_SECTION_FEATURES: Record<string, SiteTourSectionFeature[]> = {
  dashboard: [
    {
      id: "streak",
      label: "Streak",
      tablerIcon: "ti-flame",
      color: "#EF9F27",
      rdm: 2,
      eyebrow: "Dashboard · Streak",
      title: "Daily streak tracking",
      description:
        "Your study streak increments every Active Day. 5-day earns +50 RDM, 7-day +100 RDM, 90-day +500 RDM. Missing a day deducts 50 RDM on trial.",
      snapshots: [
        { tablerIcon: "ti-flame", color: "#EF9F27", text: "7-day streak active — +100 RDM bonus", badge: "rdm" },
        { tablerIcon: "ti-calendar", color: "#378ADD", text: "30-day activity heatmap in Dashboard", badge: "info" },
        { tablerIcon: "ti-alert-triangle", color: "#E24B4A", text: "–50 RDM on inactive trial day" },
      ],
    },
    {
      id: "accuracy",
      label: "Accuracy",
      tablerIcon: "ti-chart-bar",
      color: "#7F77DD",
      rdm: 2,
      eyebrow: "Dashboard · Accuracy",
      title: "Subject accuracy by chapter",
      description:
        "Tracks marked-completed subtopics per chapter. % complete shown with colour bar. Chapters under 10% trigger a Needs Attention callout.",
      snapshots: [
        { tablerIcon: "ti-chart-bar", color: "#7F77DD", text: "Chemistry — Electrochemistry at 3%", badge: "module" },
        { tablerIcon: "ti-alert-circle", color: "#E24B4A", text: "3 chapters flagged below 10%" },
        { tablerIcon: "ti-check", color: "#1D9E75", text: "Click icon in greeting row to open flyout", badge: "active" },
      ],
    },
    {
      id: "checklist",
      label: "Checklist",
      tablerIcon: "ti-checklist",
      color: "#1D9E75",
      rdm: 2,
      eyebrow: "Dashboard · Checklist",
      title: "Today's daily checklist",
      description:
        "5 tasks earn 50 RDM: DailyDose (10), Gyan++ (5), Magic Wall (5), Mentamill (10), Lessons (20). Complete all 5 before midnight.",
      snapshots: [
        { tablerIcon: "ti-bolt", color: "#EF9F27", text: "DailyDose — 5 questions (+10 RDM)", badge: "rdm" },
        { tablerIcon: "ti-social", color: "#D4537E", text: "Magic Wall upvote (+5 RDM)" },
        { tablerIcon: "ti-circle-check", color: "#1D9E75", text: "3 of 5 done — 30 RDM earned", badge: "active" },
      ],
    },
    {
      id: "events",
      label: "Events",
      tablerIcon: "ti-calendar",
      color: "#85B7EB",
      rdm: 1,
      eyebrow: "Dashboard · Events",
      title: "Upcoming mocks and classes",
      description:
        "Right sidebar shows next 3 Testbee mocks and scheduled classes. One-click Start Now launches any paper in NTA-style interface.",
      snapshots: [
        { tablerIcon: "ti-writing", color: "#378ADD", text: "JEE Main Mock Paper 2 — 180 min", badge: "info" },
        { tablerIcon: "ti-star", color: "#7F77DD", text: "Physics 9.3 Elastic Moduli — Advanced", badge: "module" },
      ],
    },
    {
      id: "feed",
      label: "Feed",
      tablerIcon: "ti-social",
      color: "#D4537E",
      rdm: 1,
      eyebrow: "Dashboard · Feed",
      title: "Community feed on dashboard",
      description:
        "Latest posts from your network. Filter by All, Physics, Chemistry or Math. Upvote, save for revision, or open Thread.",
      snapshots: [
        { tablerIcon: "ti-social", color: "#D4537E", text: "Community feed — latest posts" },
        { tablerIcon: "ti-arrow-up", color: "#1D9E75", text: "Upvote earns +2 RDM for the poster", badge: "active" },
      ],
    },
    {
      id: "memory_recall",
      label: "Memory Recall",
      tablerIcon: "ti-brain",
      color: "#AFA9EC",
      rdm: 1,
      eyebrow: "Dashboard · Memory Recall",
      title: "Instacue memory recall grid",
      description:
        "Cards due tomorrow in a 2×6 flip-card grid. Black cards, subject outline colours. Tap to flip — question front, answer back.",
      snapshots: [
        { tablerIcon: "ti-cards", color: "#AFA9EC", text: "2×6 flip grid — subject outline colour", badge: "module" },
        { tablerIcon: "ti-refresh", color: "#1D9E75", text: "Tap to flip: question → answer", badge: "active" },
        { tablerIcon: "ti-flag", color: "#EF9F27", text: "Unsure → revision list", badge: "rdm" },
      ],
    },
    {
      id: "weak_areas",
      label: "Weak Areas",
      tablerIcon: "ti-target",
      color: "#EF9F27",
      rdm: 1,
      eyebrow: "Dashboard · Performance",
      title: "Performance and weak area flags",
      description:
        "Click Subject Accuracy icon in greeting row to see all chapters by completion. Chapters below 10% flagged with direct links to start targeted mock.",
      snapshots: [
        { tablerIcon: "ti-target", color: "#EF9F27", text: "Subject Accuracy flyout — click icon", badge: "rdm" },
        { tablerIcon: "ti-alert-circle", color: "#E24B4A", text: "Weak area: Integrals at 4%" },
        { tablerIcon: "ti-writing", color: "#7F77DD", text: "Start targeted mock in one tap", badge: "module" },
      ],
    },
  ],
  magic_wall: [
    {
      id: "topics",
      label: "Topics",
      tablerIcon: "ti-filter",
      color: "#AFA9EC",
      rdm: 3,
      eyebrow: "Magic Wall · Filter",
      title: "Filter by topic and subject",
      description:
        "Filter pills (All, Physics, Chemistry, Math) focus your feed. Posts are tagged with subject and chapter so you only see relevant content.",
      snapshots: [
        { tablerIcon: "ti-filter", color: "#AFA9EC", text: "Filter pills: All / Physics / Chemistry / Math", badge: "module" },
        { tablerIcon: "ti-tag", color: "#1D9E75", text: "Every post tagged with subject + chapter", badge: "active" },
      ],
    },
    {
      id: "save",
      label: "Save",
      tablerIcon: "ti-bookmark",
      color: "#EF9F27",
      rdm: 3,
      eyebrow: "Magic Wall · Save",
      title: "Save posts for revision",
      description:
        "Tap Save for revision on any post (+3 RDM). Saved posts appear in Profile > Saved and can be converted to Instacue flashcards.",
      snapshots: [
        { tablerIcon: "ti-bookmark", color: "#EF9F27", text: "Save for revision — +3 RDM", badge: "rdm" },
        { tablerIcon: "ti-cards", color: "#7F77DD", text: "Convert saved post to Instacue card", badge: "module" },
      ],
    },
    {
      id: "read_revise",
      label: "Read / Revise",
      tablerIcon: "ti-eye",
      color: "#85B7EB",
      rdm: 4,
      eyebrow: "Magic Wall · Read",
      title: "Read and engage with posts",
      description:
        "Open any post for full content, comments and upvotes. Thread view shows complete discussion. Upvote helpful posts — +2 RDM to poster.",
      snapshots: [
        { tablerIcon: "ti-eye", color: "#85B7EB", text: "Full content + comment thread", badge: "info" },
        { tablerIcon: "ti-arrow-up", color: "#1D9E75", text: "Upvote → +2 RDM to poster", badge: "active" },
      ],
    },
  ],
  rdm_wallet: [
    {
      id: "what_is_rdm",
      label: "What is RDM?",
      tablerIcon: "ti-info-circle",
      color: "#FAC775",
      rdm: 3,
      eyebrow: "RDM Wallet · Explainer",
      title: "What is RDM?",
      description:
        "RDM (Reward and Motivation) is EduBlast's learning currency. Effective RDM = face value × subscription multiplier. Determines EduFund grant eligibility.",
      snapshots: [
        { tablerIcon: "ti-coin", color: "#FAC775", text: "RDM = Reward and Motivation currency", badge: "rdm" },
        { tablerIcon: "ti-star", color: "#1D9E75", text: "Effective RDM = face value × multiplier", badge: "active" },
      ],
    },
    {
      id: "breakdown",
      label: "Breakdown",
      tablerIcon: "ti-chart-pie",
      color: "#EF9F27",
      rdm: 3,
      eyebrow: "RDM Wallet · Breakdown",
      title: "Your RDM breakdown",
      description:
        "Shows: earned this week, total balance, active multiplier, effective EduFund RDM, and 30-day activity log with every earn and deduct event.",
      snapshots: [
        { tablerIcon: "ti-chart-pie", color: "#EF9F27", text: "Balance · Multiplier · Effective RDM", badge: "rdm" },
        { tablerIcon: "ti-list", color: "#378ADD", text: "30-day log with timestamps", badge: "info" },
      ],
    },
    {
      id: "how_to_earn",
      label: "How to earn",
      tablerIcon: "ti-list-check",
      color: "#9FE1CB",
      rdm: 4,
      eyebrow: "RDM Wallet · Earn guide",
      title: "How to earn RDM — all methods",
      description:
        "Login +20 · DailyDose +10 · 100% +25 · Gyan++ +5 · Accepted +40 · Upvote +2 · Referral signup +150 · Subscribes +500 · 7-day streak +100 · 90-day +500 · Save post +3.",
      snapshots: [
        { tablerIcon: "ti-bolt", color: "#9FE1CB", text: "DailyDose +10 · 100% accuracy +25", badge: "active" },
        { tablerIcon: "ti-flame", color: "#D4537E", text: "7-day streak +100 · 90-day +500", badge: "rdm" },
        { tablerIcon: "ti-share", color: "#EF9F27", text: "Referral signup +150 · Subscribes +500", badge: "rdm" },
      ],
    },
  ],
};

export function getSiteTourSectionFeatures(slideId: string): SiteTourSectionFeature[] | undefined {
  return SITE_TOUR_SECTION_FEATURES[slideId];
}

type SlideForFeatures = {
  id: string;
  boardTitle: string;
  steps: string[];
  theme: { c: string; bg: string; bd: string };
};

/** Sub-features for carousel — section HTML subs, or numbered steps for task slides. */
export function getCarouselFeaturesForSlide(slide: SlideForFeatures): SiteTourSectionFeature[] {
  const fromSection = getSiteTourSectionFeatures(slide.id);
  if (fromSection?.length) return fromSection;
  return slide.steps.map((step, index) => ({
    id: `step-${index}`,
    label: `Step ${index + 1}`,
    tablerIcon: "ti-list-numbers",
    color: slide.theme.c,
    rdm: 0,
    eyebrow: `${slide.boardTitle} · Step ${index + 1}`,
    title: step,
    description: step,
    snapshots: [],
  }));
}
