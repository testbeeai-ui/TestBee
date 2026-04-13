/**
 * Offline audit: fail if known-bad chemistry snippets (e.g. wrong acetone enol) appear in repo text sources.
 * Run: npx tsx scripts/rag-string-audit.ts
 */

import { readdirSync, readFileSync, statSync } from "fs";
import { join } from "path";

const ROOT = process.cwd();

/** Patterns that strongly indicate the incorrect "CH2C(OH)CH2" enol side (missing = and wrong H count). */
const BANNED_SUBSTRINGS = [
  "CH_2C(OH)CH_2",
  "CH_{2}C(OH)CH_{2}",
  "CH2C(OH)CH2",
] as const;

const SKIP_DIR = new Set([
  "node_modules",
  ".next",
  ".git",
  "dist",
  "coverage",
  "out",
]);

function walkFiles(dir: string, out: string[]): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of names) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkFiles(p, out);
    } else if (/\.(ts|tsx|sql|md|txt|json)$/i.test(name)) {
      if (name === "rag-string-audit.ts") continue;
      out.push(p);
    }
  }
}

function main(): void {
  const roots = [join(ROOT, "data"), join(ROOT, "lib"), join(ROOT, "supabase"), join(ROOT, "scripts")].filter((d) => {
    try {
      return statSync(d).isDirectory();
    } catch {
      return false;
    }
  });

  const files: string[] = [];
  for (const r of roots) walkFiles(r, files);

  const hits: { file: string; pattern: string }[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const pattern of BANNED_SUBSTRINGS) {
      if (text.includes(pattern)) {
        hits.push({ file, pattern });
      }
    }
  }

  if (hits.length > 0) {
    console.error("[rag-string-audit] Found banned wrong-enol-style substrings:");
    for (const h of hits) console.error(`  ${h.pattern}  →  ${h.file}`);
    process.exit(1);
  }

  console.info("[rag-string-audit] OK — no banned wrong-acetone-enol substrings in scanned trees.");
}

main();
