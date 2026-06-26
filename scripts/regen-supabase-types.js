#!/usr/bin/env node
/**
 * Regenerate integrations/supabase/types.ts without polluting the file with
 * PowerShell/npm stderr (use cmd redirection on Windows).
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const outPath = path.join(__dirname, "..", "integrations", "supabase", "types.ts");
const isWin = process.platform === "win32";

const cmd = isWin
  ? 'cmd /c "npx supabase gen types typescript --linked > integrations\\supabase\\types.ts 2>nul"'
  : "npx supabase gen types typescript --linked > integrations/supabase/types.ts 2>/dev/null";

execSync(cmd, { stdio: "inherit", cwd: path.join(__dirname, ".."), shell: true });

const head = fs.readFileSync(outPath, "utf8").slice(0, 80);
if (!head.startsWith("export type Json")) {
  console.error("types.ts does not look valid — check supabase link and retry.");
  process.exit(1);
}
console.log("Wrote", outPath);
