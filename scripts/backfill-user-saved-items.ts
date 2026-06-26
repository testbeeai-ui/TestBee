/**
 * One-off: copy profiles JSONB saved columns into normalized tables.
 *
 * Usage:
 *   npx tsx --env-file-if-exists=.env scripts/backfill-user-saved-items.ts
 *   npx tsx --env-file-if-exists=.env scripts/backfill-user-saved-items.ts --user-id=<uuid>
 *   npx tsx --env-file-if-exists=.env scripts/backfill-user-saved-items.ts --dry-run
 *   npx tsx --env-file-if-exists=.env scripts/backfill-user-saved-items.ts --engagement --bits
 */
import { createClient } from "@supabase/supabase-js";
import type { ItemType } from "../lib/saved/savedItemCap";
import { toSavedItemRow } from "../lib/saved/userSavedItemsSync";
import { upsertSavedItemRows } from "../lib/saved/userSavedItemsSync";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const withEngagement = args.includes("--engagement");
const withBits = args.includes("--bits");
const userIdArg = args.find((a) => a.startsWith("--user-id="))?.split("=")[1]?.trim();

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type ProfileSavedRow = {
  id: string;
  saved_bits?: unknown;
  saved_formulas?: unknown;
  saved_revision_cards?: unknown;
  saved_revision_units?: unknown;
  saved_community_posts?: unknown;
  subtopic_engagement?: unknown;
  bits_test_attempts?: unknown;
};

const SAVED_FIELDS: { column: keyof ProfileSavedRow; itemType: ItemType }[] = [
  { column: "saved_bits", itemType: "saved_bit" },
  { column: "saved_formulas", itemType: "saved_formula" },
  { column: "saved_revision_cards", itemType: "saved_revision_card" },
  { column: "saved_revision_units", itemType: "saved_revision_unit" },
  { column: "saved_community_posts", itemType: "saved_community_post" },
];

function asArray(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Record<
    string,
    unknown
  >[];
}

async function backfillSavedItems(userId: string, profile: ProfileSavedRow): Promise<number> {
  let rows = 0;
  for (const { column, itemType } of SAVED_FIELDS) {
    const items = asArray(profile[column]);
    if (items.length === 0) continue;
    const mapped = items.map((item) => toSavedItemRow(userId, itemType, item));
    rows += mapped.length;
    if (!dryRun) {
      const { error } = await upsertSavedItemRows(supabase, mapped);
      if (error) throw new Error(`${userId} ${itemType}: ${error}`);
    }
  }
  return rows;
}

async function backfillEngagement(userId: string, profile: ProfileSavedRow): Promise<number> {
  const raw = profile.subtopic_engagement;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) return 0;
  if (!dryRun) {
    const payload = entries
      .filter(([, v]) => v && typeof v === "object")
      .map(([storage_key, snapshot]) => ({
        user_id: userId,
        storage_key,
        snapshot,
        updated_at:
          typeof (snapshot as { updatedAt?: string }).updatedAt === "string"
            ? (snapshot as { updatedAt: string }).updatedAt
            : new Date().toISOString(),
      }));
    const { error } = await supabase
      .from("student_subtopic_engagement")
      .upsert(payload, { onConflict: "user_id,storage_key" });
    if (error) throw new Error(`${userId} engagement: ${error.message}`);
  }
  return entries.length;
}

async function backfillBits(userId: string, profile: ProfileSavedRow): Promise<number> {
  const raw = profile.bits_test_attempts;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length === 0) return 0;
  if (!dryRun) {
    const payload = entries
      .filter(([, v]) => v && typeof v === "object")
      .map(([attempt_key, attempt]) => ({
        user_id: userId,
        attempt_key,
        attempt,
        submitted_at:
          typeof (attempt as { submittedAt?: string }).submittedAt === "string"
            ? (attempt as { submittedAt: string }).submittedAt
            : new Date().toISOString(),
      }));
    const { error } = await supabase
      .from("student_bits_attempts")
      .upsert(payload, { onConflict: "user_id,attempt_key" });
    if (error) throw new Error(`${userId} bits: ${error.message}`);
  }
  return entries.length;
}

async function processProfile(profile: ProfileSavedRow): Promise<void> {
  const savedRows = await backfillSavedItems(profile.id, profile);
  const engagementRows = withEngagement ? await backfillEngagement(profile.id, profile) : 0;
  const bitsRows = withBits ? await backfillBits(profile.id, profile) : 0;
  console.log(
    JSON.stringify({
      userId: profile.id,
      savedItems: savedRows,
      engagementRows,
      bitsRows,
      dryRun,
    })
  );
}

async function main() {
  if (userIdArg) {
    const selectCols = [
      "id",
      "saved_bits",
      "saved_formulas",
      "saved_revision_cards",
      "saved_revision_units",
      "saved_community_posts",
      ...(withEngagement ? ["subtopic_engagement"] : []),
      ...(withBits ? ["bits_test_attempts"] : []),
    ].join(", ");
    const { data, error } = await supabase
      .from("profiles")
      .select(selectCols)
      .eq("id", userIdArg)
      .maybeSingle();
    if (error) throw error;
    if (!data) {
      console.error(`No profile for ${userIdArg}`);
      process.exit(2);
    }
    await processProfile(data as ProfileSavedRow);
    return;
  }

  const pageSize = 100;
  let from = 0;
  while (true) {
    const selectCols = [
      "id",
      "saved_bits",
      "saved_formulas",
      "saved_revision_cards",
      "saved_revision_units",
      "saved_community_posts",
      ...(withEngagement ? ["subtopic_engagement"] : []),
      ...(withBits ? ["bits_test_attempts"] : []),
    ].join(", ");
    const { data, error } = await supabase
      .from("profiles")
      .select(selectCols)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as ProfileSavedRow[];
    if (rows.length === 0) break;
    for (const profile of rows) {
      const hasSaved = SAVED_FIELDS.some((f) => asArray(profile[f.column]).length > 0);
      const hasEngagement =
        withEngagement &&
        profile.subtopic_engagement &&
        typeof profile.subtopic_engagement === "object" &&
        Object.keys(profile.subtopic_engagement as object).length > 0;
      const hasBits =
        withBits &&
        profile.bits_test_attempts &&
        typeof profile.bits_test_attempts === "object" &&
        Object.keys(profile.bits_test_attempts as object).length > 0;
      if (!hasSaved && !hasEngagement && !hasBits) continue;
      await processProfile(profile);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
