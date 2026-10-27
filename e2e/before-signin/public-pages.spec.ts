import { expect, test } from "@playwright/test";

test.describe("public pages before sign-in", () => {
  test("about us", async ({ page }) => {
    await page.goto("/about-us");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("habit engine");
  });

  test("pricing shows plans and does not open a payment window", async ({ page }) => {
    await page.goto("/pricing");
    await expect(page.getByRole("heading", { name: "Choose a plan" })).toBeVisible();
    await page.getByRole("button", { name: "Annual" }).click();
    await expect(page.getByText("Annual plans are coming soon")).toBeVisible();
  });

  test("contact opens a category and shows the detail fields", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.getByRole("heading", { name: "How can we help you?" })).toBeVisible();
    await page.getByRole("button", { name: /Sales or partner/ }).click();
    await expect(page.getByPlaceholder("e.g. Priya Mehta")).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  });

  test("news and blogs stays on its public address", async ({ page }) => {
    await page.goto("/news-blog");
    await expect(page).toHaveURL(/\/news-blog/);
    await expect(page).toHaveTitle(/News/);
  });

  test("terms, privacy, and the terms document", async ({ page }) => {
    await page.goto("/terms-conditions");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Legal");

    await page.goto("/terms-conditions/privacy-policy");
    await expect(page).toHaveTitle(/Privacy Policy/);

    await page.goto("/terms-conditions/terms-and-conditions");
    await expect(page).toHaveTitle(/Terms and Conditions/);
  });

  test("waitlist shows the form and the ambassador button", async ({ page }) => {
    await page.goto("/waitlist");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("PCM students love studying");
    await expect(page.getByPlaceholder("yourname@email.com")).toBeVisible();
    await page.getByRole("button", { name: "Register as Ambassador now" }).click();
    await expect(page).toHaveURL(/\/waitlist/);
  });

  test("edudeca interest form can select a class", async ({ page }) => {
    await page.goto("/edudeca");
    await expect(page.getByRole("heading", { name: "Start Today …" })).toBeVisible();
    const class11 = page.getByRole("button", { name: "Class 11" });
    await class11.click();
    await expect(class11).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Register interest" })).toBeDisabled();
  });

  test("join by code accepts a code without sending it", async ({ page }) => {
    await page.goto("/join");
    await expect(page.getByRole("heading", { name: "Join a classroom" })).toBeVisible();
    const code = page.getByPlaceholder("6-character code");
    await code.fill("AB12CD");
    await expect(code).toHaveValue("AB12CD");
    await expect(page).toHaveURL(/\/join$/);
  });

  test("razorpay demo shows the sample amount and does not check out", async ({ page }) => {
    await page.goto("/razorpay-demo");
    await expect(page.getByRole("heading", { name: "Razorpay Standard Checkout" })).toBeVisible();
    await expect(page.getByText("₹500.00")).toBeVisible();
  });

  test("a friend invite opens the invite notice", async ({ page }) => {
    await page.goto("/join?ref=A1B2C3D");
    await expect(page.getByRole("heading", { name: "Your friend invited you" })).toBeVisible();
    await page.getByRole("button", { name: "Go now" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
  });
});
