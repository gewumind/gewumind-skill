> **注意**：本文是 `sys_dynamic_component`（SFC SQL）路线。1.0.0 的页面请用 `.ms` 组件页面，见 `references/component-page.md`。

## 动态 SFC 组件（SFC SQL 注册）

> 📚 **本文件只讲 SFC SQL 注册** —— `sys_dynamic_component` 表的 INSERT、编译流程、层级结构、与菜单的关联。
>
> 📖 **Vue 模板写法**（mb-* 组件、CRUD 模板、$common/v-permission/uiSize、tableOptions schema、树形/子表单/字典用法）见 **`04b-sfc-vue-codegen.md`**。
>
> 🚨 **关键警告**：本文件历史版本曾把 `<mb-list>` 组件和 `<mb-form>` 容器标为「强制使用」，但 **system 下真实代码已经不用它们**（mb-list 有 bug、mb-form system 下完全不用）。所有 .vue 模板写法以 `04b-sfc-vue-codegen.md` 的「🔒 通用 CRUD 模板」为准（照抄 `frontend/src/views/system/dict/dict-list.vue`）。

---

### AI 注册新组件的流程（变更后）

**不**再通过 `/api/ai/component/save` 这种专用接口即时执行。AI 应该：

1. 把 .vue 写到项目 `src/pages/{name}.vue`（用 `writeFile` 工具）
2. 调用 `generateSfcFromVue(name, sql)` 预编译 + 生成 `sys_dynamic_component` 的 INSERT 写到 `src/sql/sfc/{name}.sql`
3. 用户点「发布」时 `applyBundle` 一次性执行该 SQL + 其他 SQL（已存在记录会自动 UPSERT 覆盖）

**为什么不直接调 saveComponent**：让用户能在编辑器里 review INSERT 语句，并且能跟 DDL、菜单 INSERT 在同一个事务里失败/回滚。

### 数据模型
- 保存在 `sys_dynamic_component` 表
- 核心字段：`name`（组件名）、`source_code`（Vue SFC 源码）、`compile_js`（编译后 JS）、`compile_css`（编译后 CSS）、`type`（0=分组, 1=组件）、`pid`（父分组）、`create_date`

### SFC 分组层级（type + pid，三级结构）

`sys_dynamic_component` 支持**两级分组**，与菜单树一一对应：

```
设备管理 (type=0, pid=0, name='device', remark='设备管理')               ← L1: 菜单组
├── 设备列表 (type=0, pid=device.id, name='device-list', remark='设备列表')   ← L2: 菜单 + 组件（同一条记录）
├── 状态监控 (type=0, pid=device.id, name='device-monitor', remark='状态监控')
└── 远程控制 (type=0, pid=device.id, name='device-control', remark='远程控制')
```

**关键**：SFC **没有 L3**。每个 L2 是 `sys_dynamic_component` 表里**一条** type=0 的记录，同时承担「菜单节点」和「组件容器」的角色（对应前端 `pages/{name}.vue` 的运行时组件）。

**字段命名**：
- `name` — 英文 kebab-case（`device-list`，给前端组件名用）
- `remark` — 中文名（"设备列表"，UI 展示用）

**规则**：
1. **L1 菜单组**（type=0, pid=0）：菜单树顶级，name 用英文 kebab-case（`device`），remark 用中文（"设备管理"）
2. **L2 菜单/组件**（type=0, pid=L1.id）：菜单树二级节点 + 前端组件容器，name 用 `{module}-{page}` 格式（`device-list`），remark 用中文（"设备列表"）
3. 生成顺序：**先 L1 → 再 L2**，每层依赖上一层的 id
4. 分组 SFC（L1）**没有** `.vue` 源文件（不需要前端组件），只生成 SQL INSERT
5. L2 SFC 对应一个 `src/pages/{name}.vue` 文件（用 `generateSfcFromVue` 编译）
6. `generateMenuSql` 的 `componentName` 参数指向 L2 组件的 name（**不带斜杠**）

### SFC SQL 文件组织（与 menu SQL 同构）

按"父级-子级"命名分组 SQL 文件（类似 `src/sql/menu/设备管理-设备列表.sql`）：

