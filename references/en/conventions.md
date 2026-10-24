# Conventions

Hard rules for tables, menus, dictionaries, APIs, permissions, SQL, and component pages.

## Docs are the source of truth

`docs/requirement.md` → `ui.md` / `database.md` / `api.md` → generated artifacts. If something is not in the docs, do not generate it. Run `node scripts/docs-verify.mjs <project-root>` (exit 0) after stages 1/2.

## Tables

- Business tables: `t_<name>` (snake_case). Never `CREATE TABLE` for `sys_*` / `magic_*`; only INSERT data.
- Every table lists all common columns explicitly:
  `id varchar(36)`, `is_del int default 0`, `create_by varchar(36)`, `create_date datetime`,
  `update_by varchar(36)`, `update_date datetime`.
- `id`: varchar(36); business PKs must be generated explicitly (varchar PKs are not auto-generated).
- Soft delete: `is_del = 0` (active) / `1` (deleted); all list queries filter `is_del = 0`.
- Organization: use `sys_office`; do not create `t_company` / `t_dept`.
- Money: `decimal(18,2)`; dates: `datetime`; flags: `int`; JSON: `text`.
- Index business code/name columns used by list filters.

## Naming

- Database: snake_case; API paths: kebab-case; permission codes: `<module>:<action>`
  (`list` / `save` / `delete` / `export` / `import`; one unique code per button).
- Menu SQL filenames use the project language.
- SFC ids (`sys_dynamic_component`) use deterministic UUIDs derived from names; never random UUIDs.

## Menus and permissions

- `sys_menu` has 16 columns in 1.0.x and **no `component_id`**. Check with `SHOW COLUMNS FROM sys_menu` before writing SQL.
- `icon` must be non-empty (choose from `knowledge/gewumind-boot/16-icon-library.md`).
- Menu `url` = component group `path` + component `path` (e.g. `/device` + `/list` = `/device/list`).
- A menu is visible to a role only when **both** exist:
  1. the `sys_menu` row, and
  2. a `sys_role_menu (role_id, menu_id)` binding for that role.
- Button permissions: insert `sys_permission_code (id, code, pid, ...)` with `<module>:<action>` and bind the same code in the page.
- Platform APIs/components/menus must not be deleted.

Example (permission-aware publish):

```sql
INSERT INTO sys_menu (id, pid, icon, name, url, sort, is_show, is_del, open_mode, keep_alive)
VALUES ('t-device-list', 't-device', 'Apps24Regular', 'Device List', '/device/list', 10, 1, 0, '0', 0);

INSERT INTO sys_role_menu (role_id, menu_id)
VALUES ('<role-id>', 't-device-list');

INSERT INTO sys_permission_code (id, code, pid)
VALUES ('pc-device-export', 'device:export', '0');
```

Verify with a **non-admin** user that has the role; an admin bypasses permission checks and hides the problem.

## Dictionaries

- `sys_dict` columns: `id, desc_ribe, dict_type, type, is_del, ...`.
  The display name is `desc_ribe`; the key used by pages is `type` (e.g. `sex`, `office_type`).
- `sys_dict_items`: `id, value, label, dict_id, sort, ...`.
- Reference dictionaries by `type`; never inline user-editable lists in SQL.
- Seed English labels with `02-seed-en.sql` (deployment-level); do not translate business data.

## APIs

- Business paths: `/api/<top>/<sub>/<action>` in the browser; the magic-script `path` is relative to its group (`group.path` + item `path`).
- `list`: POST with `body` (`page`, `size`, filters); `save`: POST; `delete`: POST/DELETE.
- Use `permission` with `<module>:<action>`; omit it only for deliberately public endpoints.
- Never generate `/system` paths.
- `?{}` / `#{}` only see script variables; `body` must be guarded when the request has no body.

## SQL

- Parameterize: `#{param}`; dynamic conditions: `?{cond, ...}`.
- Forbidden: `"..." + var`, `${...}`, and variable LIMIT/OFFSET.
- Run `node scripts/sql-check.mjs <project>`; exit 0 before publish.

## Component pages

- Directory: `src/magic-api/component/{group}/{name}.ms` + `group.json`.
- Header JSON, then `\r\n` + 32 `=` + `\r\n`, then the source.
- Generate with `scripts/ms-component.mjs`; publish with `--publish` (kernel 0.3.1+).
- Menu `url` = group `path` + component `path`.
- Delete with `kind=component` + `action=delete`; the menu is separate.

## i18n (1.1.0+)

- Reply in the user's language; write docs, menu names, and field comments in the project language.
- UI language packs: `data/i18n/<lang>.json`; select with `?lang=en` or `localStorage.gw_lang`.
- Kernel messages: `data/i18n/messages_<lang>.properties` (external override).
- DB language: `02-seed-zh.sql` / `02-seed-en.sql` (deployment-level).
- Do not translate user-entered business data.

## Checklist

- [ ] Four docs complete and validated (`docs-verify.mjs` exit 0)
- [ ] Tables `t_*`, all common columns explicit, `is_del` filters
- [ ] Menus have icons; `url` matches component path; no `component_id`
- [ ] Every menu has a role binding (`sys_role_menu`); button codes unique
- [ ] SQL parameterized (`sql-check.mjs` exit 0)
- [ ] Component pages have `compileJs` / `compileCss`
- [ ] Publish verified (`verify-publish.mjs` exit 0); rollback available
