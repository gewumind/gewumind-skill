# SFC Vue 代码生成（mb-* 组件 + 模板规范 + tableOptions schema）

> 📚 **本文件只讲 SFC 里的 Vue 写法** —— 模板语法、mb-* 组件用法、CRUD 标准模板、`tableOptions` schema、权限/尺寸规范、tree/子表单/字典集成模式。
>
> 📖 **SFC SQL 注册**（sys_dynamic_component 表、编译流程、生成工具调用）见 **`04-dynamic-sfc.md`**。
>
> 📖 **后端 magic-script API 设计**（CRUD 路由、参数规范、组织权限过滤）见 **`06-crud-api.md`**。
>
> 🚨 **关键警告**：所有 .vue 模板必须以「🔒 通用 CRUD 模板」为准（照抄 `frontend/src/views/system/dict/dict-list.vue`）。警告用 `<mb-list>` / `<mb-form>` / `fetch()` / `/api/` 前缀 / `.open()` / `@confirm-click` 都会被 `lintVue` 工具检测出来，必须修复。

---

## 🌍 全局可注入对象（无需 import）

SFC 编译时这些对象会自动注入到 `<script setup>` 顶层作用域，**不需要 import**：

| 对象 | 用途 | 来源 |
|---|---|---|
| `$common` | HTTP / 工具方法（post/get/handleDelete/exportExcel 等） | `src/scripts/common.js` |
| `$global` | 全局状态（uiSize、userInfo 等） | `src/scripts/global.js` |
| `$message` | naive-ui 消息提示 | naive-ui 自动 |
| `$dict` | 字典快捷访问（`$dict.device_status`） | dictStore 代理 |

### `$common.*` API（来自 `src/scripts/common.js`）

| 方法 | 用途 | 示例 |
|---|---|---|
| `$common.post(url, body)` | POST 请求，返回 Promise | `$common.post('/device/list', {page:1}).then(r => r.data.list)` |
| `$common.get(url, params)` | GET 请求 | `$common.get('/device/' + id)` |
| `$common.handleDelete({url, id, done})` | 通用删除（带二次确认） | `$common.handleDelete({url:'/device/delete', id: row.id, done: () => reloadTable()})` |
| `$common.exportExcel({data, fileName})` | 自定义数据导出 | `$common.exportExcel({data: rows, fileName: '设备'})` |
| `$common.download(url, fileName)` | 文件下载 | `$common.download('/file/123', 'report.xlsx')` |

**❌ 不要用** `fetch()` / `axios` / `callApi` —— 绕过全局拦截器（token、错误处理、统一 loading），且 `lintVue` 会检测报错。

### `v-permission` 指令

| 写法 | 行为 |
|---|---|
| `<n-button v-permission="'device:save'">` | 按钮根据 `useUserStore().getAuths` 判断显示/隐藏 |
| `cols.buttons[i].permission = 'device:delete'` | 列内操作按钮权限（按 `permission` 字段） |

**权限码命名规范**：`{module}:{action}`（如 `device:save`、`device:delete`、`device:export`）。
**必须**通过 `generateMenuSql({isButton:true, permission, module, parentName})` 生成 L3 sys_menu 记录（详见 `05-menu-register.md` "L3 按钮权限菜单"）。

**lintVue 自动检查**：
- `error`: `<n-button>` 缺 `v-permission` → 必须补
- `warning`: `cols.buttons` 里按钮对象缺 `permission` 字段 → 必须补

### `$global.uiSize.value`（尺寸规范）

所有 n-* 交互元素**必须**绑 `:size="$global.uiSize.value"`，让用户能全局调整 UI 尺寸。

```vue
<n-input :size="$global.uiSize.value" v-model:value="x" />
<n-button :size="$global.uiSize.value" @click="...">新增</n-button>
<n-form :size="$global.uiSize.value">...</n-form>
```

**mb-* 组件不用加**（自带 size 适配）。

---

## 📦 frontend 可用 mb-* 组件（按使用频率排序）

### 1. `<mb-table>`（CRUD 列表）— **最高频**

**位置**：`src/components/magic/basic/mb-table.vue`

**完整 schema**：

