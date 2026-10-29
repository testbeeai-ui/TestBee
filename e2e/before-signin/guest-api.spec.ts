import { expect, test } from "@playwright/test";

test("chapter PYQ counts rejects an unauthenticated request", async ({ request }) => {
  const response = await request.get("/api/chapter-pyq/counts");

  expect(response.status()).toBe(401);
  await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
});
