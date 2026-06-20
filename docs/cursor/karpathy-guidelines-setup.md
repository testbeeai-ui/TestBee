# Using Karpathy guidelines with Cursor (Testbee)

This repo ships behavioral rules for AI agents. **Testbee does not use** `CLAUDE.md` or a `skills/karpathy-guidelines/` folder from the upstream template.

## Active rules (Cursor)

| File                                                                                   | Purpose                                                  |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`.cursorrules`](../../.cursorrules)                                                   | Entrypoint — read every task; points to memory + layout  |
| [`.cursor/memory.md`](../../.cursor/memory.md)                                         | Stack, paths, Decisions Log                              |
| [`.cursor/rules/repo-layout.mdc`](../../.cursor/rules/repo-layout.mdc)                 | Where files belong (always applied)                      |
| [`.cursor/rules/karpathy-guidelines.mdc`](../../.cursor/rules/karpathy-guidelines.mdc) | Think first, simplicity, surgical edits (always applied) |
| [`.cursor/rules/codegraph.mdc`](../../.cursor/rules/codegraph.mdc)                     | CodeGraph MCP usage (always applied)                     |

Confirm under **Cursor → Settings → Rules** that `karpathy-guidelines`, `repo-layout`, and `codegraph` appear for this project.

## Use in another project

Copy into that project:

- `.cursor/rules/karpathy-guidelines.mdc`
- Optionally `.cursor/rules/repo-layout.mdc` (edit paths for that repo)

Merge with existing `.cursorrules` — do not duplicate conflicting instructions.

## For contributors

When editing the four Karpathy principles, update **only** [`.cursor/rules/karpathy-guidelines.mdc`](../../.cursor/rules/karpathy-guidelines.mdc). Do not recreate `.cursor/.cursor/rules/` (wrong nested path).

## Hivemind (optional)

Shared agent memory via Deeplake: [hivemind-setup.md](./hivemind-setup.md).
