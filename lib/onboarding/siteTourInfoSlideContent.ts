/** Investor HTML layout — feat-row + feature snapshot (Dashboard & RDM Wallet menus). */

export type SiteTourSnapshotBadge = "active" | "rdm" | "info" | "module";

export type SiteTourSnapshotRow = {
  tablerIcon: string;
  color: string;
  text: string;
  badge?: SiteTourSnapshotBadge;
};

export type SiteTourInfoSlideContent = {
  menuDesc: string;
  featureIcon: string;
  featureIconColor: string;
  eyebrow: string;
  title: string;
  description: string;
  snapshots: SiteTourSnapshotRow[];
  openLabel: string;
};

const BADGE_LABEL: Record<SiteTourSnapshotBadge, string> = {
  active: "Active",
  rdm: "RDM",
  info: "Info",
  module: "Module",
};

export function siteTourSnapshotBadgeLabel(badge: SiteTourSnapshotBadge): string {
  return BADGE_LABEL[badge];
}

/** Matches `edublast_tour_carousel.html` Dashboard menu (db). */
export const SITE_TOUR_DASHBOARD_INFO: SiteTourInfoSlideContent = {
  menuDesc: "Your home base — every key metric at a glance",
  featureIcon: "ti-flame",
  featureIconColor: "#EF9F27",
  eyebrow: "Dashboard · Streak",
  title: "Daily streak tracking",
  description:
    "Your study streak increments every Active Day. 5-day earns +50 RDM, 7-day +100 RDM, 90-day +500 RDM. Missing a day deducts 50 RDM on trial.",
  snapshots: [
    {
      tablerIcon: "ti-flame",
      color: "#EF9F27",
      text: "7-day streak active — +100 RDM bonus",
      badge: "rdm",
    },
    {
      tablerIcon: "ti-circle-check",
      color: "#1D9E75",
      text: "Today's checklist — 5 tasks earn up to 50 RDM/day",
      badge: "active",
    },
    {
      tablerIcon: "ti-cards",
      color: "#AFA9EC",
      text: "Memory Recall — 2×6 Instacue flip grid",
      badge: "module",
    },
    {
      tablerIcon: "ti-chart-bar",
      color: "#7F77DD",
      text: "Subject accuracy by chapter — weak area flags",
      badge: "module",
    },
    {
      tablerIcon: "ti-writing",
      color: "#378ADD",
      text: "Upcoming mocks and live lessons in sidebar",
      badge: "info",
    },
    {
      tablerIcon: "ti-arrow-up",
      color: "#1D9E75",
      text: "Community feed — upvote earns +2 RDM for poster",
      badge: "rdm",
    },
  ],
  openLabel: "Open Dashboard",
};

/** Matches `edublast_tour_carousel.html` RDM Wallet menu (rw). */
export const SITE_TOUR_RDM_WALLET_INFO: SiteTourInfoSlideContent = {
  menuDesc: "Your RDM balance, activity log and earn guide",
  featureIcon: "ti-info-circle",
  featureIconColor: "#FAC775",
  eyebrow: "RDM Wallet · Explainer",
  title: "What is RDM?",
  description:
    "RDM (Reward and Motivation) is EduBlast's learning currency. Effective RDM = face value × subscription multiplier. Determines EduFund grant eligibility.",
  snapshots: [
    {
      tablerIcon: "ti-coin",
      color: "#FAC775",
      text: "RDM = Reward and Motivation currency",
      badge: "rdm",
    },
    {
      tablerIcon: "ti-star",
      color: "#1D9E75",
      text: "Effective RDM = face value × multiplier",
      badge: "active",
    },
    {
      tablerIcon: "ti-chart-pie",
      color: "#EF9F27",
      text: "Balance · Multiplier · Effective EduFund RDM",
      badge: "rdm",
    },
    {
      tablerIcon: "ti-list",
      color: "#378ADD",
      text: "30-day activity log with every earn and deduct",
      badge: "info",
    },
    {
      tablerIcon: "ti-bolt",
      color: "#9FE1CB",
      text: "DailyDose +10 · 100% accuracy +25",
      badge: "active",
    },
    {
      tablerIcon: "ti-flame",
      color: "#D4537E",
      text: "7-day streak +100 · 90-day +500",
      badge: "rdm",
    },
    {
      tablerIcon: "ti-share",
      color: "#EF9F27",
      text: "Referral signup +150 · Subscribes +500",
      badge: "rdm",
    },
  ],
  openLabel: "View RDM in Profile",
};

const INFO_BY_ID: Record<string, SiteTourInfoSlideContent> = {
  dashboard: SITE_TOUR_DASHBOARD_INFO,
  rdm_wallet: SITE_TOUR_RDM_WALLET_INFO,
};

export function getSiteTourInfoSlideContent(
  slideId: string
): SiteTourInfoSlideContent | undefined {
  return INFO_BY_ID[slideId];
}
