/**
 * Re-host every <img src="https://www.testbee.in/preview/show_qimage/..."> in
 * the past_paper_questions rows for KCET papers into our own Supabase Storage
 * bucket `past-paper-images`. The DB row's question_html / solution_html
 * strings are rewritten in place to point at the new public URL.
 *
 *   DRY_RUN=1 \
 *   npx tsx --env-file-if-exists=.env scripts/migrate-past-paper-images.ts
 *
 *   npx tsx --env-file-if-exists=.env scripts/migrate-past-paper-images.ts
 *
 * Idempotent: a row whose URLs already point at the past-paper-images bucket
 * is left untouched. The migration only writes rows that actually changed.
 */
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import path from "node:path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = "past-paper-images";
const DRY_RUN = process.env.DRY_RUN === "1";
const CONCURRENCY = 8;
const MAX_RETRIES = 3;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const LEGACY_HOST = "https://www.testbee.in/preview/show_qimage/";
// Matches every <img ...> tag whose src points at the legacy endpoint,
// including the OCR-malformed case where junk text is glued onto the
// filename before the closing quote. We capture the URL and the trailing
// "garbage up to next quote" so we can rewrite the whole tag.
const LEGACY_RE = /src="\s*(https?:\/\/(?:www\.)?testbee\.in\/preview\/show_qimage\/[^\s"]+?)\s*[A-Za-z][^"]*?"/gi;
const LEGACY_RE_PLAIN = /src="\s*(https?:\/\/(?:www\.)?testbee\.in\/preview\/show_qimage\/[^\s"]+?)\s*"/gi;
const REWRITTEN_HOST_FRAGMENT = "/storage/v1/object/public/past-paper-images/";

type Row = {
  id: string;
  question_html: string | null;
  solution_html: string | null;
};

function extractLegacyUrls(html: string): string[] {
  const out: string[] = [];
  if (!html) return out;
  let m: RegExpExecArray | null;
  // First sweep: well-formed <img src="...show_qimage/<id>.<ext>"> tags.
  LEGACY_RE_PLAIN.lastIndex = 0;
  while ((m = LEGACY_RE_PLAIN.exec(html)) !== null) {
    out.push(m[1]);
  }
  // Second sweep: OCR-malformed tags with trailing junk glued onto the URL.
  // The "raw" capture includes the trailing junk; we strip it to the real
  // filename and the URL still resolves to a real image on the legacy host.
  LEGACY_RE.lastIndex = 0;
  while ((m = LEGACY_RE.exec(html)) !== null) {
    const raw = m[1];
    const clean = raw.match(/show_qimage\/[^\s"]+?\.(?:png|jpg|jpeg)/i)?.[0];
    if (clean) {
      out.push(`https://www.testbee.in/preview/${clean}`);
    }
  }
  return out;
}

function rewriteHtml(html: string, urlMap: Map<string, string>): string {
  if (!html) return html;
  let out = html.replace(LEGACY_RE_PLAIN, (_full, url: string) => {
    const next = urlMap.get(url);
    if (!next) return _full;
    return `src="${next}"`;
  });
  out = out.replace(LEGACY_RE, (_full, raw: string) => {
    const clean = raw.match(/show_qimage\/[^\s"]+?\.(?:png|jpg|jpeg)/i)?.[0];
    if (!clean) return _full;
    const canonical = `https://www.testbee.in/preview/${clean}`;
    const next = urlMap.get(canonical);
    if (!next) return _full;
    return `src="${next}"`;
  });
  return out;
}

async function downloadWithRetry(url: string, attempt = 1): Promise<Buffer> {
  const resp = await fetch(url, {
    headers: { "user-agent": "TestbeeImageMigrator/1.0 (+past-paper-images)" },
  });
  if (!resp.ok) {
    if (attempt < MAX_RETRIES) {
      const backoff = 250 * Math.pow(2, attempt - 1);
      await new Promise((r) => setTimeout(r, backoff));
      return downloadWithRetry(url, attempt + 1);
    }
    throw new Error(`HTTP ${resp.status} for ${url}`);
  }
  const ab = await resp.arrayBuffer();
  return Buffer.from(ab);
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, idx: number) => Promise<R>,
  onDone?: (item: T, idx: number, result: R) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      const r = await fn(items[i]!, i);
      results[i] = r;
      onDone?.(items[i]!, i, r);
    }
  });
  await Promise.all(workers);
  return results;
}