```
src/sql/sfc/
├── device.sql                              ← L1 分组 INSERT（只有 1 条 sys_dynamic_component，type=0, pid=0）
├── device-list.sql                         ← L2（设备列表），含 1 条 sys_dynamic_component，pid 用子查询
├── device-monitor.sql                      ← L2（状态监控）
├── device-control.sql                      ← L2（远程控制）
├── content-management.sql                  ← L1（内容管理）
├── content-notice.sql                      ← L2（通知公告）
├── content-video.sql                       ← L2（宣传视频）
└── ...
```

**关键规则**：
- **L1 文件**：只含 1 条 INSERT（type=0, pid='0'），**没有 .vue 源文件**
- **L2 文件**：含 1 条 INSERT（type=0, pid=子查询）。如果未来需要在同一菜单下放多个相关组件，会追加更多 INSERT
- **pid 用子查询** `(SELECT id FROM sys_dynamic_component WHERE name='{parent}' AND is_del=0 LIMIT 1)`，**不**硬编码 UUID
- 文件名 `{parent}-{name}.sql`，父级在前，子级在后，**与 menu SQL 命名一致**

### AI 生成 SFC SQL 的标准调用顺序

**Step 1: 调 `generateSfcGroup` 生成 L1 分组**
```js
generateSfcGroup({
  name: 'device',           // 英文 kebab-case
  remark: '设备管理',        // 中文
})
// → 写入 src/sql/sfc/device.sql
```

**Step 2: 写 .vue 文件**（详见 `04b-sfc-vue-codegen.md`）
```js
writeFile({ path: 'src/pages/device-list.vue', content: '<template>...</template><script setup>...</script>' })
```

**Step 3: 调 `generateSfcFromVue` 编译 + 写入 L2 SQL**
```js
generateSfcFromVue({
  name: 'device-list',      // 英文 kebab-case，跟 .vue 文件名一致
  parent: 'device',         // ← 父级 L1 的 name（自动算文件名 + pid 子查询）
  type: 0,                  // 0=L2 分组菜单（默认），1=组件（SFC 不推荐）
  remark: '设备列表',
})
// → 追加到 src/sql/sfc/device-list.sql（已存在则 append，不存在则 create）
```

**错误示范**：
- ❌ 不调 `generateSfcGroup`，直接写 L2（会缺 L1，pid 子查询查不到 → INSERT 时 pid=NULL 报错）
- ❌ `generateSfcFromVue` 不传 `parent`，L2 会写到 `src/sql/sfc/device-list.sql` 但 pid='0'（变成顶级组件，跟菜单树脱节）
- ❌ 同一个 L1 下多个 L2 都用单文件 `device-list.sql`、`device-monitor.sql`（OK，但未来要加子组件就得重命名）

### 组件名规范
- `name` 必须匹配 `^[a-zA-Z0-9\-_]+$`（纯英文 kebab-case，无 `/` 无中文）
- ❌ 错误：`/device/list`、`内容管理/通知公告`、`device/list`
- ✅ 正确：`device-list`、`device-monitor`、`config-function`、`content-notice`
- 全局唯一，编译失败不影响其他组件
- 通过 `app.component(name, Comp)` 注册到 Vue app
- `generateMenuSql` 的 `componentName` 参数必须使用 SFC name（不含 `/`）

### 编译流程
源文件：`src/scripts/compiler/sfc-compiler.js` + `magic-import.js` + `dynamicComponent.js`

1. **后端保存时**：UI 提交 `source_code` → 后端写入 `sys_dynamic_component`
2. **前端拉取时**：调用 `/system/component/list` 拿到所有组件
3. **运行时编译**（`compileCode`）：
   - 用 `@vue/compiler-sfc` 解析 .vue
   - `compileScript` 处理 `<script setup>`，重写 `export default` → `__sfc__` 变量
   - 替换 `import` 语句为 `___magic__import__('lib', 'name')`（仅在白名单内的 lib 才返回真实模块）
   - `compileTemplate` 编译 `<template>` → render 函数
   - `compileStyle` 编译 `<style scoped>` → CSS（注入到 `<head>`）
