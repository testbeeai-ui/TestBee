# Hivemind (Deeplake) — Cursor setup for Testbee

Hivemind is **developer tooling** for Cursor agents (shared memory, session traces, codebase graph, MCP search). It is **not** part of the Next.js app build.

## One-time per machine (full install)

```bash
npm install -g @deeplake/hivemind
hivemind install
hivemind login
```

**Restart Cursor** after install.

## Connect this repo

From the Testbee root:

```bash
npm run hivemind:graph        # AST snapshot + cloud push (run after big changes)
npm run hivemind:graph:init   # optional: auto-rebuild graph on git commit
```

Project MCP config: [`.cursor/mcp.json`](../.cursor/mcp.json) → `scripts/hivemind-mcp.cjs` → `~/.hivemind/mcp/server.js` (created by `hivemind install`).

Hooks (capture/recall) live in **user** config: `%USERPROFILE%\.cursor\hooks.json` on Windows.

## Verify

```bash
npm run hivemind:status
hivemind whoami
```

Expected:

- `logged in: yes`
- `cursor` in detected assistants
- Graph build prints `Nodes:` / `Cloud: pushed`

In Cursor: **Settings → Tools & MCP** — `hivemind` server should appear (reload window after first install).

## Repo scripts

| Script | What it does |
|--------|----------------|
| `npm run hivemind:install` | `hivemind install` (all assistants + MCP server) |
| `npm run hivemind:status` | Connection + version |
| `npm run hivemind:graph` | Build/push codebase graph for this repo |
| `npm run hivemind:graph:init` | Install managed post-commit graph hook |

## Privacy

Session prompts, tool calls, and responses are stored in your Deeplake workspace. Disable capture: `set HIVEMIND_CAPTURE=false` (Windows) before starting Cursor.

## Uninstall

```bash
hivemind uninstall
```

Remove `.cursor/mcp.json` hivemind entry from this repo if you no longer want project MCP.
