/**
 * Next.js 16 defaults `next dev` to Turbopack when no bundler flag is set.
 * This launcher forces webpack and clears TURBOPACK* env so a stray .env value
 * cannot re-enable Turbopack alongside --webpack (which would error or misbehave).
 */
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.join(__dirname, "..");
const env = { ...process.env };
delete env.TURBOPACK;
delete env.IS_TURBOPACK_TEST;

const nextCli = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");
if (!fs.existsSync(nextCli)) {
  console.error("[dev-webpack] Missing Next.js CLI at:", nextCli);
  process.exit(1);
}

const result = spawnSync(process.execPath, [nextCli, "dev", "--webpack"], {
  stdio: "inherit",
  env,
  cwd: projectRoot,
  windowsHide: true,
});

process.exit(result.status === null ? 1 : result.status);
