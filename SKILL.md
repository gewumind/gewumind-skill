---
name: gewumind-boot
description: Build complete business applications on a running GewuMind Boot (magic-api low-code backend). Four-stage pipeline: requirement → UI/database/API design → DDL SQL / magic-script / .ms component pages / menu & dictionary SQL → one-shot publish. Use when the user asks to build a business page, a CRUD module, a menu, a dictionary, a magic-api script, or to publish to gewumind-boot (做业务页面 / 增删改查模块 / 加菜单 / 加字典 / 写 magic-api 脚本 / 发布).
---

# GewuMind Boot Development Skill

> Version 1.1.0 (`VERSION`) — identical to the `gewumind-boot` version; both are released with the same tag.
> Chinese reference: `SKILL.zh.md`. Deep platform knowledge: `knowledge/` (Chinese).

Turn a natural-language requirement into a **publishable business application**: SQL tables + magic-api scripts + Vue dynamic components + menu/dictionary data, published with one `bundle_apply`.

## 1. Prerequisites

1. **Backend URL** (default `http://localhost:9089`). Probe `GET /ai/health` or `GET /api/ai/health` (the prefix varies by version; see `references/en/publish-protocol.md`).
2. **Access** (pick one):
   - **MCP** (recommended): `/mcp`; tools `status_check`, `bundle_apply`, `sql_execute`, `file_receive`, `data_query`, `docs_push`.
   - **REST**: `POST /api/ai/bundle/apply` with `X-AI-Key: <keyId>:<secret>`.

If the backend is unreachable, **stop** and tell the user. Do not invent artifacts.

## 2. Workspace

```text
{project}/
├── docs/
│   ├── requirement.md    # stage 1: requirement (7 sections)
│   ├── ui.md             # stage 2: menu tree + page details
│   ├── database.md       # stage 2: tables + dictionaries
│   └── api.md            # stage 2: paths + endpoints + functions + tasks
├── src/
│   ├── sql/
│   │   ├── ddl/{table}.sql        # publish order 1
│   │   ├── menu/{name}.sql        # publish order 2 (including sys_role_menu)
│   │   ├── sfc/{name}.sql         # legacy SFC route (order 3)
│   │   ├── insert/{table}.sql     # seed data (order 4)
│   │   ├── dict/{dict_type}.sql   # dictionaries (order 5)
│   │   └── migrate/V{ts}_*.sql    # existing-table changes
│   ├── magic-api/
│   │   ├── api/{group}/.../*.ms + group.json
│   │   ├── function/{group}/...
│   │   ├── task/{group}/...
│   │   └── component/{group}/.../*.ms + group.json
│   └── pages/{name}.vue           # compiled into .ms
```

**The four docs are the source of truth.** Derive code from them; never generate something the docs do not describe.

## 3. Four-stage pipeline

1. **Requirement**: confirm organization levels and roles; write `docs/requirement.md` (7 sections); get confirmation.
2. **Design**: derive `docs/ui.md`, `database.md`, `api.md`; cross-check; get confirmation.
3. **Generate**: DDL → seed data → magic-script (api/function/task) → component pages (`.vue` → `.ms`) → menu SQL (+ role bindings) → dictionary SQL. Count the total first, generate item by item, then verify each.
4. **Publish**: `bundle_apply` (MCP or REST) → check `errors` → run `scripts/verify-publish.mjs` → report; on failure run `scripts/rollback.sh --version <backupVersion>`.

Wait for user confirmation after each stage. Do not run all stages in one go.

**Docs gate**: after stages 1/2 run `node scripts/docs-verify.mjs <project-root>` (`--fix` auto-fixes formatting); exit 0 is required.

## 4. Read before generating

| Task | Read first |
|---|---|
| Write/change the four docs | `references/en/pipeline.md` + `node scripts/docs-verify.mjs <project-root>` |
| Frontend build / deploy / package | `knowledge/gewumind-boot/21-frontend-build-deploy.md` |
| Debugging / dev paths | `knowledge/gewumind-boot/22-debug-listen-and-dev-paths.md` |
| Read/write `.ms` files | `knowledge/server-plugin/01-structure.md` (CRLF separator) |
| Component pages (`.ms`) | `references/en/component-page.md` |
| Legacy SFC | `references/en/conventions.md` + `references/sfc-compile.md` |
| Tables / fields / naming | `references/en/conventions.md` |
| magic-script CRUD | `knowledge/gewumind-boot/06-crud-api.md` + `knowledge/database/01-sql.md` |
| Menu SQL + role binding | `knowledge/gewumind-boot/05-menu-register.md` |
| Dictionaries | `knowledge/gewumind-boot/13-data-dictionary.md` |
| Publish / bundle apply | `references/en/publish-protocol.md` |
| Workflow / report / plugins | `knowledge/workflow/` / `knowledge/report/` / `knowledge/server-plugin/` |
| Tasks | `knowledge/task/05-pitfalls.md` |
| Component contracts | `knowledge/gewumind-boot/01-mb-table.md`, `02-mb-form.md` |
| Release / DB baseline | `knowledge/gewumind-boot/26-delivery-and-baseline.md` |

