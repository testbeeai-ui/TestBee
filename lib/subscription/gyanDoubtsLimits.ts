import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { getFreeTrialActivated } from "@/lib/subscription/freeTrialClient";
import {
  fetchSubscriptionConfig,
  getPlanLimits,
  isUnlimited,
  normalizePlanTier,
  type SubscriptionConfig,
  type SubscriptionPlanKey,
} from "@/lib/subscription/subscriptionConfig";
import {
  getIstCalendarDateIso,
  getIstDayUtcBounds,
  type SubjectChatProfileFields,
} from "@/lib/subscription/subjectChatLimits";

export const GYAN_DOUBT_UPGRADE_PATH = "/profile?section=sub-plans";

export type GyanDoubtAccess = {
  plan: SubscriptionPlanKey;
  dailyLimit: number;
  unlimited: boolean;
  usedToday: number;
  remaining: number | null;
  canPost: boolean;
  istDate: string;
};

export function resolveGyanDoubtsDailyLimit(
  cfg: SubscriptionConfig,
  plan: SubscriptionPlanKey
): { dailyLimit: number; unlimited: boolean } {
  const raw = getPlanLimits(cfg, plan).gyanDoubtsPerDay;
  return {
    dailyLimit: raw,
    unlimited: isUnlimited(raw),
  };
}

export async function countGyanDoubtsPostedToday(
  supabase: SupabaseClient<Database>,
  userId: string,
  nowMs: number
): Promise<number> {
  const { startIso, endIso } = getIstDayUtcBounds(nowMs);
  const { count, error } = await supabase
    .from("doubts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (error) {
    console.error("[gyanDoubtsLimits] count today", error.message);
    return 0;
  }
  return Math.max(0, count ?? 0);
}

export function buildGyanDoubtAccess(input: {
  plan: SubscriptionPlanKey;
  cfg: SubscriptionConfig;
  usedToday: number;
  nowMs?: number;
}): GyanDoubtAccess {
  const { plan, cfg, usedToday } = input;
  const nowMs = input.nowMs ?? Date.now();
  const { dailyLimit, unlimited } = resolveGyanDoubtsDailyLimit(cfg, plan);
  const remaining = unlimited ? null : Math.max(0, dailyLimit - usedToday);
  const canPost = unlimited || usedToday < dailyLimit;

  return {
    plan,
    dailyLimit,
    unlimited,
    usedToday,
    remaining,
    canPost,
    istDate: getIstCalendarDateIso(nowMs),
  };
}

export function resolveGyanDoubtAccessFromProfile(
  profile: SubjectChatProfileFields | null | undefined,
  cfg: SubscriptionConfig,
  usedToday: number,
  nowMs?: number
): GyanDoubtAccess {
  const plan = normalizePlanTier(
    profile?.plan_tier,
    getFreeTrialActivated(profile ?? undefined),
    profile ?? undefined
  );
  return buildGyanDoubtAccess({
    plan,
    cfg,
    usedToday,
    nowMs: nowMs ?? Date.now() + Math.max(0, Number(profile?.time_travel_offset_ms ?? 0)),
  });
}

export async function resolveGyanDoubtAccessForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  profile: SubjectChatProfileFields | null | undefined,
  cfg?: SubscriptionConfig
): Promise<GyanDoubtAccess> {
  const config = cfg ?? (await fetchSubscriptionConfig());
  const nowMs = Date.now() + Math.max(0, Number(profile?.time_travel_offset_ms ?? 0));
  const usedToday = await countGyanDoubtsPostedToday(supabase, userId, nowMs);
  return resolveGyanDoubtAccessFromProfile(profile, config, usedToday, nowMs);
}

export function gyanDoubtLimitToastCopy(dailyLimit: number): {
  title: string;
  description: string;
} {
  return {
    title: "Gyan++ daily doubt limit reached",
    description: `Your plan allows ${dailyLimit} new doubt${dailyLimit === 1 ? "" : "s"} per IST day. Subscribe to Starter or Pro for more — Profile → Subscription.`,
  };
}
