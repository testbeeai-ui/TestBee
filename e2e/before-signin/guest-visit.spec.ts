import { expect, test, type Page } from "@playwright/test";

test.use({
  viewport: { width: 1440, height: 900 },
  video: { mode: "on", size: { width: 1440, height: 900 } },
});

async function pause(page: Page, ms = 1400) {
  await page.waitForTimeout(ms);
}

/** Scroll the way a person glances down a page, then come back up. */
async function lookAround(page: Page) {
  await page.mouse.wheel(0, 560);
  await pause(page, 900);
  await page.mouse.wheel(0, 480);
  await pause(page, 800);
  await page.mouse.wheel(0, -780);
  await pause(page, 600);
}

function bar(page: Page) {
  return page.locator("#top");
}

async function goHome(page: Page) {
  await bar(page).getByRole("link", { name: "Home" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await pause(page, 800);
}

test("a guest walks the public site in one visit", async ({ page }) => {
  test.setTimeout(300_000);

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Learning that feels like");
  await pause(page, 1600);
  await lookAround(page);

  await bar(page).getByRole("link", { name: "Features" }).click();
  await expect(page.locator("#investor-features")).toBeVisible();
  await pause(page, 1500);

  await bar(page).getByRole("link", { name: "Edufundz" }).click();
  await expect(page.locator("#investor-edufund")).toBeVisible();
  await pause(page, 1500);

  await page.getByRole("button", { name: "For Teachers" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Your expertise should earn you");
  await pause(page, 1500);
  await page.getByRole("button", { name: "For Students" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Learning that feels like");
  await pause(page, 1000);

  await page.getByRole("button", { name: "Watch demo" }).click();
  await expect(page).toHaveURL(/localhost:3000\/(#|$)/);
  await pause(page, 1000);

  await bar(page).getByRole("link", { name: "About Us" }).click();
  await expect(page).toHaveURL(/\/about-us$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("habit engine");
  await lookAround(page);
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Learning that feels like");
  await pause(page);

  await bar(page).getByRole("link", { name: "News & Blogs" }).click();
  await expect(page).toHaveURL(/\/news-blog/);
  await expect(page).toHaveTitle(/News/);
  await lookAround(page);
  await goHome(page);

  await bar(page).getByRole("link", { name: "Ts & Cs" }).click();
  await expect(page).toHaveURL(/\/terms-conditions$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Legal");
  await pause(page, 1200);
  await page.getByRole("link", { name: /Privacy Policy/ }).first().click();
  await expect(page).toHaveURL(/\/terms-conditions\/privacy-policy/);
  await expect(page).toHaveTitle(/Privacy Policy/);
  await lookAround(page);
  await page.getByRole("link", { name: /Terms & Conditions/ }).first().click();
  await expect(page).toHaveURL(/\/terms-conditions\/terms-and-conditions/);
  await expect(page).toHaveTitle(/Terms and Conditions/);
  await lookAround(page);
  await goHome(page);

  await bar(page).getByRole("link", { name: "Pricing" }).click();
  await expect(page).toHaveURL(/\/pricing$/);
  await expect(page.getByRole("heading", { name: "Choose a plan" })).toBeVisible();
  await pause(page, 1200);
  await lookAround(page);
  await page.getByRole("button", { name: "Annual" }).click();
  await expect(page.getByText("Annual plans are coming soon")).toBeVisible();
  await pause(page, 1400);

  await bar(page).getByRole("link", { name: "Contact Us" }).click();
  await expect(page).toHaveURL(/\/contact$/);
  await expect(page.getByRole("heading", { name: "How can we help you?" })).toBeVisible();
  await pause(page, 1000);
  await page.getByRole("button", { name: /Sales or partner/ }).click();
  await expect(page.getByPlaceholder("e.g. Priya Mehta")).toBeVisible();
  await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  await pause(page, 1600);
  await goHome(page);

  await page.getByRole("contentinfo").getByRole("link", { name: "EduDeca" }).click();
  await expect(page).toHaveURL(/\/edudeca$/);
  await expect(page.getByRole("heading", { name: "Start Today …" })).toBeVisible();
  await pause(page, 1200);
  const class11 = page.getByRole("button", { name: "Class 11" });
  await class11.click();
  await expect(class11).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Register interest" })).toBeDisabled();
  await pause(page, 1400);
  await goHome(page);

  await bar(page).getByRole("button", { name: "Sign in" }).click();
  const notice = page.getByRole("dialog");
  await expect(notice.getByRole("heading", { name: "Waitlist" })).toBeVisible();
  await expect(notice.getByRole("button", { name: "Join Waitlist Now" })).toBeVisible();
  await pause(page, 1600);
  await page.keyboard.press("Escape");
  await expect(notice).toBeHidden();
  await pause(page, 700);

  await bar(page).getByRole("button", { name: "Join Now" }).click();
  await expect(page).toHaveURL(/\/waitlist/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("PCM students love studying");
  await expect(page.getByPlaceholder("yourname@email.com")).toBeVisible();
  await lookAround(page);
  await page.getByRole("button", { name: "Register as Ambassador now" }).click();
  await expect(page).toHaveURL(/\/waitlist/);
  await pause(page, 1200);
  await page.getByRole("link", { name: "EduBlast Logo" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await pause(page, 800);

  await page.getByRole("button", { name: "For Teachers" }).click();
  await pause(page, 700);
  await page.getByRole("button", { name: "Apply as teacher", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\?role=teacher/);
  await pause(page, 1200);
  await page.getByRole("button", { name: /Google/ }).first().click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Waitlist" })).toBeVisible();
  await pause(page, 1500);
  await page.keyboard.press("Escape");
  await pause(page, 600);
  await page.getByRole("link", { name: "Back to home" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await pause(page, 800);

  await page.getByRole("link", { name: "Enter the Gyan ++ Wall" }).click();
  await expect(page).toHaveURL(/\/\?next=(%2F|\/)magic-wall/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Learning that feels like");
  await pause(page, 2000);
});
