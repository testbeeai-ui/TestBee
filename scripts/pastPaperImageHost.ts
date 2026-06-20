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
const LEGACY_RE = /<img\b[^>]*?src="([^"]*?testbee\.in\/preview\/show_qimage\/[^"]*?)"[^>]*?\/?>/gi;

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

async function selfHostOne(rawSrc: string): Promise<string | null> {
  if (urlCache.has(rawSrc)) return urlCache.get(rawSrc)!;

  const supabase = getClient();
  const publicBase = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const clean = rawSrc.match(/show_qimage\/[^\s"]+?\.(?:png|jpg|jpeg)/i)?.[0];
  if (!clean) return null;
  const cleanUrl = `https://www.testbee.in/preview/${clean}`;

  let buf: Buffer;
  try {
    buf = await downloadWithRetry(cleanUrl);
  } catch (e) {
    console.warn(`[images] download failed ${cleanUrl}: ${(e as Error).message}`);
    return null;
  }
  const hash = crypto.createHash("sha256").update(buf).digest("hex");
  const ext = (clean.match(/\.([a-zA-Z0-9]+)$/i)?.[1] ?? "png").toLowerCase();
  const objectPath = `${hash}.${ext}`;
  const publicUrl = `${publicBase}${FRAG}${objectPath}`;

  const { data: list } = await supabase.storage.from(BUCKET).list("", { search: objectPath });
  if (!list || list.length === 0) {
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(objectPath, buf, { contentType: ext === "jpg" ? "image/jpeg" : "image/png", upsert: true });
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
  if (!html.includes("testbee.in/preview/show_qimage/")) return html;
  const matches = [...html.matchAll(LEGACY_RE)];
  if (matches.length === 0) return html;
  let out = html;
  for (const m of matches) {
    const original = m[0];
    const src = m[1];
    const next = await selfHostOne(src);
    if (!next) continue;
    out = out.replace(original, original.replace(src, next));
  }
  return out;
}
