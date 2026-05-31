export type InactivePenaltyPlanKey = "free_trial" | "free" | "starter" | "pro";

export const INACTIVE_PENALTY_RDM_DEFAULTS: Record<InactivePenaltyPlanKey, number> = {
  free_trial: 50,
  free: 50,
  starter: 50,
  pro: 25,
};

export type InactivePenaltyConfig = Partial<
  Record<
    | "free_trial_inactive_penalty_rdm"
    | "free_inactive_penalty_rdm"
    | "starter_inactive_penalty_rdm"
    | "pro_inactive_penalty_rdm",
    number
  >
>;

const CONFIG_KEY: Record<InactivePenaltyPlanKey, keyof InactivePenaltyConfig> = {
  free_trial: "free_trial_inactive_penalty_rdm",
  free: "free_inactive_penalty_rdm",
  starter: "starter_inactive_penalty_rdm",
  pro: "pro_inactive_penalty_rdm",
};

/** Admin-configured RDM deducted per inactive day (<30 min on-site) for the given plan. 0 = disabled. */
export function inactivePenaltyRdmForPlan(
  plan: InactivePenaltyPlanKey,
  cfg: InactivePenaltyConfig = {}
): number {
  const key = CONFIG_KEY[plan];
  const raw = cfg[key] ?? INACTIVE_PENALTY_RDM_DEFAULTS[plan];
  if (typeof raw !== "number" || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.round(raw));
}
