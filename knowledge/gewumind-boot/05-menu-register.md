## 菜单注册

menu 数据存 `sys_menu` 表，前端通过 `/system/menu/current/menus` 接口加载生成路由。

> ⚠️ **`/system` 路径已被系统占用**，不要在 `/system` 下创建菜单或页面。请用 `/pages/xxx`、`/custom/xxx`、`/business/xxx` 等路径。

### AI 注册新菜单的流程（变更后）

**不**再通过 `/api/ai/menu/register` 这种专用接口即时插入。AI 应该：

1. **必先调 `listIcons()`** 查可用 svgIcons 白名单（菜单 icon 字段用 svgIcons 的 kebab-case 名）
2. 调用 `generateMenuSql(fileName, name, url, parentName, componentName, icon, permission)` 生成 `INSERT INTO sys_menu` 写到 `src/sql/menu/{fileName}.sql`
3. 用户点「发布」时 `applyBundle` 一次性执行

**为什么不直接调 menu/register**：让用户能在编辑器里 review SQL，并跟 DDL、其他 SQL 在同一个 bundle 里。

### 工具参数（结构化）

| 字段 | 必填 | 说明 |
|---|---|---|
| `fileName` | ✅ | 文件名（不含 `.sql`），如 `设备管理-设备登记` |
| `name` | ✅ | 菜单中文名，如 `设备登记` |
| `url` | ✅ | 路由路径，如 `/device/registration` |
| `parentName` | ❌ | 父菜单中文名（留空 = 顶级 `pid='0'`） |
| `componentName` | ❌ | 关联 SFC 英文名（子菜单必填） |
| `icon` | ❌ | svgIcons 的 kebab-case（先调 `listIcons()` 查白名单）。不传则从 url 首段派生（`/device/list` → `device` → icon=`monitor`）。零硬编码。 |
| `permission` | ❌ | 权限码（英文），如 `device:view`。顶级菜单自动清空。不传则从 url 首段派生（`/device/list` → `device:view`）。 |
| `sort` / `descRibe` / `keepAlive` / `isShow` / `openMode` | ❌ | 可选 |

**禁止再传 `sql` 字段**（raw SQL）——LLM 手写易错（列名错、漏 component_id、pid 子查询触发 MySQL 1093）。

### sys_menu 字段（后端实际 schema 17 列）

> **先查实际 schema**：1.0.0 实测 `sys_menu` 只有 16 列，**没有 `component_id`**（下表里的该字段不存在）。生成菜单 SQL 前先 `SHOW COLUMNS FROM sys_menu`，以实际列为准；`component` / `remarks` 同样不存在。

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | varchar(36) | 主键 UUID（工具用 `UUID()` MySQL 函数生成） |
| `pid` | varchar(36) | 父菜单 ID，`'0'`=根。子菜单：`(SELECT id FROM (SELECT id FROM sys_menu WHERE name='${parentName}' AND is_del=0 LIMIT 1) AS _t)` 包装子查询绕 MySQL 1093 |
| `icon` | text | 图标名（**必须是 svgIcons 白名单的 kebab-case**，如 `configure` / `monitor` / `oper-log`） |
| `desc_ribe` | text | 描述（默认空） |
| `name` | varchar(255) | 菜单显示名（中文，如「用户管理」） |
| `url` | varchar(255) | 路由路径，如 `/system/user/user-list` |
| `permission` | varchar(255) | 权限码（英文模块:动作，如 `user:view`） |
| `sort` | int | 排序（升序，默认 1） |
| `component_id` | varchar(36) | 动态组件 ID（关联 `sys_dynamic_component.id`，或子查询 + LIMIT 1） |
| `open_mode` | char(1) | 打开方式：`'0'`=iframe / `'1'`=新标签页 |
| `is_del` | int | 逻辑删除（0=未删） |
| `create_by` / `create_date` / `update_by` / `update_date` | | 审计字段 |
| `keep_alive` | int | 是否缓存：1=是 / 0=否（默认 1） |
| `is_show` | int | 是否侧栏可见：1=是 / 0=否（默认 1） |

**注意**：旧 schema 里的 `component` / `remarks` 列**不存在**，**禁止写**。`open_mode` 是 char(1)，**只能 `'0'` 或 `'1'`**（不能写 `Layout` 等长字符串）。

### open_mode 详解（**新 schema 必看**）

| 值 | 行为 | 配置 |
|---|---|---|
| `'0'` | iframe（推荐） | url 必填 |
| `'1'` | 新标签页 | url 必填 |

**注意**：旧 schema 的 `'2'`=动态SFC 已废弃，**所有 SFC 菜单都用 `'0'`**（前端会自动按 `component_id` 路由到 sys_dynamic_component）。

