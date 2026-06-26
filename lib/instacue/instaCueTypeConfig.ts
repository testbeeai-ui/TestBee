export type InstaCueCardType = "concept" | "formula" | "common_mistake" | "trap";

export const INSTACUE_TYPE_ORDER: InstaCueCardType[] = [
  "concept",
  "formula",
  "common_mistake",
  "trap",
];

export const INSTACUE_TYPE_CONFIG: Record<
  InstaCueCardType,
  { label: string; badge: string; border: string; accent: string }
> = {
  concept: {
    label: "Concept",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
    border: "border-t-amber-200 dark:border-t-amber-800",
    accent: "text-amber-700 dark:text-amber-300",
  },
  formula: {
    label: "Formula",
    badge: "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-200",
    border: "border-t-slate-200 dark:border-t-slate-700",
    accent: "text-slate-600 dark:text-slate-300",
  },
  common_mistake: {
    label: "Common Mistake",
    badge: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-200",
    border: "border-t-red-200 dark:border-t-red-800",
    accent: "text-red-600 dark:text-red-300",
  },
  trap: {
    label: "Trap",
    badge: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-200",
    border: "border-t-violet-200 dark:border-t-violet-800",
    accent: "text-violet-600 dark:text-violet-300",
  },
};
