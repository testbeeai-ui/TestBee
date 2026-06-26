import type { Profile } from "@/hooks/useAuth";
import type { BillingRecord } from "@/components/profile/subscription/types";
import { DEFAULT_RDM_CONFIG } from "@/lib/rdm/rdmConfig";
import { normalizePlanTier } from "@/lib/subscription/subscriptionConfig";
import { getPaidPlanChargeAmount } from "@/lib/subscription/subscriptionBilling";

type SortableBillingRecord = BillingRecord & { _sortMs: number };

function formatBillingDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parseIsoMs(iso: string | null | undefined): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function paymentMethodLabel(profile: Profile): string {
  if (!profile.payment_card_details) return "UPI";
  try {
    const card =
      typeof profile.payment_card_details === "string"
        ? JSON.parse(profile.payment_card_details)
        : profile.payment_card_details;
    if (card?.cardNumber) {
      return `Card (Visa •••• ${String(card.cardNumber).replace(/\s/g, "").slice(-4)})`;
    }
    if (card?.type) return String(card.type).toUpperCase();
  } catch {
    /* ignore malformed card json */
  }
  return "Payment method on file";
}

/** Build billing rows from profile flags (trial, end bonus, paid checkout). */
export function buildBillingHistoryFromProfile(
  profile: Profile | null | undefined,
  opts?: { welcomeRdm?: number }
): BillingRecord[] {
  if (!profile?.id) return [];

  const welcomeRdm = opts?.welcomeRdm ?? DEFAULT_RDM_CONFIG.free_trial_welcome_rdm;
  const planKey = normalizePlanTier(profile.plan_tier, profile.free_trial_activated, profile);
  const records: SortableBillingRecord[] = [];
  const idPrefix = profile.id.slice(0, 8).toUpperCase();

  const hasHadTrial = 
    profile.free_trial_activated || 
    profile.free_trial_activated_at != null || 
    profile.trial_original_ended_at != null || 
    profile.trial_end_bonus_activated ||
    profile.trial_second_round_activated;

  if (hasHadTrial) {
    const trialIso = profile.free_trial_activated_at ?? profile.created_at;
    const date = formatBillingDate(trialIso);
    if (date) {
      records.push({
        id: `trial-${profile.id.slice(0, 8)}`,
        title: "Free Trial activated",
        date,
        method: `No charge · +${welcomeRdm.toLocaleString()} welcome RDM`,
        txnId: `TRIAL-${idPrefix}`,
        amount: 0,
        status: "activated",
        _sortMs: parseIsoMs(trialIso),
      });
    }
  }

  if (profile.trial_end_bonus_activated) {
    const bonusIso =
      profile.card_added_at ??
      profile.trial_original_ended_at ??
      profile.subscription_started_at;
    const date = formatBillingDate(bonusIso);
    if (date) {
      const secondRound = profile.trial_second_round_activated;
      const onPaidPlan = planKey === "starter" || planKey === "pro";
      const planName =
        planKey === "pro" ? "Pro" : planKey === "starter" ? "Starter" : "Free Trial";

      let title: string;
      if (secondRound) {
        title = "Free bonus — +14 day trial extension";
      } else if (onPaidPlan) {
        title = `Free bonus — 1 month ${planName} (no charge yet)`;
      } else {
        title = "Free trial end bonus activated";
      }

      records.push({
        id: `bonus-${profile.id.slice(0, 8)}`,
        title,
        date,
        method: secondRound
          ? "Card on file · No charge during extension"
          : "Card on file · Billing starts after bonus month",
        txnId: `BONUS-${idPrefix}`,
        amount: 0,
        status: "bonus",
        _sortMs: parseIsoMs(bonusIso),
      });
    }
  }

  const isPaid = planKey === "starter" || planKey === "pro";
  if (isPaid && profile.subscription_started_at && !profile.trial_end_bonus_activated) {
    const planName = planKey === "pro" ? "Pro Plan" : "Starter Plan";
    const date = formatBillingDate(profile.subscription_started_at);
    if (date) {
      records.push({
        id: `inv-${profile.id.slice(0, 8)}`,
        title: `${planName} Activation`,
        date,
        method: paymentMethodLabel(profile),
        txnId: `TXN-${idPrefix}`,
        amount: getPaidPlanChargeAmount(planKey, profile),
        status: "paid",
        _sortMs: parseIsoMs(profile.subscription_started_at),
      });
    }
  }

  records.sort((a, b) => b._sortMs - a._sortMs);
  return records.map(({ _sortMs, ...record }) => {
    void _sortMs;
    return record;
  });
}
