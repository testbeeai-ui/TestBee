import { describe, expect, it } from "vitest";
import {
  buildSubjectChatAccess,
  getIstDayUtcBounds,
  planHasSubjectChatMultilingual,
  resolveSubjectChatAccessFromProfile,
  resolveSubjectChatLanguage,
} from "@/lib/subscription/subjectChatLimits";
import { SUBSCRIPTION_CONFIG_DEFAULTS } from "@/lib/subscription/subscriptionConfig";

describe("subjectChatLimits", () => {
  it("IST day bounds span 24h in UTC", () => {
    const { startIso, endIso } = getIstDayUtcBounds(Date.parse("2026-06-02T12:00:00Z"));
    expect(Date.parse(endIso) - Date.parse(startIso)).toBe(24 * 60 * 60 * 1000);
  });

  it("free and free_trial: 3/day, no multilingual", () => {
    for (const tier of ["free", "free_trial"] as const) {
      const access = buildSubjectChatAccess({
        plan: tier,
        cfg: SUBSCRIPTION_CONFIG_DEFAULTS,
        usedToday: 2,
      });
      expect(access.dailyLimit).toBe(3);
      expect(access.unlimited).toBe(false);
      expect(access.multilingual).toBe(false);
      expect(access.remaining).toBe(1);
      expect(access.canSend).toBe(true);
    }
  });

  it("blocks free user after 3 messages today", () => {
    const access = buildSubjectChatAccess({
      plan: "free",
      cfg: SUBSCRIPTION_CONFIG_DEFAULTS,
      usedToday: 3,
    });
    expect(access.canSend).toBe(false);
    expect(access.remaining).toBe(0);
  });

  it("starter: unlimited chat, English only", () => {
    const access = buildSubjectChatAccess({
      plan: "starter",
      cfg: SUBSCRIPTION_CONFIG_DEFAULTS,
      usedToday: 99,
    });
    expect(access.unlimited).toBe(true);
    expect(access.canSend).toBe(true);
    expect(access.multilingual).toBe(false);
    expect(access.remaining).toBeNull();
  });

  it("pro: unlimited chat and multilingual", () => {
    const access = buildSubjectChatAccess({
      plan: "pro",
      cfg: SUBSCRIPTION_CONFIG_DEFAULTS,
      usedToday: 99,
    });
    expect(access.unlimited).toBe(true);
    expect(access.canSend).toBe(true);
    expect(access.multilingual).toBe(true);
    expect(access.remaining).toBeNull();
  });

  it("normalizePlanTier: paid starter is English-only chat-bot", () => {
    const access = resolveSubjectChatAccessFromProfile(
      {
        plan_tier: "starter",
        free_trial_activated: true,
        subscription_started_at: new Date().toISOString(),
      },
      SUBSCRIPTION_CONFIG_DEFAULTS,
      0
    );
    expect(access.plan).toBe("starter");
    expect(access.multilingual).toBe(false);
  });

  it("forces English when multilingual is off", () => {
    expect(
      resolveSubjectChatLanguage("hi", { multilingual: false })
    ).toBe("en");
    expect(
      resolveSubjectChatLanguage("kn", { multilingual: true })
    ).toBe("kn");
  });

  it("admin override for multilingual flag", () => {
    const cfg = {
      ...SUBSCRIPTION_CONFIG_DEFAULTS,
      starter_subject_chat_multilingual: 0,
    };
    expect(planHasSubjectChatMultilingual(cfg, "starter")).toBe(false);
  });
});