```vue
<div class="mb-table">
  <mb-table
    ref="table"
    :columns="tableOptions.cols"
    :data="tableOptions.data"
    :where="tableOptions.where"
    :page="true"
    v-model:checked-row-keys="ids"
    :size="$global.uiSize.value"
  />
</div>
```

| prop | 类型 | 说明 |
|---|---|---|
| `ref` | string | 用于 `table.reload()` / `table.exportExcel()` / `table.search()` |
| `:columns` | Array | 列定义，详见下方 `cols` schema |
| `:data` | Array | 直接数据（不走 API） |
| `:where` | Object | 搜索条件对象，传给后端 `{...where, page, size}` |
| `:page` | boolean | 是否分页（自动管 current/size） |
| `v-model:checked-row-keys` | Array | 多选选中的 key |

**方法（通过 ref 调用）**：

| 方法 | 用途 |
|---|---|
| `table.reload()` | 重新加载数据 |
| `table.search(where)` | 用新搜索条件查询 |
| `table.exportExcel({fileName, columns})` | 当前数据导出 Excel |
| `table.toggleRowSelection(row, selected)` | 切换某行选中 |

### 2. `<mb-modal>`（弹窗）— **CRUD 必须用**

**位置**：`src/components/magic/basic/mb-modal.vue`

```vue
<mb-modal ref="formDialog" :title="dialogTitle" @confirm="formRef.save($event)" width="670px">
  <user-form ref="formRef" :key="'userForm'" @reload-table="reloadTable" :data="currentRow" />
</mb-modal>

<script setup>
const formDialog = ref()
const openCreate = () => { currentRow.value = {}; dialogTitle.value = '新增用户'; formDialog.value.show() }
const openUpdate = (row) => { currentRow.value = { ...row }; dialogTitle.value = '编辑用户'; formDialog.value.show() }
</script>
```

**重要 API**：
- `.show()` 显示（**不是** `.open()`）
- `@confirm` 事件：payload 是表单数据（`$event`），传给 `formRef.save($event)`
- `ref="formRef"` 子组件必须暴露 `save(data)` 方法

### 3. `<mb-search>`（搜索表单）

```vue
<div class="mb-search">
  <mb-search :where="tableOptions.where" @search="reloadTable">
    <template #buttons>
      <n-button :size="$global.uiSize.value" v-permission="'device:save'" type="primary" @click="openCreate">新增</n-button>
      <n-button :size="$global.uiSize.value" v-permission="'device:export'" @click="table.exportExcel({ fileName: '设备' })">导出</n-button>
    </template>
  </mb-search>
</div>
```

### 4. `<mb-icon>`

```vue
<mb-icon icon="People" />             <!-- xicons -->
<mb-icon icon="setting" />            <!-- svgIcons（kebab-case） -->
<mb-icon icon="Search" :size="20" />
```

### 5. `<mb-list>`（CRUD 列表容器）— **⚠️ 已弃用，system 下真实代码不用**

```vue
<!-- ❌ 不要用 -->
<mb-list>...</mb-list>
```

**用普通 div 代替**：

```vue
<!-- ✅ 正确 -->
<div class="mb-list">
  <div class="mb-search">...</div>
  <div class="mb-table">...</div>
</div>
```

### 6. `<mb-form>`（表单容器）— **⚠️ 已弃用，system 下完全不用**

```vue
<!-- ❌ 不要用 -->
<mb-form>...</mb-form>
```

**手写 naive-ui 替代**：

```vue
<!-- ✅ 正确 -->
<n-form :model="form" :size="$global.uiSize.value">
  <n-grid :cols="2" :x-gap="12">
    <n-form-item-gi label="用户名" path="username">
      <mb-input v-model="form.username" />
    </n-form-item-gi>
    <n-form-item-gi label="邮箱" path="email">
      <mb-input v-model="form.email" />
    </n-form-item-gi>
  </n-grid>
</n-form>
```

### 7. `<mb-select>`（下拉）

```vue
<mb-select v-model="form.status" :options="statusOptions" placeholder="请选择状态" />

<!-- 字典下拉 -->
<mb-select v-model="form.status" dict-type="device_status" />
```