async function main() {
  console.log(`mode: ${DRY_RUN ? "DRY RUN" : "APPLY"}`);

  // 1. Find the 19 KCET papers by slug prefix.
  const { data: papers, error: paperErr } = await supabase
    .from("past_papers")
    .select("id, slug, title, exam_name")
    .ilike("slug", "kcet-%");
  if (paperErr) throw paperErr;
  if (!papers || papers.length === 0) {
    throw new Error("No KCET papers found in past_papers.");
  }
  console.log(`Found ${papers.length} KCET papers.`);

  const paperIds = papers.map((p) => p.id);

  // 2. Page through every question row for those papers.
  console.log("Loading question rows...");
  const PAGE = 500;
  const allRows: Row[] = [];
  let from = 0;
  while (true) {
    const to = from + PAGE - 1;
    const { data, error } = await supabase
      .from("past_paper_questions")
      .select("id, question_html, solution_html")
      .in("paper_id", paperIds)
      .range(from, to);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allRows.push(...(data as Row[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`Loaded ${allRows.length} question rows.`);

  // 3. Collect every distinct legacy URL.
  const uniqueUrls = new Set<string>();
  for (const r of allRows) {
    for (const u of extractLegacyUrls(r.question_html ?? "")) uniqueUrls.add(u);
    for (const u of extractLegacyUrls(r.solution_html ?? "")) uniqueUrls.add(u);
  }
  console.log(`Distinct legacy image URLs: ${uniqueUrls.size}`);

  if (uniqueUrls.size === 0) {
    console.log("Nothing to do.");
    return;
  }

  // 4. Download + hash + upload each unique URL.
  const urlList = [...uniqueUrls];
  const urlMap = new Map<string, string>(); // legacy -> new public URL
  const failures: Array<{ url: string; err: string }> = [];
  const hashToUrl = new Map<string, string>(); // content hash -> chosen public URL
  const usedNames = new Set<string>();
  let downloaded = 0;
  let uploaded = 0;
  let reused = 0;

  await runWithConcurrency(
    urlList,
    CONCURRENCY,
    async (legacyUrl) => {
      const ext = (legacyUrl.match(/\.([a-zA-Z0-9]+)(?:\?|$)/)?.[1] ?? "png").toLowerCase();
      const buf = await downloadWithRetry(legacyUrl);
      downloaded++;
      const hash = crypto.createHash("sha256").update(buf).digest("hex");
      const objectPath = `${hash}.${ext}`;

      let publicUrl = `${SUPABASE_URL}${REWRITTEN_HOST_FRAGMENT}${objectPath}`;

      // Re-use if we've already uploaded this content hash this run.
      if (hashToUrl.has(hash)) {
        publicUrl = hashToUrl.get(hash)!;
        reused++;
        urlMap.set(legacyUrl, publicUrl);
        return;
      }

      if (!DRY_RUN) {
        if (!usedNames.has(objectPath)) {
          const { error: upErr } = await supabase.storage
            .from(BUCKET)
            .upload(objectPath, buf, { contentType: ext === "jpg" ? "image/jpeg" : "image/png", upsert: true });
          if (upErr) {
            failures.push({ url: legacyUrl, err: upErr.message });
            return;
          }
          usedNames.add(objectPath);
          uploaded++;
        } else {
          reused++;
        }
      }
      hashToUrl.set(hash, publicUrl);
      urlMap.set(legacyUrl, publicUrl);
    },
    (url, _i, _r) => {
      if ((downloaded + failures.length) % 25 === 0) {
        console.log(
          `  progress: ${downloaded} downloaded, ${uploaded} uploaded, ${reused} deduped, ${failures.length} failed`
        );
      }
    }
  ).catch((e) => {
    failures.push({ url: "<loop>", err: String(e) });
  });

  console.log(
    `Downloads: ${downloaded}, Uploads: ${uploaded}, Deduped: ${reused}, Failed: ${failures.length}`
  );
  if (failures.length) {
    for (const f of failures.slice(0, 10)) console.log("  FAIL", f.url, "-", f.err);
  }

  // 5. Rewrite row content in the DB.
  let updated = 0;
  let skipped = 0;
  for (const r of allRows) {
    const newQ = rewriteHtml(r.question_html ?? "", urlMap);
    const newS = rewriteHtml(r.solution_html ?? "", urlMap);
    if (newQ === (r.question_html ?? "") && newS === (r.solution_html ?? "")) {
      skipped++;
      continue;
    }
    if (DRY_RUN) {
      updated++;
      continue;
    }
    const { error: updErr } = await supabase
      .from("past_paper_questions")
      .update({ question_html: newQ, solution_html: newS })
      .eq("id", r.id);
    if (updErr) {
      console.error("DB update failed for row", r.id, updErr.message);
    } else {
      updated++;
    }
  }
  console.log(`Rows changed: ${updated}, Rows unchanged: ${skipped}`);
  console.log(DRY_RUN ? "DRY RUN COMPLETE — no DB writes happened." : "MIGRATION COMPLETE.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