### component_id 取值规则

- 子菜单关联 SFC：`component_id = (SELECT id FROM sys_dynamic_component WHERE name='${componentName}' LIMIT 1)`
- 顶级菜单：`component_id = NULL`
- 复刻/重做场景（已部署）：工具自动从 snapshot 查 sfcId 复用

### /system/menu/current/menus 返回结构

```js
{
  notLayoutMenus: [   // 隐藏的、需要加载的路由（新窗口/iframe/动态SFC）
    { openMode, componentName, name, path, subCount, keepAlive }
  ],
  layoutMenus: [      // 侧栏显示的菜单树
    {
      id, title, pid, isShow, url, sort, icon, keepAlive,
      componentName, openMode, component, path,
      meta: { title, icon, keepAlive, openMode, path },
      redirect, alwaysShow,
      children: [ ... 递归嵌套 ]
    }
  ]
}
```

### 关键 SQL 逻辑（来自 当前用户菜单.ms）

```sql
-- 查隐藏/新窗口/iframe 菜单（不进 layout）
select * from sys_menu sm
left join sys_dynamic_component sdc on sdc.id = sm.component_id
where is_del = 0
  and (component_id is not null  -- 动态组件
       or (url is not null
           and url not like 'http%'  -- 排除外链
           and url not like '%.htm'))  -- 排除静态页
  and (is_show = 0 or open_mode in ('1', '2'))
-- 还要过滤叶子节点（sub_count = 0）

-- 查侧栏可见菜单
where is_del = 0 and is_show = 1
order by sort
```

### 后端菜单树组装（magic-script）

```js
// 1. 查所有菜单 + 动态组件名
var menus = db.select("""select sm.id, sm.name title, sm.pid, sm.is_show, sm.url,
                              sm.sort, sm.icon, sm.keep_alive, sdc.name as component_name,
                              sm.open_mode
                         from sys_menu sm
                         left join sys_dynamic_component sdc on sdc.id = sm.component_id
                         where is_del = 0 and is_show = 1
                         order by sm.sort""")

// 2. 装饰成 vue-router 格式
for(menu in menus){
    menu.component = (menu.url || "Layout")
    menu.path = (menu.component == 'Layout' ? "/" : menu.component)
    menu.meta = { title: menu.title, icon: menu.icon,
                  keepAlive: menu.keepAlive == '1', openMode: menu.openMode, path: menu.path }
}

// 3. 构建父子树
var nodes = menus.toMap(it => it.id)
nodes.each((key, node) => {
    if (nodes.containsKey(node.pid)) {
        nodes[node.pid].redirect = "noRedirect"
        nodes[node.pid].component = "Layout"
        nodes[node.pid].alwaysShow = true
        if(!nodes[node.pid].children) nodes[node.pid].children = []
        nodes[node.pid].children.push(node)
    }
})
var layoutMenus = []
nodes.each((key, node) => {
    if(node.pid == '0'){
        if(node.component != 'Layout'){
            node = { icon: node.icon, isShow: 1, component: 'Layout',
                     redirect: node.path, children: [node] }
        }
        layoutMenus.push(node)
    }
})

return { notLayoutMenus, layoutMenus }
```

### 完整新增菜单示例（结构化调用）

```js
// 1. 顶级菜单（系统设置）
generateMenuSql({
  fileName: '系统设置',
  name: '系统设置',
  url: '/system',
  // parentName 留空 → pid='0'
  icon: 'setting',
  sort: 10,
})

// 2. 子菜单（用户管理）
generateMenuSql({
  fileName: '系统设置-用户管理',
  name: '用户管理',
  url: '/system/user/user-list',
  parentName: '系统设置',  // 工具自动生成包装子查询 pid
  componentName: 'sys-user-list',  // 工具自动查 sfcId
  icon: 'People',  // 工具校验/默认
  permission: 'user:view',
  sort: 10,
})
```

工具输出的 SQL（**工具保证格式正确**，LLM 不用关心列名/顺序/子查询包装）：

```sql
-- 顶级菜单
INSERT INTO sys_menu (id, pid, icon, desc_ribe, name, url, permission, sort, component_id, open_mode, is_del, create_by, create_date, update_by, update_date, keep_alive, is_show)
VALUES (UUID(), '0', 'setting', '', '系统设置', '/system', '', 10, NULL, '0', 0, NULL, NOW(), NULL, NULL, 1, 1);

-- 子菜单（parentName 已部署 → 直接用 id；未部署 → 包装子查询）
INSERT INTO sys_menu (id, pid, icon, desc_ribe, name, url, permission, sort, component_id, open_mode, is_del, create_by, create_date, update_by, update_date, keep_alive, is_show)
VALUES (UUID(),
  (SELECT id FROM (SELECT id FROM sys_menu WHERE name='系统设置' AND is_del=0 LIMIT 1) AS _t),
  'People', '', '用户管理', '/system/user/user-list', 'user:view', 10,
  (SELECT id FROM sys_dynamic_component WHERE name='sys-user-list' LIMIT 1),
  '0', 0, NULL, NOW(), NULL, NULL, 1, 1);
```