**多选时**：v-model 默认 join string（`join: true`），如要 array 设 `join: false`：
```vue
<mb-select v-model="form.roles" :join="false" multiple dict-type="user_role" />
```

### 8. `<mb-tree>`（树）

```vue
<mb-tree
  :data="officeTree"
  :checked-keys="form.officeIds"
  @update:checked-keys="form.officeIds = $event"
/>
```

### 9. `<mb-tree-select>`（树形下拉）

```vue
<mb-tree-select v-model="form.officeId" :data="officeTree" placeholder="选择组织" />
```

**注意**：v-model 是 string（逗号连接多选），不是 array。

### 10. `<mb-input>` / `<mb-textarea>`（文本）

```vue
<mb-input v-model="form.username" placeholder="请输入" clearable />
<mb-textarea v-model="form.remark" :rows="3" />
```

### 11. `<mb-date>`（日期）

```vue
<mb-date v-model="form.startDate" type="date" />
<mb-date v-model="form.range" type="daterange" />
```

### 12. `<mb-switch>`（开关）

```vue
<mb-switch v-model="form.enabled" />
```

### 13. `<mb-checkbox>`（复选框）

```vue
<mb-checkbox v-model="form.agreed">同意条款</mb-checkbox>
```

### 14. `<mb-radio-dict>`（字典单选）

```vue
<mb-radio-dict v-model="form.sex" dict-type="user_sex" />
```

### 15. `<mb-upload-image>` / `<mb-upload-file>` / `<mb-video>`

```vue
<mb-upload-image v-model="form.avatar" />
<mb-upload-file v-model="form.attachment" action="/file/upload" />
<mb-video v-model="form.video" />
```

### 16. `<mb-pagination>` / `<mb-editor-table>` / `<mb-select-table>` / `<mb-table-column>`

低频组件，按需用：

```vue
<mb-pagination v-model:page="page" v-model:size="size" :total="total" />
<mb-editor-table v-model="form.items" :columns="itemCols" />
<mb-select-table v-model="form.userId" url="/system/user/list" />
<mb-table-column field="name" label="名称" />
```

---

## 🚫 严禁使用的标签（SFC 模板里**绝对不能**写）

| ❌ 不要用 | ✅ 替代 | 原因 |
|---|---|---|
| `<mb-list>` | `<div class="mb-list">` | mb-list 有 bug |
| `<mb-form>` | `<n-form>` + `<n-grid>` + `<n-form-item>` | mb-form system 下完全不用 |
| `<mb-dialog>` | `<mb-modal>` | 项目里没有 mb-dialog |
| `<el-button>` / `<el-input>` | `<n-button>` / `<n-input>` | 用 naive-ui，不用 element-plus |
| `<a-table>` / `<el-table>` | `<mb-table>` | mb-table 已封装好 |
| `<a-modal>` | `<mb-modal>` | mb-modal 基于 `@layui/layer-vue` |

**`lintVue` 自动检测**这些标签，违规直接 **error**。

---

## 🚫 严禁的 import 写法

```js
// ❌ 错误（白名单无此路径）
import { useDictStore } from "@/store"
import { useDictStore } from "@/stores/dict"
import { useDictStore } from "@/store/dictStore"
import axios from "axios"  // 白名单无 axios
import { ElMessage } from "element-plus"  // 不要用 element-plus

// ✅ 正确（白名单内）
import { ref, reactive, computed, watch, onMounted } from "vue"
import { useDictStore } from "@/store/modules/dictStore"
import { useUserStore } from "@/store/modules/userStore"
import _ from "lodash-es"
```

**完整白名单**见 `04-dynamic-sfc.md` "Import 白名单（magic-import.js）" 段落。

---

## 🔒 通用 CRUD 模板（**真实代码**来自 `frontend/src/views/system/`）

### 完整 CRUD 模板（**真实代码**来自 `dict-list.vue`）

