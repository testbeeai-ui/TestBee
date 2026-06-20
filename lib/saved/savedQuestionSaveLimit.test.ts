import { describe, expect, it } from "vitest";
import { savedQuestionLimitToastCopy } from "@/lib/saved/savedQuestionSaveLimit";
import { isUnlimited } from "@/lib/subscription/subscriptionConfig";

describe("savedQuestionSaveLimit", () => {
  it("toast mentions cap and subscription", () => {
    const copy = savedQuestionLimitToastCopy(20);
    expect(copy.title).toContain("Saved questions");
    expect(copy.description).toContain("20");
    expect(copy.description).toMatch(/Subscribe|Subscription/i);
  });

  it("uses -1 unlimited convention", () => {
    expect(isUnlimited(-1)).toBe(true);
    expect(isUnlimited(20)).toBe(false);
  });
});
