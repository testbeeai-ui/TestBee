import { describe, expect, it } from "vitest";
import { getEmailDailySendCap } from "@/lib/email/emailDailyCap";

describe("getEmailDailySendCap", () => {
  it("defaults to 500 when env unset", () => {
    const prev = process.env.EMAIL_DAILY_SEND_CAP;
    delete process.env.EMAIL_DAILY_SEND_CAP;
    expect(getEmailDailySendCap()).toBe(500);
    if (prev !== undefined) process.env.EMAIL_DAILY_SEND_CAP = prev;
  });
});