```vue
<template>
  <div class="mb-list">
    <div class="mb-search">
      <mb-search :where="tableOptions.where" @search="reloadTable">
        <template #buttons>
          <n-button v-permission="'dict:save'" type="primary" :size="$global.uiSize.value" @click="openCreate">
            <mb-icon icon="Plus" />新增
          </n-button>
          <n-button v-permission="'dict:export'" :size="$global.uiSize.value" @click="table.exportExcel({ fileName: '字典' })">
            <mb-icon icon="DownloadOutline" />导出
          </n-button>
        </template>
      </mb-search>
    </div>

    <div class="mb-table">
      <mb-table
        ref="table"
        :columns="tableOptions.cols"
        :where="tableOptions.where"
        :page="true"
        v-model:checked-row-keys="ids"
        :size="$global.uiSize.value"
      />
    </div>

    <mb-modal ref="formDialog" :title="dialogTitle" @confirm="formRef.save($event)" width="670px">
      <dict-form ref="formRef" :key="dialogTitle" :data="currentRow" @reload-table="reloadTable" />
    </mb-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed, h } from "vue"
import { $common } from "@/scripts/common"
import { useDictStore } from "@/store/modules/dictStore"

const table = ref()
const ids = ref([])
const formDialog = ref()
const formRef = ref()
const currentRow = ref({})
const dialogTitle = ref('新增字典')

const dictStore = useDictStore()

const tableOptions = reactive({
  where: {},
  cols: [
    { field: 'type', label: '字典类型', dictType: 'dict_type', width: 150 },
    { field: 'label', label: '字典标签', width: 200 },
    { field: 'value', label: '字典值', width: 120 },
    { field: 'sort', label: '排序', width: 80, type: 'number' },
    { field: 'remark', label: '备注' },
    {
      label: '操作', type: 'buttons', width: 200, fixed: 'right',
      buttons: [
        { permission: 'dict:save', label: '编辑', link: true, click: (row) => openUpdate(row) },
        { permission: 'dict:delete', label: '删除', link: true, click: (row) => handleDelete(row) },
      ]
    }
  ]
})

const reloadTable = () => table.value?.reload()
const openCreate = () => { currentRow.value = {}; dialogTitle.value = '新增字典'; formDialog.value.show() }
const openUpdate = (row) => { currentRow.value = { ...row }; dialogTitle.value = '编辑字典'; formDialog.value.show() }
const handleDelete = (row) => $common.handleDelete({ url: '/dict/delete', id: row.id, done: reloadTable })
</script>
```

### 关键要点（必须严格照抄）

1. **外层 `<div class="mb-list">`**（不是 `<mb-list>`）
2. **`<mb-search>` + `<template #buttons>`** 放工具栏按钮（不是 `n-space`）
3. **`<mb-modal>` 接收 `@confirm="formRef.save($event)"`**：payload 用 `save($event)` 而不是 `save`
4. **`formDialog.value.show()`**：用 `.show()` 不是 `.open()`
5. **API 路径不加 `/api` 前缀**：`url: '/system/dict/list'`
6. **API 调用用 `$common.post` / `$common.handleDelete`**，**不用** `fetch` / `axios` / `callApi`
7. **`cols` 字典字段加 `dictType: 'xxx'`**（自动 label 翻译）
8. **`where` 字典下拉用 `component: 'select'` + `props: { type: 'xxx' }`**
9. **所有 `n-button` 绑 `v-permission="..."`，所有 `cols.buttons` 加 `permission`**。每个按钮 permission **必须**通过 `generateMenuSql({isButton:true, permission:'<module>:<action>', module, parentName})` 生成对应 L3 sys_menu 记录（详见 `05-menu-register.md` "L3 按钮权限菜单"）。否则 `v-permission` 指令查不到权限码，按钮永远被 `el.remove()` 隐藏。
10. **所有 `n-input`/`n-button`/`n-form` 绑 `:size="$global.uiSize.value"`**
11. **保存后调 `dictStore.getDictData()`**（如果当前页改的是字典）

### 常见错误（AI 之前踩过的坑）

