/**
 * Re-host images embedded in question_html / solution_html during an import.
 *
 * Walks every <img src="https://www.testbee.in/preview/show_qimage/..."> in
 * the input, downloads the image, content-hashes it, uploads it to the
 * `past-paper-images` Supabase Storage bucket, and rewrites the <img> tag to
 * point at the public Supabase URL. Returns the rewritten string.
 *
 * Per-process cache means the same legacy URL across many questions is only
 * downloaded + uploaded once during a single import run.
 *
 * Catches and logs download/upload failures: the original <img> tag is
 * preserved unchanged so a failed image doesn't silently disappear from the
 * import. (Better to have a broken testbee.in link than a missing question.)
 */
import crypto from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "past-paper-images";
const FRAG = "/storage/v1/object/public/past-paper-images/";

let client: SupabaseClient | null = null;
const urlCache = new Map<string, string>(); // legacy -> public

function getClient(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing");
  }
  client = createClient(url, key);
  return client;
}

async function downloadWithRetry(rawUrl: string, max = 3): Promise<Buffer> {
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      const r = await fetch(rawUrl, {
        headers: { "user-agent": "TestbeeImageMigrator/1.0 (+past-paper-images)" },
      });
      if (r.ok) return Buffer.from(await r.arrayBuffer());
      lastErr = new Error(`HTTP ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, 200 * attempt));
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/**
 * Match legacy Testbee img tags, including mangled sources like:
 *   src="- https://www.testbee.in/preview/show_qimage/123.PNG"
 *   src="ttps://www.testbee.in/preview/show_qimage/123.JPG"  (missing leading h)
 * Group 1 = full original src attribute value (for exact replace).
 */
const LEGACY_RE =
  /<img\b[^>]*?\bsrc=["']?\s*([^"'>]*?testbee\.in\/preview\/show_qimage\/[^"'>\s]+)["']?[^>]*?\/?>/gi;

function normalizeLegacyImageUrl(rawSrc: string): string | null {
  // Strip quotes and leading junk ("- https://...", "ttps://...", " -https://...")
  const trimmed = rawSrc
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/^-\s+/, "")
    .replace(/^ttps:\/\//i, "https://")
    .replace(/^tp:\/\//i, "http://")
    .trim();
  const m = trimmed.match(/show_qimage\/([^\s"'<>]+)/i);
  if (!m) return null;
  let file = m[1]!;
  // Repair truncated extensions from OCR/source cuts (.pn → .png, .jpe → .jpeg).
  if (/\.pn$/i.test(file)) file = file.replace(/\.pn$/i, ".png");
  else if (/\.jpe$/i.test(file)) file = file.replace(/\.jpe$/i, ".jpeg");
  else if (/\.jp$/i.test(file)) file = file.replace(/\.jp$/i, ".jpg");
  else if (!/\.(png|jpe?g|gif|webp)$/i.test(file)) {
    // Bare id with no extension — try .png then .jpg at download time via cleanUrl.
    file = `${file}.png`;
  }
  return `https://www.testbee.in/preview/show_qimage/${file}`;
}

async function selfHostOne(rawSrc: string): Promise<string | null> {
  if (urlCache.has(rawSrc)) return urlCache.get(rawSrc)!;

  const supabase = getClient();
  const publicBase = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const cleanUrl = normalizeLegacyImageUrl(rawSrc);
  if (!cleanUrl) return null;

  let buf: Buffer;
  try {
    buf = await downloadWithRetry(cleanUrl);
  } catch (e) {
    // Fallback: try alternate common extensions if the first attempt failed.
    const alts = [
      cleanUrl.replace(/\.png$/i, ".jpg"),
      cleanUrl.replace(/\.jpe?g$/i, ".png"),
      cleanUrl.replace(/\.JPG$/i, ".jpg"),
    ].filter((u, i, arr) => u !== cleanUrl && arr.indexOf(u) === i);
    let recovered: Buffer | null = null;
    for (const alt of alts) {
      try {
        recovered = await downloadWithRetry(alt);
        break;
      } catch {
        /* try next */
      }
    }
    if (!recovered) {
      console.warn(`[images] download failed ${cleanUrl}: ${(e as Error).message}`);
      return null;
    }
    buf = recovered;
  }
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const ext = (cleanUrl.match(/\.([a-zA-Z0-9]+)$/i)?.[1] ?? "png").toLowerCase();
  const objectPath = `${hash}.${ext === "jpeg" ? "jpg" : ext}`;
  const publicUrl = `${publicBase}${FRAG}${objectPath}`;

  const { data: list } = await supabase.storage.from(BUCKET).list("", { search: objectPath });
  if (!list || list.length === 0) {
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buf, {
        contentType:
          ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "gif"
              ? "image/gif"
              : ext === "webp"
                ? "image/webp"
                : "image/png",
        upsert: true,
      });
    if (upErr) {
      console.warn(`[images] upload failed ${objectPath}: ${upErr.message}`);
      return null;
    }
  }
  urlCache.set(rawSrc, publicUrl);
  return publicUrl;
}

export async function selfHostImages(html: string | null | undefined): Promise<string | null> {
  if (!html) return html ?? null;
  if (!html.toLowerCase().includes("testbee.in/preview/show_qimage/")) return html;
  const matches = [...html.matchAll(LEGACY_RE)];
  if (matches.length === 0) return html;
  let out = html;
  for (const m of matches) {
    const original = m[0];
    const src = m[1]!;
    const next = await selfHostOne(src);
    if (!next) continue;
    // Replace the whole (possibly mangled) src value with the clean hosted URL.
    out = out.replace(original, original.replace(src, next));
  }
  return out;
}
