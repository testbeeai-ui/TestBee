import type { LucideIcon } from "lucide-react";
import { Activity, AlertTriangle, Bug, Filter, ShieldAlert, TrendingUp } from "lucide-react";

export const INTELLIGENCE_HUB_PATH = "/admin/dashboard/intelligence";

export type IntelligenceReport = {
  slug: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const INTELLIGENCE_REPORTS: IntelligenceReport[] = [
  {
    slug: "retention-cohorts",
    label: "Retention",
    description: "Day-1, Day-7, and Day-30 return rates by signup cohort.",
    icon: TrendingUp,
  },
  {
    slug: "conversion-funnel",
    label: "Funnel",
    description: "Signup through first quiz, doubt, activity, and paid conversion.",
    icon: Filter,
  },
  {
    slug: "dropoff-tracking",
    label: "Drop-off",
    description: "Where students abandon subtopic learning flows.",
    icon: AlertTriangle,
  },
  {
    slug: "feature-adoption",
    label: "Adoption",
    description: "Share of active users using each product surface.",
    icon: Activity,
  },
  {
    slug: "churn-risk",
    label: "Churn Risk",
    description: "Students scored by inactivity and engagement decline.",
    icon: ShieldAlert,
  },
  {
    slug: "error-tracking",
    label: "Errors",
    description: "Production error monitoring via Sentry.",
    icon: Bug,
  },
];

export function intelligenceReportHref(slug: string): string {
  return `${INTELLIGENCE_HUB_PATH}/${slug}`;
}

export function isIntelligencePath(pathname: string): boolean {
  return pathname === INTELLIGENCE_HUB_PATH || pathname.startsWith(`${INTELLIGENCE_HUB_PATH}/`);
}
