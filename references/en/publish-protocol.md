# Publish protocol: bundle apply, MCP, REST

All backend changes go through **bundle apply**: SQL list + magic-script list, executed in order, with a pre-publish backup.

## Path detection

- Controllers map `/ai/**`; existing clients use `/api/ai/**`.
- Probe both: `GET /ai/health` and `GET /api/ai/health`; use the one that works.
- MCP endpoint: `/mcp`.

## Authentication

- REST: `X-AI-Key: <keyId>:<secret>`.
- MCP: older builds `/mcp` are open; newer builds return 401 and need the same `X-AI-Key` header.

## MCP (recommended)

SSE transport:

```text
GET  {base}/mcp                     → SSE; first event endpoint=/mcp/message/{sessionId}
POST {base}/mcp/message/{sessionId} → JSON-RPC 2.0 (initialize / tools/list / tools/call)
```

Tools:

| Tool | Arguments | Purpose |
|---|---|---|
| `status_check` | — | health/version |
| `bundle_apply` | `sql`, `ms` | publish |
| `sql_execute` | `sql` | read-only diagnostics |
| `file_receive` | `path`, `content` | stage files |
| `data_query` | `question` | natural-language query |
| `docs_push` | `docs` | push docs to RAG |

## REST

```text
POST {base}/api/ai/bundle/apply
X-AI-Key: <keyId>:<secret>
Content-Type: application/json
```

### Request body

```json
{
  "sql": [
    { "name": "ddl/t_device.sql", "content": "CREATE TABLE ..." }
  ],
  "ms": [
    { "group": "Device", "groupPath": "/device", "name": "List",
      "method": "POST", "path": "/list", "script": "return db.page(...)",
      "permission": "device:list", "kind": "api", "cron": null,
      "description": "", "metaJson": null, "action": null }
  ],
  "migrate": [ { "name": "...", "content": "ALTER TABLE ..." } ],
  "selectedFiles": null,
  "ignored": null
}
```

- `sql[].content` may contain multiple statements; `name` is the log label.
- `ms[].group`: group path segments separated by `/`.
- `kind`: `api` (default) / `function` / `task` / `component` (0.3.1+).
- `component`: `metaJson` must contain `compileJs` / `compileCss` (from `ms-component.mjs --publish`); `path` is relative to `groupPath`.
- `action`: `delete` (component, 0.3.2+) — removes the `.ms` and empty group; does not delete the menu.
- `selectedFiles`: when set, only listed files are published.

Component example:

```json
{
  "ms": [{
    "group": "Device", "groupPath": "/device",
    "name": "Device List", "path": "/list",
    "kind": "component",
    "script": "<Vue SFC source>",
    "metaJson": "{\"compileJs\":\"...\",\"compileCss\":\"...\"}"
  }]
}
```

Delete example:

```json
{
  "ms": [{
    "group": "Device", "name": "Device List",
    "kind": "component", "action": "delete"
  }]
}
```

### Response

```json
{
  "success": true,
  "message": "bundle applied",
  "data": {
    "backupVersion": "20261023.181032",
    "rolledBack": false,
    "appliedSql": ["ddl/t_device.sql (3 stmts)"],
    "skippedSql": [],
    "appliedMigrate": [],
    "appliedMs": [".../component/Device/Device List.ms"],
    "deletedMs": [],
    "errors": []
  },
  "errors": []
}
```

- `rollbackError` is present when auto-rollback failed.
- On errors (0.3.2+), the backend restores the pre-publish backup and returns
  `message: "bundle failed and rolled back"`, `rolledBack: true`.
- `errors` entries: `{type: "sql"|"migrate"|"ms", name, message}`.

## Verify after publish

```bash
node scripts/verify-publish.mjs --base http://localhost:9089 \
  --component "Device List" --api /api/device/list --menu-url /device/list \
  --username admin --password 123456
```

- Component: matches `/system/component/runtime/list` by `name` or `path`.
- API: default POST with `{page:1,size:1}`; override with `--api-method` / `--api-body`.
- Menu: needs `--username/--password` or `--token`; checks `/system/menu/current/menus`.
- Exit codes: 0 pass, 1 fail, 2 usage.

## Rollback

```bash
scripts/rollback.sh --base http://localhost:9089 --version <backupVersion> \
  --ai-key "$GW_AI_KEY" \
  --component "Device List" --api /api/device/list --menu-url /device/list \
  --username admin --password 123456
```

`rollback.sh` calls `POST /api/ai/rollback` (`{"version":"..."}`, `X-AI-Key`) and re-verifies.

## Pitfalls

1. **`file:` path**: `bundle_apply` may write to `<project>/file:./data/...` in older builds.
   0.3.1+ fixes `getMagicApiDataDir`; on older builds move the directory and restart (or `POST /api/ai/magic-api/repair`).
2. **Separator**: `.ms` must be `\r\n` + 32 `=` + `\r\n`. Otherwise the runtime treats the whole file as source and the script is `null`.
3. **magic-script does not support `??`**; use `if (x == null)`.
4. **403**: a menu is visible only with both `sys_menu` and `sys_role_menu`; button codes need `sys_permission_code`.
5. **App prefix / header**: business APIs are `/api/...`; the login header is `token: <uuid>`.
6. **`sys_menu` schema**: 1.0.x has no `component_id`; check `SHOW COLUMNS` before writing SQL.
7. **`groupId`**: the `.ms` `groupId` must equal the parent `group.json.id`, or startup fails.
8. **i18n**: send `X-Lang: en` or `Accept-Language`; kernel messages can be overridden in `data/i18n/messages_<lang>.properties`.
