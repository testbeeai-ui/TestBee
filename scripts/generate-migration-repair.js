/**
 * After the 2026-06-15 squash, prod still lists ~250 archived migration versions.
 * db push fails until those remote-only rows are marked reverted (schema unchanged).
 *
 * Usage:
 *   node scripts/generate-migration-repair.js           # print repair command
 *   node scripts/generate-migration-repair.js --write   # save to scratch/repair-reverted.cmd
 *
 * Refresh remote list first:
 *   npx supabase migration list --linked > scratch/migration-list.txt
 *   node scratch/audit-migrations.js   # if you maintain remote-migrations.json
 */
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "supabase", "migrations");
const remotePath = path.join(__dirname, "..", "scratch", "remote-migrations.json");

if (!fs.existsSync(remotePath)) {
  console.error("Missing scratch/remote-migrations.json — run scratch/audit-migrations.js first.");
  process.exit(1);
}

const remote = JSON.parse(fs.readFileSync(remotePath, "utf8"));
const remoteVersions = new Set(remote.map((r) => r.version));

const localFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".sql"));
const localVersions = new Set();
const conflicts = [];

for (const f of localFiles) {
  const m = f.match(/^(\d{14})_(.+)\.sql$/);
  if (!m) continue;
  const [, ver, slug] = m;
  localVersions.add(ver);
  const remoteRow = remote.find((r) => r.version === ver);
  if (remoteRow && remoteRow.name !== slug) {
    conflicts.push({ file: f, localSlug: slug, remoteName: remoteRow.name, version: ver });
  }
}

const toRevert = [...remoteVersions].filter((v) => !localVersions.has(v)).sort();

console.log(JSON.stringify({
  localCount: localVersions.size,
  remoteCount: remoteVersions.size,
  revertCount: toRevert.length,
  conflicts,
}, null, 2));

if (conflicts.length) {
  console.error(
    "\nWARNING: version slug conflicts — remote already applied different SQL at that version.",
  );
  console.error("Rename local files to new timestamps before db push (see .cursor/docs/migration-squash-runbook.md).\n");
}

if (toRevert.length === 0) {
  console.log("\nNo remote-only versions to revert.");
  process.exit(0);
}

const cmd = `npx supabase migration repair --status reverted ${toRevert.join(" ")}`;
console.log(`\n# Mark ${toRevert.length} archived remote versions as reverted (does not roll back schema):\n`);
console.log(cmd);

if (process.argv.includes("--write")) {
  const out = path.join(__dirname, "..", "scratch", "repair-reverted.cmd");
  fs.writeFileSync(out, `@echo off\r\n${cmd}\r\n`, "utf8");
  console.log(`\nWrote ${out}`);
}
