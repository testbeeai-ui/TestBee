type EnvLike = Pick<NodeJS.ProcessEnv, "NODE_ENV" | "RDM_COUPON_PURCHASE_SIMULATION_ENABLED">;

/**
 * Coupon minting is safe only for local/manual simulations. Production purchases
 * need a server-side payment provider verification before any active coupon is created.
 */
export function isRdmCouponPurchaseSimulationEnabled(env: EnvLike = process.env): boolean {
  return env.NODE_ENV !== "production" && env.RDM_COUPON_PURCHASE_SIMULATION_ENABLED === "1";
}
