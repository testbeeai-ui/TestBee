import { describe, expect, it } from "vitest";
import { revisionCardLimitToastCopy } from "@/lib/saved/savedContentSaveLimit";
import { isUnlimited } from "@/lib/subscription/subscriptionConfig";

describe("revisionCardSaveLimit", () => {
  it("toast mentions subscribe and cap count", () => {
    const copy = revisionCardLimitToastCopy(20);
    expect(copy.title).toContain("limit");
    expect(copy.description).toContain("20");
    expect(copy.description).toMatch(/Subscribe|Subscription/i);
  });

  it("instacue cap uses -1 unlimited from subscription config convention", () => {
    expect(isUnlimited(-1)).toBe(true);
    expect(isUnlimited(20)).toBe(false);
  });
});
