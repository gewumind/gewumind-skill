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

- **icon 必填**：新建菜单不能留空；从 `knowledge/gewumind-boot/16-icon-library.md` 选。

## 发布

内核 **0.3.1+** 支持 `bundle_apply` 直接发布组件（`kind: "component"`）：

```bash
# 1) 编译 SFC → bundle_apply 需要的 JSON（不写本地文件）
node scripts/ms-component.mjs --vue src/pages/device-list.vue \
  --group 设备管理 --group-path /device --name 设备列表 --path /list --publish

# 2) 把输出的 ms[0] 原样放进 bundle_apply 的 ms[]
#    metaJson 必须含 compileJs / compileCss
```

后端写入当前语言工作区 `data/{zh,en}/magic-api/component/{group}/{name}.ms`（中文默认 `data/zh`；自动建 `group.json`），
`/system/component/runtime/list` 立即可见；菜单仍需单独的 `sys_menu` INSERT（`url = groupPath + path`）。

旧版内核（0.3.0 / 1.0.0）没有 `kind: component`，只能同机复制 + 重启（旧版路径为 `<backend>/data/magic-api/`）：

```bash
cp -r src/magic-api/component/设备管理 <backend>/data/magic-api/component/
```

验证（推荐脚本，登录 + 组件 + 接口 + 菜单一次跑完）：

```bash
node scripts/verify-publish.mjs --base http://localhost:9089 \
  --component 设备列表 --api /api/device/list --menu-url /device/list \
  --username admin --password 123456
```

## 可选：归入模块标签

默认**不需要**。只有希望业务菜单单独占一个顶部标签时，才创建 `sys_module` 并绑定 `sys_module_menu`；详见 `knowledge/gewumind-boot/23-module-organization.md`。

## 与 SFC SQL 的区别

| | `.ms` 组件（推荐） | `sys_dynamic_component` |
|---|---|---|
| 存储 | 文件 | 数据库表 |
| 菜单关联 | `url` 路径 | `component_id`（1.0.0 无此列） |
| 发布 | `bundle_apply`（kind=component，0.3.1+）/ 复制+重启（旧版） | SQL `INSERT` + `bundle_apply` |
| 适用 | 1.0.0 的页面 | 旧版 / 动态组件 |

## 常见问题

- **页面空白**：检查 `.ms` 分隔符是否 `\r\n====\r\n`，以及 `compileJs` 是否为空。
- **菜单点了 404**：菜单 `url` 必须等于 `group path + 组件 path`。
- **组件列表里没有**：确认文件在 `<backend>/data/zh/magic-api/component/`，并重启过后端。
- **组件 id 冲突**：`groupId` 必须等于 `group.json` 的 `id`；`id` 用 `nameToUuid` 生成，重复生成会覆盖。
