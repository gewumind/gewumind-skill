# Component pages (`.ms`)

GewuMind Boot 1.0.x serves pages as `.ms` component files. The SFC is compiled into `compileJs` / `compileCss` and stored in the file header.

## Layout

```text
src/magic-api/component/{group}/
├── group.json
└── {name}.ms
```

- `group.json`: `{ id, name, type: "component", parentId: "0", path: "/device", ... }`
- `.ms`: JSON header + `\r\n` + 32 `=` + `\r\n` + the Vue SFC source.
- Menu `url` = group `path` + component `path` (e.g. `/device` + `/list` = `/device/list`).
- `sys_menu` has no `component_id` in 1.0.x; the URL is the link.

## Generate

```bash
node scripts/ms-component.mjs \
  --vue src/pages/device-list.vue \
  --group Device --group-path /device \
  --name "Device List" --path /list
```

- Writes `group.json` (if missing) and `{name}.ms`.
- `--publish` prints the `bundle_apply` payload (`kind: "component"`, `metaJson` with `compileJs`/`compileCss`) and does **not** write local files.
- `--update` recompiles an existing `.ms`, preserving id/groupId/name/path.

## Publish

Kernel **0.3.1+**: publish remotely with `bundle_apply`:

```bash
node scripts/ms-component.mjs --vue ... --group Device --group-path /device \
  --name "Device List" --path /list --publish
# put the printed ms[0] into bundle_apply
```

The backend writes into the active language workspace, `data/{zh,en}/magic-api/component/{group}/{name}.ms` (Chinese default `data/zh`), and creates `group.json` as needed. `/system/component/runtime/list` reflects it immediately.

Older kernels (0.3.0 / 1.0.0) have no `kind: component`; copy the directory and restart
(older versions used `<backend>/data/magic-api/`):

```bash
cp -r src/magic-api/component/Device <backend>/data/magic-api/component/
```

## Delete

Kernel **0.3.2+**:

```json
{ "ms": [{ "group": "Device", "name": "Device List", "kind": "component", "action": "delete" }] }
```

or:

```bash
node scripts/ms-component.mjs --delete --group Device --name "Device List"
```

- Removes the `.ms`; deletes the group directory if only `group.json` remains.
- The menu is **not** removed; delete the `sys_menu` row (and `sys_role_menu` binding) separately.

## Menu and role

A component page is reachable only when:

1. the `sys_menu` row exists with `url` = group path + component path, and
2. the role has a `sys_role_menu` binding.

```sql
INSERT INTO sys_menu (id, pid, icon, name, url, sort, is_show, is_del, open_mode, keep_alive)
VALUES ('t-device-list', 't-device', 'Apps24Regular', 'Device List', '/device/list', 10, 1, 0, '0', 0);

INSERT INTO sys_role_menu (role_id, menu_id) VALUES ('<role-id>', 't-device-list');
```

## Verify

```bash
node scripts/verify-publish.mjs --base http://localhost:9089 \
  --component "Device List" --api /api/device/list --menu-url /device/list \
  --username admin --password 123456
```

Checks the component (`/system/component/runtime/list`), the API, and the menu in one run.

## Limits

- The runtime does not execute arbitrary Vue source; only `compileJs` / `compileCss` from the header are used.
- `types == 1` in the header; `properties.compileJs` and top-level `compileJs` should both be present.
- DOM-level i18n (`data/i18n/<lang>.json`) translates page chrome; business data is not translated.
- Platform components must not be deleted.

## Legacy SFC route

`sys_dynamic_component` + `sfc/*.sql` is the old route (1.0.0). Prefer `.ms` component pages for new projects.
