import { describe, expect, it } from "vitest";
import {
  buildInactivePenaltyNotificationCopy,
  formatInactivePenaltyDayLabel,
  mapInactivePenaltyRowToBellItem,
} from "@/lib/notifications/inactivePenaltyNotifications";

describe("inactivePenaltyNotifications", () => {
  it("puts the cut amount in the title so the bell shows −50 RDM", () => {
    const copy = buildInactivePenaltyNotificationCopy(50, "2026-08-26");
    expect(copy.title).toContain("−50 RDM");
  });

  it("uses the stored penalty amount, not a hardcoded 50", () => {
    const copy = buildInactivePenaltyNotificationCopy(25, "2026-08-26");
    expect(copy.title).toContain("−25 RDM");
    expect(copy.title).not.toContain("−50 RDM");
    expect(copy.preview).toContain("−25 RDM");
  });

  it("preview and body mention the inactivity cut for that day", () => {
    const copy = buildInactivePenaltyNotificationCopy(50, "2026-08-26");
    expect(copy.preview).toContain("−50 RDM");
    expect(copy.body).toContain("**−50 RDM**");
    expect(copy.body.toLowerCase()).toMatch(/inactiv/);
  });

  it("formats the completed IST day for students", () => {
    expect(formatInactivePenaltyDayLabel("2026-08-26")).toMatch(/26/);
    expect(formatInactivePenaltyDayLabel("2026-08-26")).toMatch(/Aug/i);
  });

  it("maps a penalty row into a preloaded bell notification", () => {
    const item = mapInactivePenaltyRowToBellItem("user-1", {
      day: "2026-08-26",
      penalty_rdm: 50,
      penalized_at: "2026-08-27T04:30:00.000Z",
    });
    expect(item).not.toBeNull();
    expect(item?.id).toBe("inactive-penalty:user-1:2026-08-26");
    expect(item?.studentMessageKind).toBe("rdm_inactive_penalty");
    expect(item?.title).toContain("−50 RDM");
    expect(item?.rdmDelta).toBe(-50);
    expect(item?.created_at).toBe("2026-08-27T04:30:00.000Z");
  });

  it("skips rows with no deduction", () => {
    expect(
      mapInactivePenaltyRowToBellItem("user-1", {
        day: "2026-08-26",
        penalty_rdm: 0,
        penalized_at: "2026-08-27T04:30:00.000Z",
      })
    ).toBeNull();
  });
});
