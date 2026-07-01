/**
 * Reads mobileapp/.env and writes core/config/supabaseEnv.local.ts
 * so Metro always bundles literal Supabase config (Expo Go safe).
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const envPath = path.join(root, ".env");
const outPath = path.join(root, "core", "config", "supabaseEnv.local.ts");

function parseEnv(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    out[key] = value;
  }
  return out;
}

if (!fs.existsSync(envPath)) {
  const stub = `/** No mobileapp/.env — use EAS env or create .env locally */\nexport const LOCAL_SUPABASE_URL = "";\nexport const LOCAL_SUPABASE_ANON_KEY = "";\nexport const LOCAL_API_BASE_URL = "";\nexport const LOCAL_WEB_ORIGIN = "https://www.edublast.in";\nexport const LOCAL_OAUTH_BRIDGE_ORIGIN = "https://www.edublast.in";\n`;
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, stub, { encoding: "utf8" });
  console.warn("[sync-env] mobileapp/.env missing — wrote empty supabaseEnv.local.ts");
  process.exit(0);
}

const raw = fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "");
const env = parseEnv(raw);

const url = env.EXPO_PUBLIC_SUPABASE_URL || "";
const anon = env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const api = env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:3000";
const webOrigin =
  env.EXPO_PUBLIC_WEB_ORIGIN ||
  (api.includes("edublast.in") ? "https://www.edublast.in" : api.replace(/\/$/, ""));
const oauthBridge =
  env.EXPO_PUBLIC_OAUTH_BRIDGE_ORIGIN ||
  (webOrigin.includes("edublast.in") ? "https://www.edublast.in" : webOrigin.replace(/\/$/, ""));

if (!url || !anon) {
  console.error("[sync-env] EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY required in .env");
  process.exit(1);
}

const contents = `/**
 * Generated from mobileapp/.env by scripts/sync-env.cjs — do not edit.
 */
export const LOCAL_SUPABASE_URL = ${JSON.stringify(url)};
export const LOCAL_SUPABASE_ANON_KEY = ${JSON.stringify(anon)};
export const LOCAL_API_BASE_URL = ${JSON.stringify(api)};
export const LOCAL_WEB_ORIGIN = ${JSON.stringify(webOrigin.replace(/\/$/, ""))};
export const LOCAL_OAUTH_BRIDGE_ORIGIN = ${JSON.stringify(oauthBridge.replace(/\/$/, ""))};
`;

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, contents, { encoding: "utf8" });
console.log("[sync-env] wrote core/config/supabaseEnv.local.ts");