### 🟢 L3 按钮权限菜单（重要！）

> **Vue 页面里的所有操作按钮（新增/编辑/删除/导出/审核/批量等）** 都**必须**有对应的 sys_menu L3 记录，否则 `v-permission` 指令查不到权限码，按钮会被错误隐藏。
> sys_menu **支持 3 层**：L1 顶级菜单 → L2 页面菜单 → **L3 按钮权限条目**（不显示在菜单树，仅存 `permission` 字段用于 v-permission 校验）。
>
> 🚨 **自动生成**：L3 按钮菜单**不需要 LLM 手动调 `generateMenuSql`**。`fixMagicApi` 会自动：
> 1. 扫 `src/pages/*.vue` 里所有 `v-permission="..."` 和 `cols.buttons[].permission`
> 2. 提取所有 `{module}:{action}` 格式的 permission
> 3. **全局唯一**：同一 permission 在多个 .vue 出现时只在第一个对应 L2 menu 下生成一次
> 4. 用 `nameToUuid('btn-{perm}')` 派生 id（**稳定**，已部署的不会被覆盖）+ `nameToUuid('menu-{parentName}')` 派生 pid（字面 UUID，**不需要子查询**，避免 MySQL 1093）
> 5. 追加 INSERT 到对应 L2 menu 文件（如 `sql/menu/设备管理-设备列表.sql`）
>
> 所以 **LLM 只管在 .vue 里写 `v-permission="device:save"`，调一次 `fixMagicApi` 就 OK**。

#### L3 按钮权限命名规范

`{module}:{action}`，**唯一**，与 Vue 按钮的 `v-permission` 字符串完全一致：

| 按钮 | permission |
|---|---|
| 新增 | `device:save` |
| 编辑 | `device:save`（复用） |
| 删除 | `device:delete` |
| 导出 | `device:export` |
| 批量操作 | `device:batch` |
| 审核 | `device:audit` |
| 重置密码 | `user:reset-password` |

#### LLM 写 .vue 后调一次 fixMagicApi

```js
// 不需要手动调 generateMenuSql(isButton:true)
// 只要 .vue 里写了 v-permission / cols.buttons[].permission，fixMagicApi 自动补全
fixMagicApi()
// → 扫描所有 .vue
// → 对每个 permission:
//   - 若 sys_menu 已存在，跳过
//   - 若不存在，找到对应 L2 menu（按 component_id 反查），追加 INSERT
// → 唯一性：同一 permission 全局只生成一次
```

工具输出的 L3 SQL（**注意 url/icon/component_id 都空，is_show=0**）：

```sql
-- L3 按钮权限条目（不显示在菜单树，仅权限控制用）
INSERT INTO sys_menu (id, pid, icon, desc_ribe, name, url, permission, sort, component_id, open_mode, is_del, create_by, create_date, update_by, update_date, keep_alive, is_show)
VALUES ('a6ac180f2b6003a9716ebf7b1fd6185c', '<nameToUuid("menu-设备列表")>', '', '', '保存', '', 'device:save', 99, NULL, '0', 0, 'ai-demo', NOW(), NULL, NULL, 1, 0);

INSERT INTO sys_menu (id, pid, icon, desc_ribe, name, url, permission, sort, component_id, open_mode, is_del, create_by, create_date, update_by, update_date, keep_alive, is_show)
VALUES ('<nameToUuid("btn-device:delete")>', '<nameToUuid("menu-设备列表")>', '', '', '删除', '', 'device:delete', 99, NULL, '0', 0, 'ai-demo', NOW(), NULL, NULL, 1, 0);
```

#### Vue 端对应

```vue
<template>
  <div class="mb-toolbar">
    <n-space>
      <n-button v-permission="'device:save'"   type="primary" @click="handleCreate">新增</n-button>
      <n-button v-permission="'device:export'" @click="table.exportExcel({fileName: '设备'})">导出</n-button>
    </n-space>
  </div>
  <div class="mb-table">
    <mb-table ref="table" v-bind="tableOptions" />
  </div>
</template>

<script setup>
const cols = [
  { field: 'sn', label: '设备编号' },
  {
    label: '操作', type: 'buttons', width: 200, fixed: 'right',
    buttons: [
      { permission: 'device:save',   label: '编辑', link: true, click: (row) => handleUpdate(row) },
      { permission: 'device:delete', label: '删除', link: true, click: (row) => $common.handleDelete({url:'/device/delete',id:row.id,done:()=>reloadTable()}) },
    ]
  }
]
</script>
```

