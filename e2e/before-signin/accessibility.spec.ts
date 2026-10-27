import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/about-us",
  "/news-blog",
  "/terms-conditions",
  "/terms-conditions/privacy-policy",
  "/terms-conditions/terms-and-conditions",
  "/pricing",
  "/contact",
  "/waitlist",
  "/edudeca",
  "/auth",
  "/join",
  "/magic-wall",
];

for (const route of publicRoutes) {
  test(`${route} has no automated WCAG 2.2 A/AA violations`, async ({ page }) => {
    await page.goto(route);

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"])
      .analyze();

    const violations = results.violations.map(({ id, impact, description, nodes }) => ({
      id,
      impact,
      description,
      nodes: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
    }));

    expect(violations, JSON.stringify(violations)).toEqual([]);
  });
}
