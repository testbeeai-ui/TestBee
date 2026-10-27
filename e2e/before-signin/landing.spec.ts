import { expect, test } from "@playwright/test";

test.describe("landing page before sign-in", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("shows the student headline", async ({ page }) => {
    await expect(page).toHaveTitle(/EduBlast/);
    const headline = page.getByRole("heading", { level: 1 });
    await expect(headline).toContainText("Learning that feels like");
    await expect(headline).toContainText("exam winner");
    await expect(page.getByRole("button", { name: "For Students" })).toBeVisible();
    await expect(page.getByRole("button", { name: "For Teachers" })).toBeVisible();
  });

  test("switches the hero to the teacher view", async ({ page }) => {
    await page.getByRole("button", { name: "For Teachers" }).click();
    const headline = page.getByRole("heading", { level: 1 });
    await expect(headline).toContainText("Your expertise should earn you");
    await expect(headline).toContainText("income");
    await expect(page.getByRole("button", { name: "Apply as teacher", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Apply as teacher ambassador" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Watch teacher demo" })).toBeVisible();
  });

  test("student join opens the waitlist page", async ({ page }) => {
    await page.getByRole("button", { name: "Join free — 2 minutes" }).click();
    await expect(page).toHaveURL(/\/waitlist/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PCM students love studying");
  });

  test("teacher apply opens the teacher sign-up page", async ({ page }) => {
    await page.getByRole("button", { name: "For Teachers" }).click();
    await page.getByRole("button", { name: "Apply as teacher", exact: true }).click();
    await expect(page).toHaveURL(/\/auth\?role=teacher/);
  });

  test("watch demo stays on the landing page", async ({ page }) => {
    await page.getByRole("button", { name: "Watch demo" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test("sign in opens the waitlist notice and closing it returns to the page", async ({ page }) => {
    await page.getByRole("navigation").getByRole("button", { name: "Sign in" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Waitlist" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Join Waitlist Now" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test("join waitlist from the notice goes to the waitlist", async ({ page }) => {
    await page.getByRole("navigation").getByRole("button", { name: "Sign in" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Join Waitlist Now" }).click();
    await expect(page).toHaveURL(/\/waitlist/);
  });

  test("join now in the header goes to the waitlist", async ({ page }) => {
    await page.getByRole("navigation").getByRole("button", { name: "Join Now" }).click();
    await expect(page).toHaveURL(/\/waitlist/);
  });

  test("header links open the public pages and on-page sections", async ({ page }) => {
    const nav = page.getByRole("navigation");

    await nav.getByRole("link", { name: "About Us" }).click();
    await expect(page).toHaveURL(/\/about-us$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("habit engine");

    await page.goto("/");
    await nav.getByRole("link", { name: "Features" }).click();
    await expect(page).toHaveURL(/\/#investor-features$/);
    await expect(page.locator("#investor-features")).toBeVisible();

    await nav.getByRole("link", { name: "News & Blogs" }).click();
    await expect(page).toHaveURL(/\/news-blog/);

    await page.goto("/");
    await nav.getByRole("link", { name: "Ts & Cs" }).click();
    await expect(page).toHaveURL(/\/terms-conditions$/);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Legal");

    await page.goto("/");
    await nav.getByRole("link", { name: "Edufundz" }).click();
    await expect(page).toHaveURL(/\/#investor-edufund$/);
    await expect(page.locator("#investor-edufund")).toBeVisible();

    await nav.getByRole("link", { name: "Pricing" }).click();
    await expect(page).toHaveURL(/\/pricing$/);
    await expect(page.getByRole("heading", { name: "Choose a plan" })).toBeVisible();

    await page.goto("/");
    await nav.getByRole("link", { name: "Contact Us" }).click();
    await expect(page).toHaveURL(/\/contact$/);
    await expect(page.getByRole("heading", { name: "How can we help you?" })).toBeVisible();
  });

  test("the wall link sends a guest back to the landing with the page remembered", async ({ page }) => {
    await page.getByRole("link", { name: "Enter the Gyan ++ Wall" }).click();
    await expect(page).toHaveURL(/\/\?next=(%2F|\/)magic-wall/);
  });
});

test.describe("landing page on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the menu opens sign-in and join", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Toggle menu" }).click();
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Waitlist" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.getByRole("button", { name: "Toggle menu" }).click();
    await page.getByRole("button", { name: "Join Now" }).click();
    await expect(page).toHaveURL(/\/waitlist/);
  });
});
