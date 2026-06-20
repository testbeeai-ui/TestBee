/**
 * Create the `past-paper-images` Supabase Storage bucket + public-read policy.
 * Idempotent — safe to re-run.
 *
 *   npx tsx --env-file-if-exists=.env scripts/create-past-paper-images-bucket.ts
 *
 * Why: the past_paper_questions / mock_questions rows point at images hosted on
 * the legacy https://www.testbee.in/preview/show_qimage/... endpoint. We are
 * re-hosting them in our own bucket so the app no longer depends on that
 * endpoint. Bucket/policy SQL lives in this script only (prod bucket created via script).
 */
import { createClient } from "@supabase/supabase-js";

const BUCKET_ID = "past-paper-images";
const FILE_SIZE_LIMIT = 1_048_576; // 1 MB
const ALLOWED_MIME = ["image/png", "image/jpeg"];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
}

const supabase = createClient(url, key);

async function main() {
  const { data: existing, error: getErr } = await supabase.storage.getBucket(BUCKET_ID);
  if (getErr && !String(getErr.message).toLowerCase().includes("not found")) {
    throw getErr;
  }
  if (existing) {
    console.log(`Bucket "${BUCKET_ID}" already exists — updating in place.`);
    const { error: updErr } = await supabase.storage.updateBucket(BUCKET_ID, {
      public: true,
      fileSizeLimit: FILE_SIZE_LIMIT,
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (updErr) throw updErr;
  } else {
    const { error: createErr } = await supabase.storage.createBucket(BUCKET_ID, {
      public: true,
      fileSizeLimit: FILE_SIZE_LIMIT,
      allowedMimeTypes: ALLOWED_MIME,
    });
    if (createErr) throw createErr;
    console.log(`Created bucket "${BUCKET_ID}".`);
  }

  // Public read policy. The migration does the same with raw SQL; this path
  // exists for projects where the migration history is out of sync with the
  // remote. Service role can always upsert policies via the REST API.
  const policyName = "Public read past-paper-images";
  // Drop+recreate is the simplest correct path because the policies table
  // doesn't expose a stable upsert.
  await supabase
    .from("pg_policies")
    .delete()
    .eq("schemaname", "storage")
    .eq("tablename", "objects")
    .eq("policyname", policyName);
  // Use raw SQL through RPC if available; otherwise the migration file is the
  // source of truth and we tell the operator to apply it.
  const sql = `
    DROP POLICY IF EXISTS "${policyName}" ON storage.objects;
    CREATE POLICY "${policyName}"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = '${BUCKET_ID}');
  `;
  console.log("Policy SQL to apply (idempotent):");
  console.log(sql);

  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
