/**
 * Copy Web/.env into EduBite and EduDeca (same Supabase project + shared email).
 * Usage (from Web/): node scripts/sync-env-to-edubite-edudeca.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const webEnvPath = path.join(webRoot, ".env");
const edubiteRoot = path.join(webRoot, "..", "EduBite");
const edudecaRoot = path.join(webRoot, "..", "EduDeca");

const SHARED_SUPABASE_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
];

const EDUDECA_EMAIL_KEYS = [
  "EMAIL_SERVER_HOST",
  "EMAIL_SERVER_PORT",
  "EMAIL_SERVER_USER",
  "EMAIL_SERVER_PASSWORD",
  "EMAIL_FROM_NAME",
  "EMAIL_ADMIN",
  "EMAIL_DAILY_SEND_CAP",
];

const LOCAL_EDUDECA_URL = "http://localhost:3001";

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  const text = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1).trim();
    }
    out[k] = v;
  }
  return out;
}

function serializeEnv(header, pairs) {
  const lines = [header, ""];
  for (const [key, value] of pairs) {
    if (value == null || String(value).length === 0) continue;
    lines.push(`${key}=${value}`);
  }
  lines.push("");
  return lines.join("\n");
}

function pick(env, keys) {
  return keys
    .filter((key) => env[key] != null && String(env[key]).length > 0)
    .map((key) => [key, env[key]]);
}

function upsertEnvFile(filePath, updates) {
  const original = fs.existsSync(filePath)
    ? fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "")
    : "";
  const lines = original.length ? original.split(/\r?\n/) : [];
  const seen = new Set();
  const next = lines.map((line) => {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) return line;
    const i = t.indexOf("=");
    const key = t.slice(0, i).trim();
    if (!(key in updates)) return line;
    seen.add(key);
    return `${key}=${updates[key]}`;
  });
  for (const [key, value] of Object.entries(updates)) {
    if (seen.has(key)) continue;
    if (!next.length || next[next.length - 1] !== "") next.push("");
    next.push(`${key}=${value}`);
  }
  const body = next.join("\n");
  fs.writeFileSync(filePath, body.endsWith("\n") ? body : `${body}\n`, "utf8");
}

function writeBoth(appRoot, body) {
  fs.writeFileSync(path.join(appRoot, ".env"), body, "utf8");
  fs.writeFileSync(path.join(appRoot, ".env.local"), body, "utf8");
}

if (!fs.existsSync(webEnvPath)) {
  console.error("Missing Web/.env");
  process.exit(1);
}
if (!fs.existsSync(edubiteRoot) || !fs.existsSync(edudecaRoot)) {
  console.error("Expected EduBite/ and EduDeca/ next to Web/");
  process.exit(1);
}

const web = parseEnv(webEnvPath);
if (!web.NEXT_PUBLIC_SUPABASE_URL || !web.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.error("Web/.env is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  process.exit(1);
}

const webUpdates = {};
if (!web.EDUDECA_APP_URL) {
  webUpdates.EDUDECA_APP_URL = LOCAL_EDUDECA_URL;
  web.EDUDECA_APP_URL = LOCAL_EDUDECA_URL;
}
if (!web.NEXT_PUBLIC_EDUDECA_APP_URL) {
  webUpdates.NEXT_PUBLIC_EDUDECA_APP_URL = LOCAL_EDUDECA_URL;
  web.NEXT_PUBLIC_EDUDECA_APP_URL = LOCAL_EDUDECA_URL;
}
if (!web.EDUDECA_INTERNAL_API_SECRET) {
  const secret = crypto.randomBytes(32).toString("hex");
  webUpdates.EDUDECA_INTERNAL_API_SECRET = secret;
  web.EDUDECA_INTERNAL_API_SECRET = secret;
}
if (Object.keys(webUpdates).length) {
  upsertEnvFile(webEnvPath, webUpdates);
}

const bitePairs = pick(web, SHARED_SUPABASE_KEYS);
const decaPairs = [
  ...pick(web, SHARED_SUPABASE_KEYS),
  ...pick(web, EDUDECA_EMAIL_KEYS),
  ["NEXT_PUBLIC_EDUDECA_APP_URL", LOCAL_EDUDECA_URL],
  ...pick(web, ["EDUDECA_INTERNAL_API_SECRET"]),
];

writeBoth(
  edubiteRoot,
  serializeEnv(
    "# Synced from Web/.env — same Supabase Auth project as Edublast",
    bitePairs,
  ),
);
writeBoth(
  edudecaRoot,
  serializeEnv(
    "# Synced from Web/.env — same Supabase + email as Edublast",
    decaPairs,
  ),
);

const bite = parseEnv(path.join(edubiteRoot, ".env.local"));
const deca = parseEnv(path.join(edudecaRoot, ".env.local"));
const checks = [
  ["URL", web.NEXT_PUBLIC_SUPABASE_URL === bite.NEXT_PUBLIC_SUPABASE_URL && web.NEXT_PUBLIC_SUPABASE_URL === deca.NEXT_PUBLIC_SUPABASE_URL],
  ["ANON", web.NEXT_PUBLIC_SUPABASE_ANON_KEY === bite.NEXT_PUBLIC_SUPABASE_ANON_KEY && web.NEXT_PUBLIC_SUPABASE_ANON_KEY === deca.NEXT_PUBLIC_SUPABASE_ANON_KEY],
  ["SERVICE", web.SUPABASE_SERVICE_ROLE_KEY === bite.SUPABASE_SERVICE_ROLE_KEY && web.SUPABASE_SERVICE_ROLE_KEY === deca.SUPABASE_SERVICE_ROLE_KEY],
  ["EMAIL", web.EMAIL_SERVER_USER === deca.EMAIL_SERVER_USER],
  ["INTERNAL_SECRET", Boolean(web.EDUDECA_INTERNAL_API_SECRET) && web.EDUDECA_INTERNAL_API_SECRET === deca.EDUDECA_INTERNAL_API_SECRET],
];
for (const [name, ok] of checks) {
  console.log(`${name}=${ok ? "linked" : "MISMATCH"}`);
}
console.log("Wrote EduBite/.env + .env.local and EduDeca/.env + .env.local from Web/.env");