- ❌ `<mb-dialog>` → ✅ `<mb-modal>`（项目里没有 mb-dialog）
- ❌ `<mb-list>` 组件本体 → ✅ `<div class="mb-list">`（mb-list 有 bug）
- ❌ `<mb-form>` 容器 → ✅ 手写 `<n-form>` + `<n-grid>` + `<n-form-item>` + `<mb-input>`
- ❌ `mb-modal.open()` → ✅ `mb-modal.show()`
- ❌ `mb-modal @confirm="save"` → ✅ `mb-modal @confirm="save($event)"`
- ❌ `url: '/api/system/user/list'` → ✅ `url: '/system/user/list'`
- ❌ `axios.post(...)` → ✅ `$common.post(...)`
- ❌ `<el-button>` → ✅ `<n-button>` + `:size`
- ❌ `<mb-icon icon="Setting" />`（驼峰）→ ✅ `<mb-icon icon="setting" />`（kebab-case 来自 svgIcons 白名单）
- ❌ `<n-button @click="...">` 缺 `v-permission` → ✅ `<n-button v-permission="'device:save'">`
- ❌ `<mb-table>` 用 `:data` 走非 API 路径（不推荐）→ ✅ 用 `:where` 触发 mb-table 内置请求

---

## 📊 `tableOptions.where` 搜索条件 schema

`tableOptions.where` 是搜索条件对象，结构如下：

```js
const tableOptions = reactive({
  where: {
    // 普通输入框
    sn: { type: 'input', label: 'SN', value: '', placeholder: '请输入SN', like: true },

    // 字典下拉
    status: {
      type: 'select', label: '状态', value: null,
      props: { type: 'device_status' }  // 从 sys_dict 加载选项
    },

    // 树形下拉
    officeId: {
      type: 'tree-select', label: '组织', value: null,
      props: { url: '/system/office/tree', keyField: 'id', labelField: 'name' }
    },

    // 日期范围
    createDate: {
      type: 'date-range', label: '创建日期', value: null,
      props: { format: 'yyyy-MM-dd' }
    },

    // 数字范围
    price: { type: 'number-range', label: '价格', value: null },

    // 开关
    enabled: { type: 'switch', label: '启用', value: false },
  },
  cols: [ ... ]
})
```

**字段类型**：

| `type` | 渲染组件 | value 类型 | 说明 |
|---|---|---|---|
| `input` | `<n-input>` | string | 加 `like: true` 自动 LIKE 查询 |
| `select` | `<mb-select>` | string/number | 加 `props: { type: 'xxx' }` 从字典加载 |
| `tree-select` | `<mb-tree-select>` | string | 选节点 id |
| `date-range` | `<mb-date type="daterange">` | `[start, end]` | 自动展开成 `createDateStart`/`createDateEnd` |
| `number-range` | `<n-input-number>` 范围 | `[min, max]` | 同上 |
| `switch` | `<mb-switch>` | boolean | 加 `value: false` 表「全部」 |

**传给后端的格式**：

```js
// 前端 where 直接展开传后端：
$common.post('/device/list', { ...tableOptions.where, page: 1, size: 20 })
// 后端拿到：
// { sn: 'abc', status: '1', officeId: 'xxx', createDateStart: '2025-01-01', createDateEnd: '2025-01-31', page: 1, size: 20 }
```

---

## 📋 `tableOptions.cols` 列定义 schema

```js
const cols = [
  // 普通文本
  { field: 'sn', label: 'SN', width: 150 },

  // 字典翻译（自动 value → label）
  { field: 'status', label: '状态', dictType: 'device_status', width: 100 },

  // 数字
  { field: 'price', label: '价格', type: 'number', width: 120 },

  // 日期
  { field: 'createDate', label: '创建时间', type: 'date', width: 160 },

  // 自定义渲染
  {
    field: 'avatar', label: '头像', width: 80, type: 'image',
    render: (row) => h('img', { src: row.avatar, style: 'width:40px;height:40px;border-radius:50%' })
  },

  // 操作列（按钮组）
  {
    label: '操作', type: 'buttons', width: 200, fixed: 'right',
    buttons: [
      { permission: 'device:save',   label: '编辑', link: true, click: (row) => openUpdate(row) },
      { permission: 'device:delete', label: '删除', link: true, click: (row) => handleDelete(row) },
      { permission: 'device:audit',  label: '审核', link: true, click: (row) => handleAudit(row) },
    ]
  },

  // Tag（彩色标签）
  { field: 'status', label: '状态', type: 'tag', tagType: (row) => row.status === '1' ? 'success' : 'default' },
]
```