## 5. Iron rules

1. **Never execute ad-hoc SQL**; write scripts and publish via `bundle_apply` (`sql_execute` is read-only diagnostics).
2. Never `CREATE TABLE` for `sys_*`/`magic_*`; only INSERT data.
3. Never generate `/system` paths.
4. Use the built-in `sys_office` for organization; do not create `t_company`/`t_dept`.
5. In `.vue`, use `$common.post` / `$common.handleDelete`; no `fetch`/`axios`; no `/api` prefix.
6. One permission code per button, unique; `<module>:<action>`.
7. Tables `t_*`; list all common columns explicitly (`id/is_del/create_by/create_date/update_by/update_date`); no "same as above".
8. Menu SQL filenames in the project language; deterministic UUIDs for SFC ids; no random UUIDs.
9. On publish failure: read `errors` → fix → republish. The backend takes a pre-publish backup; use rollback if needed.
10. `.ms` separator must be `\r\n` + 32 `=` + `\r\n`; otherwise the file is treated as source and appears empty.
11. After frontend changes rebuild + sync + repackage; never overwrite a running fat jar (`stop → package → start`).
12. Ask which development path the user wants (IDEA / release + online dev / skill); recommend release + online dev for business-only work.
13. Reports are Vue SFC + `<MagicReport>`, not JSON; use `body` params.
14. "Listen debug" is the recommended frontend/backend debugging flow (breakpoint → listen → trigger → real params).
15. magic-script does not support `??`; use `if (x == null)`.
16. `bundle_apply` pitfalls: the `file:` path bug (fixed in 0.3.1+) and the `\n====\r\n` separator (must be `\r\n====\r\n`). Always verify the separator.
17. Component pages: `src/magic-api/component/{group}/`; `group.json.path` + component `path` = menu `url`; no `component_id`. Use `scripts/ms-component.mjs` (`--publish` outputs the `kind=component` payload). Kernel 0.3.1+ publishes remotely; older kernels copy + restart.
18. Always verify after publish: `node scripts/verify-publish.mjs ...` (component/API/menu), exit 0. On failure, `scripts/rollback.sh --version <backupVersion>`.
19. 1.0.0 pitfalls: camelCase fields; frontend first POST has no body (guard null); `?{}`/`#{}` only script variables; anonymous needs `anonymous` + `require_login=false`; `.ms` `groupId` = parent `group.json` id; never delete platform APIs/components; button permissions need both the menu row and role grant; `db.table().insert()` does not generate varchar PKs.
20. Do not duplicate platform modules (`sys_user`/`sys_role`); build `t_*` business tables only.
21. Menus must have an icon (`sys_menu.icon` non-empty); choose from the icon library; validate each row.
22. App integration: business APIs are `/api/...`; login header `token: <uuid>`; editor `/#/lowcode/magic-editor`; check `SHOW COLUMNS FROM sys_menu` before writing menus (no `component_id`).
23. SQL must be parameterized: no `"..." + var`, no `${...}`; use `#{param}` / `?{cond}`; run `node scripts/sql-check.mjs <project>` (exit 0) before publishing.
24. Task `enabled` defaults to false; set `"enabled": true`; `import log`; verify with a temporary cron + restart.
25. Component data contracts: `mb-select` multiple = comma-separated string; `n-form` model must be mutated in place (`$common.objAssign`).
26. A release package is not a deployable business baseline: add `02-<project>-baseline.sql`; stop the instance before packaging.
27. **Permission-aware publish**: every business menu must be granted to a role. Write `sys_menu` + `sys_role_menu` (and `sys_permission_code` for buttons) in the same bundle; otherwise non-admin users cannot see the menu. Verify with a non-admin role.
28. **Component delete**: `kind=component` + `action=delete` (kernel 0.3.2+); `scripts/ms-component.mjs --delete` prints the payload. Deleting a component does not delete its menu; remove the menu separately.
29. **Output language**: reply in the user's language; write docs, menu names, and field comments in the project language.

## 6. Knowledge index

| Directory | Contents |
|---|---|
| `gewumind-boot/` (32) | Platform rules: tables, `mb-*` components, SFC, menus, CRUD, bundle publish, reports, dictionaries, icons, system config, frontend build, release/DB baseline |
| `api/` (14) | magic-api script language: syntax, request/response, modules, database, plugins |
| `database/` (11) | `db` module, SQL placeholders, transactions, redis/mongo/kafka/mqtt |
| `function/` (6) | Built-in functions: aggregate, collection, type conversion |
| `task/` (6) | Scheduled tasks: config, registration, pitfalls |
| `workflow/` (5) | Workflow definitions, entry APIs, wrapper pages |
| `report/` (6) | Report component props and generation workflow |
| `server-plugin/` / `subscriber-plugin/` | Server/subscriber plugin development |
| `repair/` | Repair flow for existing features |
