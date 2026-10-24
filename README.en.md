# gewumind-skill

> An agent-agnostic skill that turns requirements into a running low-code backend.
>
> **Version 1.1.0** — released with [gewumind-boot](https://github.com/gewumind/gewumind-boot) under the same version and tag.

`gewumind-skill` is not a model or an IDE. It is a set of **engineering rules + knowledge base + publish protocol** for AI agents.

Install it and Claude Code / Cursor / opencode can turn a business requirement into a running low-code backend through four stages: **requirement → design → generate → publish**.

## Requirements

| Dependency | Requirement |
|---|---|
| Backend | GewuMind Boot running (default `http://localhost:9089`) |
| Node.js | 18+ (for `sfc-compile` / `docs-verify` / `verify-publish`) |
| AI Key | Printed in the backend startup log, or created in the admin UI |
| Agent | Claude Code / Cursor / opencode / any MCP client |

## Install

1. Clone this repository.
2. Point your agent at `SKILL.md` (the English agent instructions). `SKILL.zh.md` is the Chinese reference.
3. Configure the backend as an MCP server:

```bash
claude mcp add --transport sse gewumind-boot http://localhost:9089/mcp
```

Or use REST: `POST /api/ai/bundle/apply` with `X-AI-Key: <keyId>:<secret>`.

## Four-stage pipeline

| Stage | Output | Gate |
|---|---|---|
| 1. Requirement | `docs/requirement.md` | organization / roles / scope confirmed |
| 2. Design | `docs/ui.md`, `database.md`, `api.md` | `node scripts/docs-verify.mjs <project>` passes |
| 3. Generate | `src/sql/**`, `src/magic-api/**`, `src/magic-api/component/**/*.ms` | tables / fields / permissions / deterministic IDs |
| 4. Publish | `bundle_apply` + verify | `sql-check` exit 0, `verify-publish` exit 0, rollback available |

After publishing, verify the component / API / menu:

```bash
node scripts/verify-publish.mjs --base http://localhost:9089 \
  --component "Device List" --api /api/device/list --menu-url /device/list \
  --username admin --password 123456
```

On failure, roll back to the pre-publish backup:

```bash
scripts/rollback.sh --base http://localhost:9089 --version <backupVersion> \
  --ai-key "$GW_AI_KEY"
```

## MCP tools

| Tool | Purpose |
|---|---|
| `status_check` | health check |
| `bundle_apply` | publish SQL + magic-script |
| `sql_execute` | read-only diagnostics |
| `data_query` | natural-language query |
| `file_receive` | stage files |
| `docs_push` | push docs to RAG |

## Project layout

```text
gewumind-skill/
├── SKILL.md                  # English agent instructions
├── SKILL.zh.md               # Chinese reference
├── README.md                 # Chinese README
├── README.en.md              # this file
├── references/
│   ├── pipeline.md           # Chinese
│   ├── conventions.md
│   ├── component-page.md
│   ├── publish-protocol.md
│   └── en/
│       ├── pipeline.md       # English core workflow
│       ├── conventions.md
│       ├── component-page.md
│       └── publish-protocol.md
└── scripts/
    ├── docs-verify.mjs       # docs gate (--fix)
    ├── sql-check.mjs         # SQL parameterization check
    ├── verify-publish.mjs    # post-publish verification
    ├── rollback.sh           # rollback + verify
    ├── ms-component.mjs      # .vue → .ms (+ --publish / --delete)
    └── sfc-compile.mjs       # legacy SFC route
```

## Internationalization (1.1.0+)

- Runtime UI packs: `data/i18n/<lang>.json`; select with `?lang=en`.
- Kernel messages: `data/i18n/messages_<lang>.properties`.
- Database language: `02-seed-zh.sql` / `02-seed-en.sql` (deployment-level).
- Agents **reply in the user's language**; artifacts use the project language.

## Versioning

`VERSION` matches `gewumind-boot/pom.xml`. Both repositories are released with the same tag (e.g. `v1.0.3`); do not mix versions.

## License

MIT. See [LICENSE](LICENSE).
