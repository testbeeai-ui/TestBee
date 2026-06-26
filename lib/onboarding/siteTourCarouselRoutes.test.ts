import { describe, expect, it } from "vitest";
import {
  ONBOARDING_CHECKLIST_COMPLETION_BONUS_RDM,
  ONBOARDING_CHECKLIST_TOTAL_RDM,
  siteTourCarouselSlidesRdmSubtotal,
} from "@/lib/onboarding/onboardingChecklistRdm";
import {
  resolveSiteTourIndexForPathname,
  resolveSiteTourTaskIdForPathname,
  siteTourContextLabelForPathname,
} from "@/lib/onboarding/siteTourCarouselRoutes";

describe("onboardingChecklistRdm", () => {
  it("balances tour slide RDM + completion bonus to 100", () => {
    expect(siteTourCarouselSlidesRdmSubtotal() + ONBOARDING_CHECKLIST_COMPLETION_BONUS_RDM).toBe(
      ONBOARDING_CHECKLIST_TOTAL_RDM
    );
  });
});

describe("siteTourCarouselRoutes", () => {
  it("maps Magic Wall route to magic_wall task", () => {
    expect(resolveSiteTourTaskIdForPathname("/magic-wall")).toBe("magic_wall");
    expect(siteTourContextLabelForPathname("/magic-wall")).toBe("Magic Wall");
  });

  it("maps Dashboard home route to dashboard slide", () => {
    expect(resolveSiteTourTaskIdForPathname("/home")).toBe("dashboard");
    expect(siteTourContextLabelForPathname("/home")).toBe("Dashboard");
  });

  it("maps Prep + Mock hub to prep_mock slide", () => {
    expect(resolveSiteTourTaskIdForPathname("/mock")).toBe("prep_mock");
    expect(resolveSiteTourTaskIdForPathname("/mock-test")).toBe("prep_mock");
    expect(resolveSiteTourTaskIdForPathname("/classrooms")).toBe("prep_mock");
  });

  it("maps lessons and curriculum routes to lessons task", () => {
    expect(resolveSiteTourTaskIdForPathname("/explore-1")).toBe("lessons");
    expect(
      resolveSiteTourTaskIdForPathname("/cbse/physics/class-11/unit/topic/subtopic/basic")
    ).toBe("lessons");
  });

  it("opens Magic Wall at magic_wall slide index", () => {
    const index = resolveSiteTourIndexForPathname("/magic-wall");
    expect(index).not.toBeNull();
    expect(index).toBeGreaterThanOrEqual(0);
  });
});
