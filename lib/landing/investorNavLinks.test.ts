import { describe, expect, it } from "vitest";

import { INVESTOR_NAV_LINKS } from "@/components/landing/landing-constants";

describe("INVESTOR_NAV_LINKS", () => {
  it("keeps the original eight center items so the bar does not crowd logo or CTAs", () => {
    expect(INVESTOR_NAV_LINKS.map((link) => link.label)).toEqual([
      "Home",
      "About Us",
      "Features",
      "News & Blogs",
      "Ts & Cs",
      "Edufundz",
      "Pricing",
      "Contact Us",
    ]);
  });
});
