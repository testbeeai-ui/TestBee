import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { requireAuthenticatedUser } from "@/lib/securityGuards";
import {
  REFERRAL_WEEKLY_BONUS_AT_COUNT,
  REFERRAL_WEEKLY_BONUS_RDM,
} from "@/lib/referralRewards";
import { getIstWeekMondayDateString } from "@/lib/referralIst";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const supabase = await createClient();
  const uid = auth.user.id;
  const weekStart = getIstWeekMondayDateString();

  const [{ count: total }, { count: weekly }, { data: bonusRow }] = await Promise.all([
    supabase
      .from("referral_attributions")
      .select("*", { count: "exact", head: true })
      .eq("referrer_user_id", uid),
    supabase
      .from("referral_attributions")
      .select("*", { count: "exact", head: true })
      .eq("referrer_user_id", uid)
      .eq("credited_week_start_ist", weekStart),
    supabase
      .from("referral_weekly_bonuses")
      .select("id")
      .eq("referrer_user_id", uid)
      .eq("week_start_ist", weekStart)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    totalReferrals: total ?? 0,
    weeklyReferrals: weekly ?? 0,
    weeklyGoal: REFERRAL_WEEKLY_BONUS_AT_COUNT,
    weeklyBonusRdm: REFERRAL_WEEKLY_BONUS_RDM,
    weekStartIst: weekStart,
    weeklyBonusEarnedThisWeek: bonusRow != null,
  });
}