4. **注册**：`app.component(name, eval('(function(){ ' + compileJs + ' })()'))`

### Import 白名单（magic-import.js）
以下 import 路径**才**能解析，其他会被替换为 `undefined`：

| 路径 | 导出 |
|---|---|
| `vue` | 全部 |
| `naive-ui` | 全部 |
| `vue-router` | 全部 |
| `lodash-es` | 全部 |
| `@/scripts/xicons` | icon 组件（`People`, `Search`, `EditFilled`...） |
| `@/scripts/svg-icons` | SVG 文件名列表 |
| `@/scripts/router` | router 实例 |
| `@/store/modules/dictStore` | dictStore 模块（**唯一正确路径**，禁止 `@/store` 或 `@/stores/dict` 等变体） |
| `@/store/modules/userStore` | userStore 模块（**唯一正确路径**） |
| `@/components/magic/basic/mb-icon.vue` | `MbIcon` 组件 |

**调用机制**：`___magic__import__(lib, name)`：
- 如果 `lib` 不是 ES Module（如 vue）且 `name='*'` → 返回整个 lib
- 否则返回 `(libs[lib] || {})[name]`

**SFC 里的 import 写法**（⚠️ 严格遵守）：
```js
import { useDictStore } from "@/store/modules/dictStore";   // ✅ 正确
import { useDictStore } from "@/store";                    // ❌ 错误，无法解析为 useDictStore
import { useDictStore } from "@/stores/dict";              // ❌ 错误，白名单无此路径
import { ref } from "vue";                                 // ✅ 正确
```

---

## 🏠 首页 / Dashboard / 汇总首页 — 组织权限过滤

> **首页是 SFC 的特殊场景**：不挂菜单树（用 Vue Router 默认路由加载），但**必须**生成 SFC SQL + Vue 组件，且首页 API 必须按组织过滤数据（防止越权看到全平台数据）。

### 页面结构

- **路由**：`/` 或 `/dashboard`（前端 router 默认）
- **SFC 层级**：`home` (L1) → `home-dashboard` (L2)，与普通模块一样
- **菜单**：**不**注册到 `sys_menu`（不调 `generateMenuSql`）

### 必须的生成步骤

```js
// 1. 生成首页 L1 SFC（不需要 .vue，只有 SQL）
generateSfcGroup({
  name: 'home',           // ← 英文 kebab-case
  remark: '汇总首页',
})

// 2. 生成首页 L2 SFC（需要 .vue + 编译）
generateSfcFromVue({
  name: 'home-dashboard',
  parent: 'home',
  remark: '首页仪表盘',
})
// 必须先 writeFile src/pages/home-dashboard.vue，再 generateSfcFromVue
```

### ❶ 不生成 menu SQL

- 首页是默认路由（前端 router 的 `/` 或 `/dashboard`），**不挂菜单树** → **不要调 `generateMenuSql`**
- 详见 `05-menu-register.md` "不生成 menu SQL 的情况" 段落

### ❷ 后端 API 必须按组织过滤

**首页数据**（设备总数、活跃数、告警数、收入金额、待办等）**必须按当前用户所在组织过滤**，不允许全平台数据。

后端 magic-script 示例：

```js
// .ms 文件: src/magic-api/汇总首页/首页统计.ms
var userId = magic.user.id
var officeIds = office()  // 递归返回当前用户 + 所有下级 office 的 user_id 范围

var total = db.select("""
  SELECT COUNT(*) AS cnt
  FROM device
  WHERE is_del = 0 AND office_id IN (?)
""", officeIds).cnt

var active = db.select("""
  SELECT COUNT(*) AS cnt
  FROM device
  WHERE is_del = 0 AND status = '1' AND office_id IN (?)
""", officeIds).cnt

return {
  total: total,
  active: active,
  alert: alertCount,
  pending: pendingCount,
}
```

### ❸ 前端 Vue 必须传 officeId

- 不需要传，前端 `$common.post('/home/statistics')` 不带 body 即可
- 后端自动从 `magic.user` 拿当前用户 → 调 `office()` 解析组织范围

### 多层组织架构

