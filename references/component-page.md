# 组件页面：`.ms` 组件（1.0.0 页面机制）

> 当前后端实际使用的页面机制。`sys_dynamic_component`（SFC SQL）是另一条路线，见 `04-dynamic-sfc.md`。
> 1.0.0 的 `sys_menu` **没有 `component_id`**，菜单靠 `url` 关联页面。

## 目录与 URL

```text
src/magic-api/component/
└── 设备管理/                 # 中文组名
    ├── group.json            # path: /device
    └── 设备列表.ms           # path: /list  → 菜单 url: /device/list
```

- `group.json` 的 `path` 是英文 URL 段，每层一级。
- 组件 `.ms` 的 `path` 是页面路径。
- **菜单 url = 各级 group path + 组件 path**（如 `/device` + `/list` = `/device/list`）。

## `.ms` 格式

```text
<meta JSON>\r\n================================\r\n<Vue SFC 源码>
```

meta 关键字段：

| 字段 | 值 |
|---|---|
| `type` | `1`（组件） |
| `properties.type` | `1` |
| `properties.compileJs` / `compileCss` | `@vue/compiler-sfc` 编译结果，**必填**（否则 runtime 不注册） |
| `name` | 中文页面名 |
| `path` | `/list` |
| `groupId` | 所属 `group.json` 的 id |

> 分隔符必须是 `\r\n` + 32 个 `=` + `\r\n`。否则脚本会被当成 `null`，页面是空白。

## 生成

```bash
node scripts/ms-component.mjs \
  --vue src/pages/device-list.vue \
  --group 设备管理 --group-path /device \
  --name 设备列表 --path /list \
  --out src/magic-api/component
```

产物：

- `src/magic-api/component/设备管理/group.json`
- `src/magic-api/component/设备管理/设备列表.ms`

脚本会调用 `sfc-compile.mjs` 的 `compileCode`，把 `.vue` 编译成 `compileJs` / `compileCss` 并写进 meta。

## 菜单 SQL（1.0.0）

```sql
INSERT INTO sys_menu
  (id, pid, icon, name, url, permission, sort, open_mode, is_del, keep_alive, is_show, create_date)
VALUES
  (UUID(), '0', 'monitor', '设备管理', '/device/list', 'device:view', 10, '0', 0, 1, 1, NOW());
```

- 一级菜单直接挂页面：`pid='0'`，`url` 填页面路径。
- 需要「父菜单 + 子页面」时：父菜单 `url` 留空，子菜单 `pid` 指向父 id。
- **不要写 `component_id`**（1.0.0 不存在该列）。

## 发布

`bundle_apply` 只接受 `kind: api/function/task`，**不能直接发布组件**。同机部署时：

```bash
cp -r src/magic-api/component/设备管理 <backend>/data/magic-api/component/
# 重启后端（或刷新 magic-api 资源）
```

验证：

```bash
# 运行时组件（需要登录 token）
curl -H "token: <session-token>" http://localhost:9089/system/component/runtime/list \
  | jq '.[]? | select(.path=="/device/list")'

# 菜单
curl -X POST -H "token: <session-token>" \
  http://localhost:9089/api/system/menu/current/menus -d '{}' | jq
```

远程后端没有组件保存接口：要么后端侧复制 + 重启，要么给 `bundle_apply` 增加 `kind: component`。

## 与 SFC SQL 的区别

| | `.ms` 组件（推荐） | `sys_dynamic_component` |
|---|---|---|
| 存储 | 文件 | 数据库表 |
| 菜单关联 | `url` 路径 | `component_id`（1.0.0 无此列） |
| 发布 | 复制文件 + 重启 | SQL `INSERT` + `bundle_apply` |
| 适用 | 1.0.0 的页面 | 旧版 / 动态组件 |

## 常见问题

- **页面空白**：检查 `.ms` 分隔符是否 `\r\n====\r\n`，以及 `compileJs` 是否为空。
- **菜单点了 404**：菜单 `url` 必须等于 `group path + 组件 path`。
- **组件列表里没有**：确认文件在 `<backend>/data/magic-api/component/`，并重启过后端。
- **组件 id 冲突**：`groupId` 必须等于 `group.json` 的 `id`；`id` 用 `nameToUuid` 生成，重复生成会覆盖。
