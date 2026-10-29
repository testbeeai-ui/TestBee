import path from "path";
import { chromium, expect, test, type Page } from "@playwright/test";

const profileDir = path.join(process.cwd(), "e2e", ".auth", "chrome-profile");
const videoDir = path.join(process.cwd(), "e2e", "before-signin", "recordings");

async function pause(page: Page, ms = 1200) {
  await page.waitForTimeout(ms);
}

async function lookAround(page: Page) {
  await page.mouse.wheel(0, 420);
  await pause(page, 700);
  await page.mouse.wheel(0, -420);
  await pause(page, 400);
}

async function closeTeacherWizard(page: Page) {
  const wizard = page.getByRole("dialog", { name: "Teacher Wizard" });
  if (!(await wizard.isVisible().catch(() => false))) return;
  await pause(page, 1000);
  const close = wizard.getByRole("button", { name: "Close" });
  if (await close.isVisible().catch(() => false)) {
    await close.click();
  } else {
    await page.keyboard.press("Escape");
  }
  await pause(page, 600);
}

async function openSection(page: Page, name: string) {
  process.stdout.write(`OPEN ${name}\n`);
  await closeTeacherWizard(page);
  await page.getByRole("button", { name, exact: true }).click({ timeout: 15_000 });
  await pause(page, 1400);
  await lookAround(page);
}

test("signed-in teacher walks the portal", async () => {
  test.setTimeout(600_000);

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 900 },
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
    slowMo: 160,
    recordVideo: { dir: videoDir, size: { width: 1440, height: 900 } },
  });

  const page = context.pages()[0] ?? (await context.newPage());
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
  });

  try {
    process.stdout.write("OPEN teacher portal\n");
    await page.goto("http://localhost:3000/teacher-portal", { waitUntil: "domcontentloaded" });
    await pause(page, 1200);
    process.stdout.write(`AT ${page.url()}\n`);

    if (!page.url().includes("/teacher-portal")) {
      await page.goto("http://localhost:3000/preview", { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "Continue with Google" }).click();
      process.stdout.write("SIGN IN NOW: choose your Google account in this Chrome window.\n");
      await page.waitForURL(/\/teacher-portal/, { timeout: 300_000 });
      process.stdout.write(`IN ${page.url()}\n`);
      await pause(page, 1500);
    }

    await closeTeacherWizard(page);

    for (const name of [
      "My Classroom",
      "My lessons",
      "Gyan++ Wall",
      "Create Tests",
      "Refer & earn",
      "Subscriptions",
      "Profile",
    ]) {
      await openSection(page, name);
      await closeTeacherWizard(page);
    }

    await page.getByRole("button", { name: "Create Assignment" }).click();
    await pause(page, 1600);
    await lookAround(page);
    const cancel = page.getByRole("button", { name: /Cancel|Back/ }).first();
    if (await cancel.isVisible().catch(() => false)) {
      await cancel.click();
    } else {
      await page.getByRole("button", { name: "My Classroom", exact: true }).click();
    }
    await pause(page, 1200);
    await closeTeacherWizard(page);
    await pause(page, 1500);
  } finally {
    await context.close();
  }
});
