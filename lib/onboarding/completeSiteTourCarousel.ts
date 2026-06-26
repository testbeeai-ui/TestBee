import {

  markOnboardingRewardClaimedLocally,

  armDailyChecklistAfterOnboardingClaim,

} from "@/lib/subscription/freeTrialClient";

import { completeSiteTourRewardOnServer } from "@/lib/subscription/onboardingRewardApi";



export type CompleteSiteTourCarouselResult =

  | { ok: true; amount: number; alreadyClaimed: boolean }

  | { ok: false; error: string };



/**

 * Claim the one-time +100 RDM reward when the user finishes reading the whole site tour.

 * Server marks every checklist row complete, then runs the claim RPC — no per-page verification.

 */

export async function completeSiteTourCarousel(): Promise<CompleteSiteTourCarouselResult> {

  const claim = await completeSiteTourRewardOnServer();

  if (!claim.ok) {

    return { ok: false, error: claim.error ?? "claim_failed" };

  }



  armDailyChecklistAfterOnboardingClaim();

  markOnboardingRewardClaimedLocally();



  return {

    ok: true,

    amount: claim.amount,

    alreadyClaimed: Boolean(claim.alreadyClaimed),

  };

}


