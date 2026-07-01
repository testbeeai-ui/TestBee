/**
 * One-off: write production mobileapp/.env (gitignored). Run: node scripts/write-production-env.cjs
 */
const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");

const existing = fs.existsSync(envPath)
  ? fs.readFileSync(envPath, "utf8").replace(/^\uFEFF/, "")
  : "";

function readKey(text, key) {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() === key) {
      return trimmed.slice(eq + 1).trim();
    }
  }
  return "";
}

const supabaseUrl =
  readKey(existing, "EXPO_PUBLIC_SUPABASE_URL") || "https://bytsiknhtcnlxwzgqkrd.supabase.co";
const anonKey = readKey(existing, "EXPO_PUBLIC_SUPABASE_ANON_KEY");
if (!anonKey) {
  console.error("EXPO_PUBLIC_SUPABASE_ANON_KEY missing in .env");
  process.exit(1);
}

const contents = `# Production mobile env - run npm start after edits

EXPO_PUBLIC_SUPABASE_URL=${supabaseUrl}
EXPO_PUBLIC_SUPABASE_ANON_KEY=${anonKey}

EXPO_PUBLIC_API_BASE_URL=https://www.edublast.in
EXPO_PUBLIC_WEB_ORIGIN=https://www.edublast.in
EXPO_PUBLIC_OAUTH_BRIDGE_ORIGIN=https://www.edublast.in
`;

fs.writeFileSync(envPath, contents, { encoding: "utf8" });
console.log("[write-production-env] wrote", envPath);
