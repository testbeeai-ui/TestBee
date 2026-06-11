import type { SupabaseClient } from "@supabase/supabase-js";
import { waitlistSubmissionsTable } from "@/lib/waitlist/waitlistDb";

export const WAITLIST_ID_PREFIX = "EB-2026-";
export const WAITLIST_ID_START = 253;

/** Admin/test inboxes — may register multiple times for QA */
export const WAITLIST_TEST_EMAILS = new Set([
  "michaelkillgta@gmail.com",
  "testbeeai@gmail.com",
  "mailidpwd@gmail.com",
]);

export function normalizeWaitlistEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isWaitlistTestEmail(email: string): boolean {
  return WAITLIST_TEST_EMAILS.has(normalizeWaitlistEmail(email));
}

function parseWaitlistIdNumber(waitlistId: string): number | null {
  const match = waitlistId.match(/^EB-2026-(\d+)$/);
  if (!match) return null;
  const n = Number.parseInt(match[1], 10);
  return Number.isFinite(n) ? n : null;
}

export async function generateNextWaitlistId(
  client: SupabaseClient
): Promise<string> {
  const table = waitlistSubmissionsTable(client);
  const { data: rows, error } = await table
    .select("waitlist_id")
    .like("waitlist_id", `${WAITLIST_ID_PREFIX}%`);

  if (error) {
    throw new Error(`Failed to load waitlist IDs: ${error.message}`);
  }

  let maxNum = WAITLIST_ID_START - 1;
  for (const row of rows ?? []) {
    const n = parseWaitlistIdNumber(row.waitlist_id);
    if (n !== null) maxNum = Math.max(maxNum, n);
  }

  const next = Math.max(maxNum + 1, WAITLIST_ID_START);
  return `${WAITLIST_ID_PREFIX}${next}`;
}
