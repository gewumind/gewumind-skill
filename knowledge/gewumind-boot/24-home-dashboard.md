# 首页 / dashboard.ms

> **首页内容的唯一入口**：`data/zh/magic-api/component/dashboard/dashboard.ms`。
> 登录后的 `/home` 路由渲染的就是这个组件；改首页 = 改这个文件。

## 位置与标识

```text
data/zh/magic-api/component/
└── dashboard/
    ├── group.json          # id: dashboard-root-group, path: /dashboard
    └── dashboard.ms        # name: dashboard, path: /dashboard, type: 1
```

- `group.json` 的 `path` 是 `/dashboard`
- 组件 meta：`name: dashboard`、`path: /dashboard`、`groupId: dashboard-root-group`
- 组件 id 与 `sys_dynamic_component` 里的 `dashboard` 行一致（`7342c275-...`）
- **不要改** `name` / `path` / `groupId` / `id`，否则首页找不到它

## 文件结构

和普通 `.ms` 组件一样：

```text
<meta JSON>\r\n================================\r\n<Vue SFC 源码>
```

SFC 里通常包含：

- 顶部统计卡片（用户/角色/菜单/操作日志）
- ECharts 图表（销售趋势、品类占比）
- 最近操作日志 / 登录日志表格
- `mb-*` 组件与 `$common.post('/system/...')` 数据请求

## 改首页内容

### 方式一：直接改 `.ms` 里的 SFC（推荐）

1. 编辑 `data/zh/magic-api/component/dashboard/dashboard.ms` 分隔符之后的 Vue 源码
2. 重新编译 `compileJs` / `compileCss`（保留 meta）：

```bash
node scripts/ms-component.mjs --update <backend>/data/zh/magic-api/component/dashboard/dashboard.ms
```

3. 重启后端，刷新 `/#/home`

### 方式二：维护独立的 `.vue`

```bash
# 改 src/pages/dashboard.vue 后
node scripts/ms-component.mjs \
  --update <backend>/data/zh/magic-api/component/dashboard/dashboard.ms \
  --vue src/pages/dashboard.vue
```

`--update` 会保留原来的 `id` / `groupId` / `name` / `path`，只替换 SFC 和编译产物。

## 发布

同机部署：

```bash
cp -r data/zh/magic-api/component/dashboard <backend>/data/zh/magic-api/component/
# 重启后端
```

验证：

- `GET /system/component/runtime/list` 里有 `name=dashboard`、`path=/dashboard`
- 浏览器打开 `/#/home` 看到新内容

## 规则

1. **首页入口固定是 `dashboard` 组件**；不要新建 `home.ms` 或改组件名。
2. `compileJs` / `compileCss` 必须非空，否则 runtime 不注册，首页空白。
3. 分隔符必须是 `\r\n` + 32 个 `=` + `\r\n`。
4. 首页用的图表依赖前端已内置的 `echarts`；新增依赖需要重新构建前端。
5. 首页是**静态路由**，不在 `sys_menu` 里；不需要改菜单。
6. 如果只是换数据/文案，优先改 SFC；如果只是调整统计口径，改 `$common.post` 的接口或参数。

## 常见问题

- **首页空白**：`compileJs` 为空 / 分隔符不对 / 组件名被改掉
- **改了没生效**：没有重启后端，或改的是源码仓库而不是后端 `data/zh/magic-api/component/`
- **图表不显示**：`echarts` 初始化容器尺寸为 0，检查 `waitForSize` 或容器样式
- **接口 401/403**：首页的 `$common` 请求需要登录态；确认已登录且权限足够