#### 一致性保证

| Vue 端 | L3 SQL | 一致性 |
|---|---|---|
| `v-permission="'device:save'"` | `permission = 'device:save'` | ✓ |
| `cols.buttons[].permission = 'device:delete'` | `permission = 'device:delete'` | ✓ |
| `v-permission="'device:export'"` | `permission = 'device:export'` | ✓ |

**lintVue 自动检查**：
- `error`: toolbar 里 `<n-button>` 缺 `v-permission` → 报错
- `warning`: `cols.buttons` 里按钮对象缺 `permission` 字段 → 警告
- `error`: 用 `exportExcel` 但 `<mb-table>` 缺 `ref="..."` → 报错

#### LLM 常见错误

- ❌ 只写 Vue 按钮没调 `fixMagicApi` → 用户没有该按钮的权限（v-permission 找不到）→ 按钮永远不显示
- ❌ Vue 写 `v-permission="'device:save'"` 但 L3 写 `permission='device:add'` → 不匹配，按钮永远不显示
- ✅ 多个按钮共用同一个 permission（如 新增和编辑都用 device:save） → OK，按设计意图
- ❌ 手动调 `generateMenuSql({isButton:true, ...})` 生成重复 permission → fixMagicApi 会去重，但增加无用 SQL

#### 🚨 强保证：fixMagicApi 报告

`fixMagicApi` 跑完后会做**最终覆盖检查**：
- 扫所有 .vue 提取 `v-permission` + `cols.buttons[].permission`
- 检查每个 permission 是否都在 `sys_menu.permission` 里
- 如果仍有缺失，summary 报告里会列出：

```
❌ 2 个 .vue 仍有缺 L3: device-list(缺 device:save,device:delete)
   修复：调 generateMenuSql({isButton:true, permission, module, parentName, name}) 补全
```

**LLM 必须处理这个报告**（再次调 `fixMagicApi` 或手动 `generateMenuSql({isButton:true, ...})`），不能发布带 ❌ 的状态。

### 不生成 menu SQL 的情况

- **首页 / 首页统计 / 仪表盘 / 汇总首页**：首页是**默认路由**（前端 router 的 `/` 或 `/dashboard`），通过 SFC 组件 + Vue Router 路由表加载，**不挂菜单树**，所以**不要调 `generateMenuSql`**。ui.md 菜单树里的首页仅用于 PM 确认布局，不注册到 `sys_menu`。
- **LLM 常见错误**：把"汇总首页"当成普通 L1 菜单，调 `generateMenuSql(fileName='汇总首页', ...)` 生成 `sql/menu/汇总首页.sql`。**这是错的** —— 这种文件应该**不存在**。如果发现了 `sql/menu/汇总首页*.sql` 文件，请删除。
- **正确做法**：
  1. 调 `generateSfcGroup(name='home')` 写 L1 sys_dynamic_component → `sql/sfc/home.sql`
  2. 调 `generateSfcFromVue(name='home-dashboard', parent='home')` 写 L2 SFC → `sql/sfc/home-dashboard.sql`
  3. 写 `src/pages/home-dashboard.vue` 组件
  4. **不**调 `generateMenuSql`！
- 如果你不确定 → 调 `listMenus()` 看是否已有同名菜单；如果只是首页相关，跳过

### 注意事项

- **icon 白名单**：菜单 icon 必须是 svgIcons（kebab-case）的 21 个之一。完整清单调 `listIcons()` 查。不传则从 url 首段派生，**零硬编码猜名**。
- **permission 字段**：用于 `v-permission` 指令控制按钮/菜单显示（如 `user:view`、`user:save`）。**模块名必须英文**，不传则从 url 首段派生（`/device/list` → `device:view`）
- **动态组件菜单**必须先调 `generateSfcFromVue` 写 SFC → 才能在 `sys_menu.component_id` 引用
- **sort 升序**：同 pid 下 sort 小的在前
- **pid 树形**：删除父菜单前先删子菜单
- **MySQL 1093 错误**：sys_menu 的 pid 子查询必须用 `(SELECT id FROM (SELECT id FROM sys_menu WHERE name='X' AND is_del=0 LIMIT 1) AS _t)` 包装，否则报 "You can't specify target table 'sys_menu' for update in FROM clause"。工具自动包装
- **MySQL 8 LIMIT 1 必需**：所有 `=` 比较的子查询必须 `LIMIT 1`，否则抛 "bad SQL grammar"。工具自动加