当 `sys_office` 是树形结构（A 公司 → A1 部门 → A2 小组）时：
- 用户登录后 `office()` 返回**当前 office + 所有下级 office** 的 id 列表
- 列表 IN 查询用 `office_id IN (...)` 一次性过滤

### 反例（❌ 禁止）

```js
// ❌ 反例 1：查全平台所有设备（越权！）
var total = db.select("SELECT COUNT(*) AS cnt FROM device WHERE is_del = 0").cnt

// ❌ 反例 2：只查用户直属 office（漏掉下级组织数据，不全）
var total = db.select("SELECT COUNT(*) AS cnt FROM device WHERE office_id = ?", magic.user.officeId).cnt

// ❌ 反例 3：生成 menu SQL（首页不挂菜单树）
generateMenuSql({ fileName: '汇总首页', name: '汇总首页', url: '/home' })  // ← 删掉这个调用
```

### SFC 父子关系

- `home` (L1) 必须先生成（否则 L2 的 pid 子查询查不到）
- `home-dashboard` (L2) 的 pid 用子查询 `(SELECT id FROM sys_dynamic_component WHERE name='home' AND is_del=0 LIMIT 1)`
- 不需要 source_code（首页没有 .vue 源码编译）

### Vue Router 默认路由

前端 gewumind-boot 系统的默认路由通常配 `/` 或 `/dashboard` 指向 `home-dashboard` SFC。在 `src/router/index.js` 里（如果存在）或前端框架默认配置。

---

## 🔒 SFC 必须忠实现 ui.md

> **生成 SFC 前必须完整读取 ui.md 对应页面的所有字段、按钮、查询条件。不允许遗漏任何 ui.md 中定义的元素。**

**检查清单（缺一不可）**：
- [ ] 查询条件：ui.md 列出的每个搜索字段都必须在 `listOptions.table.where` 中出现
- [ ] 展示列：ui.md 表格列都必须在 `listOptions.table.cols` 中出现
- [ ] 按钮：ui.md 列出的每个按钮（新增/编辑/删除/导出等）都必须在 `listOptions.tools` 中出现
- [ ] 操作流：保存后刷新列表、删除二次确认等按 ui.md 实现
- [ ] 数据权限：如果 ui.md 标注了「数据权限：按组织过滤」，列表配置必须包含 `officeId` 查询条件
- [ ] 字典字段：ui.md 中的 `dict: xxx` 字段，前端必须用 `dictStore.getDict('xxx')` 获取选项
- [ ] 权限：所有操作按钮必须有 `v-permission` 或 `permission` 字段
- [ ] 尺寸：所有 n-* 交互元素绑 `:size="$global.uiSize.value"`

**常见遗漏问题**：
- ❌ ui.md 写了「查询条件：SN(模糊)、型号(dict)、状态(dict)、组织(tree-select)」，但生成的 SFC 只放了 SN 搜索框，遗漏了型号/状态/组织
- ❌ ui.md 写了按钮「新增/编辑/删除/导出」，但生成的 SFC 只有新增/编辑
- ❌ ui.md 写了「 officeId 查询条件（组织选择器）」，但 SFC 的 `where` 里没有 `officeId`
- ❌ ui.md 表格列里有 dict 字段，但生成的 cols 没用 `dictType`，导致显示原始 value 而非 label

---

## 🚧 限制

- **不支持** `<style module>`
- **不支持** `lang="ts"` 等 preprocessor（必须纯 JS）
- **必须**用 `<script setup>` 才能用 `defineProps/defineEmits/defineExpose` 等宏
- **不支持** `import` 白名单外的库（其他 import 会被替换为 undefined）
- scoped style 编译后用 `data-v-{uuid}` 隔离
- magic-api 脚本修改后需**重启 backend** 才能生效（有内存缓存）
- **mb-modal 内部基于 `@layui/layer-vue`**，不是 naive-ui 的 `n-modal`
- **mb-tree-select 的 v-model 是 string**（逗号连接），多选时不要用 array
- **mb-select / mb-checkbox 多选时 v-model 默认 join string**（`join: true`），如要 array 设 `join: false`
- **mb-table 没有内置的 page handler**：`page: true` 时它自动管 current/size，不需要 SFC 介入