**字段说明**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `field` | string | 数据字段名 |
| `label` | string | 表头显示 |
| `dictType` | string | 字典类型，自动翻译 value → label |
| `type` | string | `'number'` / `'date'` / `'image'` / `'tag'` / `'buttons'` |
| `width` | number | 列宽（px） |
| `fixed` | string | `'left'` / `'right'` |
| `render` | function | 自定义渲染函数（`(row) => h(...)`） |
| `buttons` | array | 操作按钮组（type='buttons' 时用） |

**`buttons[]` 字段**：

| 字段 | 必填 | 说明 |
|---|---|---|
| `permission` | ✓ | 权限码（与 L3 menu permission 一致） |
| `label` | ✓ | 按钮文字 |
| `link` | - | `true` 用文字链接样式（默认 false = 普通按钮） |
| `click` | ✓ | 点击回调 `(row) => ...` |

---

## 🌳 树形表格（office / menu 类页面）

**适用场景**：组织架构、菜单树、分类树等树形数据展示。

```vue
<template>
  <div class="mb-list">
    <div class="mb-table">
      <mb-table
        ref="table"
        :columns="tableOptions.cols"
        :where="tableOptions.where"
        :default-expand-all="true"
        :tree-props="{ children: 'children' }"
        row-key="id"
      />
    </div>
  </div>
</template>

<script setup>
const tableOptions = reactive({
  where: {},
  cols: [
    { field: 'name', label: '组织名称', treeNode: true },  // ← treeNode: true 显示树形缩进
    { field: 'code', label: '编码', width: 150 },
    { field: 'type', label: '类型', dictType: 'office_type', width: 100 },
    {
      label: '操作', type: 'buttons', width: 200, fixed: 'right',
      buttons: [
        { permission: 'office:save', label: '编辑', link: true, click: (row) => openUpdate(row) },
        { permission: 'office:delete', label: '删除', link: true, click: (row) => handleDelete(row) },
      ]
    }
  ]
})
</script>
```

**后端 API 要求**：

```js
// magic-script: src/magic-api/系统管理/组织管理/组织树.ms
return db.select("""
  SELECT id, pid, name, code, type, sort
  FROM sys_office
  WHERE is_del = 0
  ORDER BY sort ASC
""")
// 返回结构：[{id, pid, name, children: [...]}]，pid=0 是根
```

**前端自动处理**：
- 后端返回扁平数组 + `pid` 字段 → mb-table 自动构建树
- 或返回树形结构（带 `children`）→ 直接渲染
- `row-key="id"` 必须指定

---

## 📝 子表单组件模式（user-form.vue 风格）

**适用场景**：表单字段多（>10 个）、需要嵌套子表、需要分步填写。

**主页面（user-list.vue）**：

```vue
<mb-modal ref="userFormDialog" :title="dialogTitle" @confirm="userFormRef.save($event)" width="800px">
  <user-form ref="userFormRef" :key="dialogTitle" :data="currentRow" @reload-table="reloadTable" />
</mb-modal>

<script setup>
const openUpdate = (row) => {
  currentRow.value = { ...row }
  dialogTitle.value = '编辑用户-' + row.username  // ← 用 row.id 强制重渲染
  userFormDialog.value.show()
}
</script>
```

**子表单组件（user-form.vue）**：

