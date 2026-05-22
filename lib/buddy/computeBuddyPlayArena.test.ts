import { describe, expect, it } from "vitest";
import type { RdmConfigParams } from "@/lib/rdm/rdmConfig";
import { computeBuddyPlayArena } from "./computeBuddyPlayArena";

const TEST_RDM_CONFIG = {
  challenge_5_win: 3,
  challenge_5_share: 2,
  challenge_10_win: 7,
  challenge_10_share: 3,
  challenge_20_win: 15,
  challenge_20_share: 5,
  challenge_50_win: 30,
  challenge_50_share: 20,
} as RdmConfigParams;

describe("computeBuddyPlayArena", () => {
  it("excludes Gyan++ daily claims from RDM today", () => {
    const out = computeBuddyPlayArena({
      istToday: "2026-05-21",
      utcClaimDate: "2026-05-20",
      rewardClaims: [
        { action_type: "ASK", points_awarded: 5, claim_date_ist: "2026-05-21" },
        {
          action_type: "DAILY_DOSE_ACADEMIC",
          points_awarded: 10,
          claim_date_ist: "2026-05-21",
        },
      ],
      referClaims: [],
      gauntletDates: [],
      rdmConfig: TEST_RDM_CONFIG,
    });
    expect(out.rdmEarnedToday).toBe(10);
  });

  it("sums refer challenge win+share for UTC claim date", () => {
    const out = computeBuddyPlayArena({
      istToday: "2026-05-21",
      utcClaimDate: "2026-05-21",
      rewardClaims: [],
      referClaims: [
        {
          challenge_key: "5",
          win_claimed: true,
          share_claimed: false,
          claim_date: "2026-05-21",
        },
      ],
      gauntletDates: [],
      rdmConfig: TEST_RDM_CONFIG,
    });
    expect(out.rdmEarnedToday).toBe(3);
    expect(out.challengesClaimedToday).toBe(1);
  });
});
