/**
 * One-off: delete all waitlist_submissions rows (test reset).
 * Usage: npx tsx --env-file-if-exists=.env scripts/clear-waitlist-submissions.ts
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { count, error: countErr } = await supabase
    .from("waitlist_submissions")
    .select("*", { count: "exact", head: true });

  if (countErr) throw countErr;

  const { error } = await supabase.from("waitlist_submissions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  if (error) throw error;

  console.log(`Cleared ${count ?? 0} waitlist_submissions row(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