```vue
<template>
  <n-form :model="form" :size="$global.uiSize.value">
    <n-tabs type="line" :value="activeTab">
      <n-tab-pane name="base" tab="基本信息">
        <n-grid :cols="2" :x-gap="12">
          <n-form-item-gi label="用户名" path="username">
            <mb-input v-model="form.username" />
          </n-form-item-gi>
          <n-form-item-gi label="昵称" path="nickname">
            <mb-input v-model="form.nickname" />
          </n-form-item-gi>
          <n-form-item-gi label="邮箱" path="email">
            <mb-input v-model="form.email" />
          </n-form-item-gi>
          <n-form-item-gi label="手机" path="phone">
            <mb-input v-model="form.phone" />
          </n-form-item-gi>
        </n-grid>
      </n-tab-pane>

      <n-tab-pane name="role" tab="角色分配">
        <mb-tree
          :data="roleTree"
          :checked-keys="form.roleIds"
          @update:checked-keys="form.roleIds = $event"
        />
      </n-tab-pane>

      <n-tab-pane name="office" tab="所属组织">
        <mb-tree-select v-model="form.officeId" :data="officeTree" />
      </n-tab-pane>
    </n-tabs>
  </n-form>
</template>

<script setup>
import { ref, reactive, defineProps, defineEmits, defineExpose } from "vue"
import { $common } from "@/scripts/common"

const props = defineProps({ data: { type: Object, default: () => ({}) } })
const emit = defineEmits(['reload-table'])

const activeTab = ref('base')
const form = reactive({
  id: props.data.id || null,
  username: props.data.username || '',
  nickname: props.data.nickname || '',
  email: props.data.email || '',
  phone: props.data.phone || '',
  roleIds: props.data.roleIds || [],
  officeId: props.data.officeId || null,
})

// 暴露 save 方法给父组件 mb-modal @confirm 调用
const save = (callbackData) => {
  // callbackData 是 mb-modal 收集的额外数据（如果用户表单上有未绑定的字段）
  const payload = { ...form, ...callbackData }
  $common.post('/user/save', payload).then(() => {
    emit('reload-table')
  })
}

defineExpose({ save })
</script>
```

**关键点**：
1. **`:key="dialogTitle"`**：用 dialogTitle 强制重渲染（避免编辑 A 后再编辑 B 数据残留）
2. **`defineExpose({ save })`**：子组件必须暴露 save 方法
3. **`@confirm="userFormRef.save($event)"`**：payload 用 `$event` 不用 `()`
4. **多 tab**：用 `<n-tabs>` + `<n-tab-pane>` 拆分复杂表单
5. **角色/组织选择**：用 `<mb-tree>` + `:checked-keys`

---

## 📚 数据字典（dictStore）

```js
import { useDictStore } from "@/store/modules/dictStore"

const dictStore = useDictStore()

// 方式 1：watch + computed
const statusOptions = computed(() => dictStore.getDict('device_status'))

// 方式 2：直接用 $dict
const statusOptions = $dict.device_status

// 修改字典后强制刷新
const reloadDict = () => {
  dictStore.getDictData()  // 重新从后端拉
}

// cols 用 dictType 自动翻译
{ field: 'status', label: '状态', dictType: 'device_status' }

// where 下拉用字典
{ type: 'select', label: '状态', props: { type: 'device_status' } }
```

---

## ⚠️ magic-api 参数规范（关键！）

```js
// ✅ 正确：单值参数
var user = db.select("SELECT * FROM sys_user WHERE id = ?", id)

// ✅ 正确：IN 查询
var users = db.select("SELECT * FROM sys_user WHERE id IN (?)", [1, 2, 3])

// ✅ 正确：分页
var list = db.select("""
  SELECT * FROM sys_user
  WHERE is_del = 0
  ORDER BY create_date DESC
  LIMIT ? OFFSET ?
""", size, (page - 1) * size)

// ❌ 错误：直接拼字符串（SQL 注入风险）
var user = db.select("SELECT * FROM sys_user WHERE id = '" + id + "'")
```

**分页响应格式**：

```js
// 必须返回 { list, total } 结构（mb-table 才能识别）
return {
  list: rows,
  total: total
}
```

---

## 🧩 完整 SFC 示例（mb-list + mb-modal + mb-form + dict + permission）

