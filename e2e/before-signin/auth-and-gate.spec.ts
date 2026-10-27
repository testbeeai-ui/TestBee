import { expect, test } from "@playwright/test";

test.describe("sign-in page before an account is chosen", () => {
  test("google and sign up both open the waitlist notice", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    await page.getByRole("button", { name: "Continue with Google" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Waitlist" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Sign up now" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Waitlist" })).toBeVisible();
  });

  test("the create-account panel switches student and teacher", async ({ page }) => {
    await page.goto("/auth?mode=signup");
    await expect(page.getByText("Create your account")).toBeVisible();
    await page.getByRole("button", { name: "Teacher Create & manage classes" }).click();
    await page.getByRole("checkbox", { name: "I approve all the" }).check();
    await page.getByRole("button", { name: "Sign up as Teacher with Google" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Waitlist" })).toBeVisible();
  });

  test("the old role page lands on sign-in", async ({ page }) => {
    await page.goto("/auth-choice");
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("select-role lands on the create-account panel", async ({ page }) => {
    await page.goto("/select-role");
    await expect(page).toHaveURL(/\/auth\?mode=signup/);
    await expect(page.getByText("Create your account")).toBeVisible();
  });
});

test.describe("pages that require an account", () => {
  for (const path of ["/home", "/play", "/teacher-portal"]) {
    test(`${path} sends a guest back to the landing page`, async ({ page }) => {
      await page.goto(path);
      const encoded = encodeURIComponent(path);
      await expect(page).toHaveURL(new RegExp(`\\?next=${encoded}`));
      await expect(page.getByRole("heading", { level: 1 })).toContainText("Learning that feels like");
    });
  }
});
