#!/usr/bin/env node
/**
 * Portable launcher for the Hivemind MCP server (installed by `hivemind install`).
 * Used from .cursor/mcp.json so paths work on Windows/macOS/Linux.
 */
const path = require("node:path");
const os = require("node:os");

const serverPath = path.join(os.homedir(), ".hivemind", "mcp", "server.js");

try {
  require(serverPath);
} catch (err) {
  const code = err && typeof err === "object" && "code" in err ? err.code : null;
  if (code === "MODULE_NOT_FOUND" || code === "ENOENT") {
    console.error(
      "Hivemind MCP server not found. Run: npm install -g @deeplake/hivemind && hivemind install"
    );
    process.exit(1);
  }
  throw err;
}
