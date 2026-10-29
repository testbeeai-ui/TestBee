import { defineConfig, devices } from "@playwright/test";

const headedLocally = !process.env.CI;
const slowMoMs = process.env.CI ? 0 : Number(process.env.PLAYWRIGHT_SLOW_MO ?? 80);

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/before-signin/recordings",
  fullyParallel: true,
  workers: headedLocally ? 1 : undefined,
  retries: process.env.CI ? 2 : 0,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://localhost:3000",
    trace: "on",
    video: "on",
    screenshot: "only-on-failure",
    headless: !headedLocally,
    launchOptions: { slowMo: Number.isFinite(slowMoMs) ? slowMoMs : 0 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev:turbo",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