```vue
<template>
  <div class="mb-list">
    <div class="mb-search">
      <mb-search :where="tableOptions.where" @search="reloadTable">
        <template #buttons>
          <n-button v-permission="'device:save'" type="primary" :size="$global.uiSize.value" @click="openCreate">
            <mb-icon icon="Plus" />新增设备
          </n-button>
          <n-button v-permission="'device:export'" :size="$global.uiSize.value" @click="table.exportExcel({ fileName: '设备' })">
            <mb-icon icon="DownloadOutline" />导出
          </n-button>
        </template>
      </mb-search>
    </div>

    <div class="mb-table">
      <mb-table
        ref="table"
        :columns="tableOptions.cols"
        :where="tableOptions.where"
        :page="true"
        v-model:checked-row-keys="ids"
        :size="$global.uiSize.value"
      />
    </div>

    <mb-modal ref="formDialog" :title="dialogTitle" @confirm="formRef.save($event)" width="800px">
      <device-form ref="formRef" :key="dialogTitle" :data="currentRow" @reload-table="reloadTable" />
    </mb-modal>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from "vue"
import { $common } from "@/scripts/common"
import { useDictStore } from "@/store/modules/dictStore"

const table = ref()
const ids = ref([])
const formDialog = ref()
const formRef = ref()
const currentRow = ref({})
const dialogTitle = ref('新增设备')

const dictStore = useDictStore()

const tableOptions = reactive({
  where: {
    sn: { type: 'input', label: 'SN', value: '', placeholder: '请输入设备SN', like: true },
    model: { type: 'input', label: '型号', value: '' },
    status: { type: 'select', label: '状态', value: null, props: { type: 'device_status' } },
    officeId: { type: 'tree-select', label: '组织', value: null, props: { url: '/system/office/tree', keyField: 'id', labelField: 'name' } },
    createDate: { type: 'date-range', label: '创建日期', value: null },
  },
  cols: [
    { field: 'sn', label: 'SN', width: 150, fixed: 'left' },
    { field: 'model', label: '型号', width: 120 },
    { field: 'status', label: '状态', dictType: 'device_status', width: 100 },
    { field: 'officeName', label: '所属组织', width: 150 },
    { field: 'createDate', label: '创建时间', type: 'date', width: 160 },
    {
      label: '操作', type: 'buttons', width: 200, fixed: 'right',
      buttons: [
        { permission: 'device:save',   label: '编辑', link: true, click: (row) => openUpdate(row) },
        { permission: 'device:delete', label: '删除', link: true, click: (row) => handleDelete(row) },
        { permission: 'device:audit',  label: '审核', link: true, click: (row) => handleAudit(row) },
      ]
    }
  ]
})

const reloadTable = () => table.value?.reload()
const openCreate = () => { currentRow.value = {}; dialogTitle.value = '新增设备'; formDialog.value.show() }
const openUpdate = (row) => { currentRow.value = { ...row }; dialogTitle.value = `编辑-${row.sn}`; formDialog.value.show() }
const handleDelete = (row) => $common.handleDelete({ url: '/device/delete', id: row.id, done: reloadTable })
const handleAudit = (row) => $common.post('/device/audit', { id: row.id }).then(reloadTable)
</script>
```

**对应 magic-script API**：

```js
// src/magic-api/设备管理/设备列表/分页.ms (POST)
var where = body
var officeIds = office()  // 当前用户组织范围
var sql = """
  SELECT d.*, o.name AS officeName
  FROM device d
  LEFT JOIN sys_office o ON o.id = d.office_id
  WHERE d.is_del = 0 AND d.office_id IN (?)
"""
var args = [officeIds]
if (where.sn) { sql += " AND d.sn LIKE ?"; args.push('%' + where.sn + '%') }
if (where.model) { sql += " AND d.model = ?"; args.push(where.model) }
if (where.status) { sql += " AND d.status = ?"; args.push(where.status) }
if (where.officeId) { sql += " AND d.office_id = ?"; args.push(where.officeId) }
if (where.createDateStart) { sql += " AND d.create_date >= ?"; args.push(where.createDateStart) }
if (where.createDateEnd) { sql += " AND d.create_date <= ?"; args.push(where.createDateEnd) }

var total = db.select("SELECT COUNT(*) AS cnt FROM (" + sql + ") AS _t", ...args).cnt
sql += " ORDER BY d.create_date DESC LIMIT ? OFFSET ?"
args.push(size, (page - 1) * size)
var list = db.select(sql, ...args)
return { list, total }

// src/magic-api/设备管理/设备列表/删除.ms (POST)
db.update("UPDATE device SET is_del = 1, update_date = NOW() WHERE id = ?", body.id)
return { success: true }

// src/magic-api/设备管理/设备列表/保存.ms (POST)
if (body.id) {
  db.update("UPDATE device SET ... WHERE id = ?", ...)
} else {
  db.insert("INSERT INTO device (...) VALUES (...)", ...)
}
return { success: true }
```