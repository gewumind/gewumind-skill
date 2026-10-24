# Pipeline

Four stages. **Wait for user confirmation after each stage**; do not run all stages in one go.

## Stage 1 — Requirement

Confirm:

- Organization levels (company / department / team) and roles
- Module scope and who uses each page
- Menu tree, main fields, statuses, and permissions per role

Write `docs/requirement.md` with 7 sections:

1. Background and goals
2. Users and roles
3. Organization levels
4. Modules and menu tree
5. Data scope per role
6. Business rules
7. Acceptance criteria

Exit: user confirms the requirement.

## Stage 2 — Design

Derive from the requirement:

- `docs/ui.md`: menu tree + page details (list columns, filters, form fields, buttons, permissions)
- `docs/database.md`: tables, columns, indexes, dictionaries, seed data
- `docs/api.md`: path tree, endpoints, functions, tasks, permission codes

Cross-check:

- Every menu page has an API and a table (or explicitly "existing table")
- Every field in `ui.md` exists in `database.md`
- Every permission code in `api.md` is in the role model
- Every dictionary used by a page is in `database.md`

Docs gate:

```bash
node scripts/docs-verify.mjs <project-root>          # exit 0
node scripts/docs-verify.mjs <project-root> --fix    # auto-fix formatting
```

Exit: docs validation passes and the user confirms the design.

## Stage 3 — Generate

Order (also the publish order):

1. DDL (`src/sql/ddl/`)
2. Seed data (`src/sql/insert/`)
3. magic-script: `api` / `function` / `task`
4. Component pages (`.vue` → `.ms`)
5. Menu SQL (`src/sql/menu/`) **including `sys_role_menu` bindings**
6. Dictionary SQL (`src/sql/dict/`)

Rules:

- Count the totals first (tables, pages, menus, APIs, dictionaries); generate item by item; verify each.
- Every menu row needs an icon and a role binding. A menu without a `sys_role_menu` row is invisible to non-admin users.
- Every button has a unique permission code; insert it into `sys_permission_code` when the page uses permission checks.
- SQL must be parameterized; run `node scripts/sql-check.mjs <project>` (exit 0).
- Component pages: `scripts/ms-component.mjs` produces the header + `\r\n====\r\n` + source; `--publish` prints the `bundle_apply` payload.

Exit: all artifacts exist and each matches a docs line.

## Stage 4 — Publish

1. (Optional) `GET /api/ai/snapshot` to inspect the current schema/components/menus.
2. Run `node scripts/sql-check.mjs <project>`; exit 0.
3. `bundle_apply` (MCP) or `POST /api/ai/bundle/apply` (REST). Record `backupVersion` from the response.
4. If `errors` is not empty, the backend auto-rolls back (0.3.2+): fix the files and republish.
5. Run `node scripts/verify-publish.mjs --base ... --component ... --api ... --menu-url ...`; exit 0 is required.
6. On failure, roll back: `scripts/rollback.sh --version <backupVersion> --ai-key ...`.
7. Report `appliedSql`, `appliedMs`, `deletedMs`, `backupVersion`, and the verify result.

### Permission check

Verify with a **non-admin** user that has the target role:

- The menu is visible.
- Buttons with permission codes are enabled/disabled correctly.

Admin bypasses permission checks; testing with admin proves nothing about role bindings.

## Packaging / release baseline

- `db/init/01-baseline.sql` contains platform tables only.
- Business projects add `db/init/02-<project>-baseline.sql` with business tables and seed data.
- Stop the running instance before `mvn package` (never overwrite a running fat jar).
- Language: `02-seed-zh.sql` / `02-seed-en.sql` are deployment-level; the base tables stay language-neutral.

## Exit criteria

- Stage 1/2: docs complete + `docs-verify` exit 0.
- Stage 3: counts match; `sql-check` exit 0.
- Stage 4: `bundle_apply` success; `verify-publish` exit 0; non-admin role sees the menu.
