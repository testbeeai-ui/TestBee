/**
 * Verifier for the past-paper image migration.
 *
 *   1. Scans past_paper_questions for the 19 KCET papers and asserts
 *      zero references to https://www.testbee.in/ remain.
 *   2. Extracts every <img src="...past-paper-images/..."> URL, deduplicates,
 *      and HEAD-checks each one (concurrency 8, retry 3) — fails loudly on
 *      any non-200.
 *
 *   npx tsx --env-file-if-exists=.env scripts/verify-past-paper-images.ts
 */
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
}
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const BUCKET_FRAG = "/storage/v1/object/public/past-paper-images/";
const LEGACY_RE = /https?:\/\/(?:www\.)?testbee\.in\/preview\/show_qimage\/[^\s")]+/g;
const SRC_RE = /src="\s*(https?:\/\/[^\s"]+)\s*"/g;
const CONCURRENCY = 8;

async function main() {
  const { data: papers, error: pErr } = await supabase
    .from("past_papers")
    .select("id, slug")
    .ilike("slug", "kcet-%");
  if (pErr) throw pErr;
  if (!papers || papers.length === 0) throw new Error("No KCET papers found.");
  const paperIds = papers.map((p) => p.id);
  console.log(`Verifying ${papers.length} KCET papers.`);

  const PAGE = 500;
  const all: { id: string; q: string | null; s: string | null }[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("past_paper_questions")
      .select("id, question_html, solution_html")
      .in("paper_id", paperIds)
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    for (const r of data) {
      all.push({ id: r.id, q: r.question_html, s: r.solution_html });
    }
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Loaded ${all.length} rows.`);

  // 1. Legacy references?
  let legacyCount = 0;
  const newUrls = new Set<string>();
  for (const r of all) {
    for (const h of [r.q, r.s]) {
      if (!h) continue;
      let m: RegExpExecArray | null;
      LEGACY_RE.lastIndex = 0;
      while ((m = LEGACY_RE.exec(h)) !== null) legacyCount++;
      SRC_RE.lastIndex = 0;
      while ((m = SRC_RE.exec(h)) !== null) {
        if (m[1].includes(BUCKET_FRAG)) newUrls.add(m[1]);
      }
    }
  }
  console.log(`Legacy testbee.in refs remaining: ${legacyCount}`);
  console.log(`Unique Supabase storage URLs referenced: ${newUrls.size}`);

  if (legacyCount > 0) {
    console.error("FAIL: legacy URLs still present.");
    process.exit(1);
  }
  if (newUrls.size === 0) {
    console.log("No images referenced in KCET papers — nothing to HEAD-check.");
    return;
  }

  // 2. HEAD-check every URL with concurrency 8.
  const urlList = [...newUrls];
  let ok = 0;
  let bad = 0;
  const failures: Array<{ url: string; status: number | string }> = [];
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (true) {
        const i = cursor++;
        if (i >= urlList.length) return;
        const url = urlList[i]!;
        let lastStatus: number | string = "?";
        let success = false;
        for (let attempt = 1; attempt <= 3 && !success; attempt++) {
          try {
            const r = await fetch(url, { method: "HEAD" });
            lastStatus = r.status;
            if (r.status === 200) {
              success = true;
              ok++;
              break;
            }
          } catch (e) {
            lastStatus = String(e);
          }
          await new Promise((r) => setTimeout(r, 200 * attempt));
        }
        if (!success) {
          bad++;
          failures.push({ url, status: lastStatus });
        }
      }
    })
  );
  console.log(`HEAD-check: ${ok} OK, ${bad} failed.`);
  if (bad > 0) {
    for (const f of failures.slice(0, 10)) console.log("  FAIL", f.status, f.url);
    process.exit(1);
  }
  console.log("VERIFY PASS.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
