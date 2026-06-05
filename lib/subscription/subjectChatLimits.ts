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

export type SubjectChatProfileFields = {
  plan_tier?: string | null;
  free_trial_activated?: boolean | null;
  payment_card_details?: unknown;
  subscription_started_at?: string | null;
  time_travel_offset_ms?: number | null;
};

export type SubjectChatAccess = {
  plan: SubscriptionPlanKey;
  dailyLimit: number;
  unlimited: boolean;
  multilingual: boolean;
  usedToday: number;
  remaining: number | null;
  canSend: boolean;
  istDate: string;
};

export function resolveSubjectChatNowMs(
  profile?: SubjectChatProfileFields | null
): number {
  return Date.now() + Math.max(0, Number(profile?.time_travel_offset_ms ?? 0));
}

/** IST calendar date as YYYY-MM-DD (matches daily RDM / checklist semantics). */
export function getIstCalendarDateIso(nowMs = Date.now()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(
    new Date(nowMs)
  );
}

/** UTC bounds for one IST calendar day. */
export function getIstDayUtcBounds(nowMs = Date.now()): { startIso: string; endIso: string } {
  const dateKey = getIstCalendarDateIso(nowMs);
  const startMs = Date.parse(`${dateKey}T00:00:00+05:30`);
  const endMs = startMs + 24 * 60 * 60 * 1000;
  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endMs).toISOString(),
  };
}

export function planHasSubjectChatMultilingual(
  cfg: SubscriptionConfig,
  plan: SubscriptionPlanKey
): boolean {
  const v = cfg[`${plan}_subject_chat_multilingual`];
  return typeof v === "number" && v > 0;
}

export function resolveSubjectChatDailyLimit(
  cfg: SubscriptionConfig,
  plan: SubscriptionPlanKey
): { dailyLimit: number; unlimited: boolean } {
  const raw = getPlanLimits(cfg, plan).subjectChatMessagesPerDay;
  return {
    dailyLimit: raw,
    unlimited: isUnlimited(raw),
  };
}

export async function countSubjectChatUserMessagesToday(
  supabase: SupabaseClient<Database>,
  userId: string,
  nowMs: number
): Promise<number> {
  const { startIso, endIso } = getIstDayUtcBounds(nowMs);
  const { count, error } = await supabase
    .from("subject_topic_chat_messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("role", "user")
    .gte("created_at", startIso)
    .lt("created_at", endIso);

  if (error) {
    console.error("[subjectChatLimits] count today", error.message);
    return 0;
  }
  return Math.max(0, count ?? 0);
}

export function buildSubjectChatAccess(input: {
  plan: SubscriptionPlanKey;
  cfg: SubscriptionConfig;
  usedToday: number;
  nowMs?: number;
}): SubjectChatAccess {
  const { plan, cfg, usedToday } = input;
  const nowMs = input.nowMs ?? Date.now();
  const { dailyLimit, unlimited } = resolveSubjectChatDailyLimit(cfg, plan);
  const multilingual = planHasSubjectChatMultilingual(cfg, plan);
  const remaining = unlimited ? null : Math.max(0, dailyLimit - usedToday);
  const canSend = unlimited || usedToday < dailyLimit;

  return {
    plan,
    dailyLimit,
    unlimited,
    multilingual,
    usedToday,
    remaining,
    canSend,
    istDate: getIstCalendarDateIso(nowMs),
  };
}

export function resolveSubjectChatAccessFromProfile(
  profile: SubjectChatProfileFields | null | undefined,
  cfg: SubscriptionConfig,
  usedToday: number,
  nowMs?: number
): SubjectChatAccess {
  const plan = normalizePlanTier(
    profile?.plan_tier,
    getFreeTrialActivated(profile ?? undefined),
    profile ?? undefined
  );
  return buildSubjectChatAccess({
    plan,
    cfg,
    usedToday,
    nowMs: nowMs ?? resolveSubjectChatNowMs(profile),
  });
}

export async function resolveSubjectChatAccessForUser(
  supabase: SupabaseClient<Database>,
  userId: string,
  profile: SubjectChatProfileFields | null | undefined,
  cfg?: SubscriptionConfig
): Promise<SubjectChatAccess> {
  const config = cfg ?? (await fetchSubscriptionConfig());
  const nowMs = resolveSubjectChatNowMs(profile);
  const usedToday = await countSubjectChatUserMessagesToday(supabase, userId, nowMs);
  return resolveSubjectChatAccessFromProfile(profile, config, usedToday, nowMs);
}

/** Server: clamp language to English when plan has no multilingual. */
export function resolveSubjectChatLanguage(
  requested: string,
  access: Pick<SubjectChatAccess, "multilingual">
): string {
  if (!access.multilingual) return "en";
  const code = String(requested ?? "en").trim().toLowerCase();
  const allowed = new Set(["en", "hi", "kn", "ta", "te"]);
  return allowed.has(code) ? code : "en";
}
