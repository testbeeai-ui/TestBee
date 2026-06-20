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
    expect(access.regionalLanguage).toBeNull();
    expect(access.needsRegionalLanguageSelection).toBe(true);
    expect(access.remaining).toBeNull();
  });

  it("pro with locked regional language", () => {
    const access = buildSubjectChatAccess({
      plan: "pro",
      cfg: SUBSCRIPTION_CONFIG_DEFAULTS,
      usedToday: 0,
      regionalLanguage: "kn",
    });
    expect(access.regionalLanguage).toBe("kn");
    expect(access.needsRegionalLanguageSelection).toBe(false);
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
    const off = { multilingual: false, regionalLanguage: null };
    expect(resolveSubjectChatLanguage("hi", off)).toBe("en");
    expect(resolveSubjectChatLanguage("kn", off)).toBe("en");
  });

  it("pro without locked language: English only until picker completes", () => {
    const pending = { multilingual: true, regionalLanguage: null };
    expect(resolveSubjectChatLanguage("kn", pending)).toBe("en");
    expect(resolveSubjectChatLanguage("en", pending)).toBe("en");
  });

  it("pro with locked language: English or locked regional only", () => {
    const locked = { multilingual: true, regionalLanguage: "kn" as const };
    expect(resolveSubjectChatLanguage("en", locked)).toBe("en");
    expect(resolveSubjectChatLanguage("kn", locked)).toBe("kn");
    expect(resolveSubjectChatLanguage("hi", locked)).toBe("en");
    expect(resolveSubjectChatLanguage("ta", locked)).toBe("en");
  });

  it("admin override for multilingual flag", () => {
    const cfg = {
      ...SUBSCRIPTION_CONFIG_DEFAULTS,
      starter_subject_chat_multilingual: 0,
    };
    expect(planHasSubjectChatMultilingual(cfg, "starter")).toBe(false);
  });
});
