# 硬约定速查（违反必然出 bug）

> 从 GewuMind IDE 的角色 prompt 与 `frontend/src/views/system/**` 真实代码提取。细节展开见 `knowledge/gewumind-boot/` 对应文档。

## 表规范

| 项 | 约定 |
|---|---|
| 业务表名 | `t_xxx`（snake_case） |
| 系统表 | `sys_*` / `magic_*` **已存在，禁止 CREATE**，只 INSERT |
| 主键 | `id varchar(36) PK`（应用层 UUID，非自增） |
| 公共字段（每表必带，显式列出） | `is_del tinyint NOT NULL DEFAULT 0` / `create_by varchar(36)` / `create_date datetime` / `update_by varchar(36)` / `update_date datetime` |
| 必填字段 | `NOT NULL`（即使有 DEFAULT）；`is_del` 永远 `NOT NULL DEFAULT 0` |
| 引擎 | `InnoDB` / `utf8mb4` / `ROW_FORMAT=DYNAMIC` |
| 关联 | `xxx_id varchar(36)` + 注释说明关联表，**不写外键** |
| 枚举字段 | 注释 `dict: <字典键>`；字典键必须在 database.md 字典清单有定义 |
| 组织 | 用 `sys_office`（pid 层级 + type 字典），**禁止**新建 t_company/t_dept/t_station/t_team |

## API 规范

- 路径 `/{顶级}/{子段}/{动作}`，kebab-case（`/device/registration/list`）
- 权限码 `<模块>:<动作>`，动作 ∈ list / save / delete / export / import
- **每个按钮独立权限码，禁止两个按钮复用同一个码**
- 请求扁平字段（`{current, size, where: {...}, officeId?}`），响应 `{code, data, msg}`
- 组织管理：`/sys/office/list|save|delete`（权限码 `office:*`）；字典类型：`/sys/dict/{type}/items`（`dict:*`）
- magic-script CRUD 模板：`knowledge/gewumind-boot/06-crud-api.md`（`db.page`/`db.table`/`db.selectOne`/`db.update`，参数 `#{param}`，动态条件 `?{param, and x = #{param}}`）

## 组件页面（.ms）硬规则（1.0.0）

- 目录：`src/magic-api/component/{中文组}/`；每级 `group.json` 的 `path` 是英文 URL 段。
- 组件 `.ms`：meta JSON（`type:1`、`properties.type:1`、`compileJs`/`compileCss`）+ `\r\n` + 32 个 `=` + `\r\n` + Vue SFC。
- 菜单 `url` = group path + 组件 path；**不要写 `component_id`**（1.0.0 无此列）。
- 生成：`node scripts/ms-component.mjs --vue ... --group ... --group-path ... --name ... --path ... --out src/magic-api/component`
- 发布：把 `src/magic-api/component/{中文组}/` 复制到后端 `data/magic-api/component/`，重启后端。
- 详见 `references/component-page.md`。

## SFC（.vue 动态组件，SFC 表路线）硬规则

**权威模板**：后端仓库 `frontend/src/views/system/**` 真实代码（如 user/role/menu 下的页面）。生成时**照抄其结构**。

### 强制结构

```vue
<template>
    <div class="mb-list">
        <div class="mb-search">
            <mb-search :where="tableOptions.where" @search="reloadTable"/>
        </div>
        <div class="mb-toolbar">
            <n-space>
                <n-button :size="$global.uiSize.value" v-permission="'{module}:add'" type="primary" @click="handleCreate">
                    <mb-icon icon="AddOutline" />
                    添加{中文名}
                </n-button>
            </n-space>
        </div>
        <div class="mb-table">
            <mb-table ref="table" v-bind="tableOptions"/>
        </div>
        <mb-modal ref="{module}Dialog" :title="dialogTitle" width="600px" @confirm="save($event)">
            <n-form :size="$global.uiSize.value" ref="dataForm" :rules="rules" :model="temp" label-placement="left" label-width="80px">
                <n-grid :cols="24">
                    <n-gi :span="12">
                        <n-form-item label="{字段中文名}" path="{fieldName}">
                            <mb-input :size="$global.uiSize.value" v-model="temp.{fieldName}"/>
                        </n-form-item>
                    </n-gi>
                </n-grid>
            </n-form>
        </mb-modal>
    </div>
</template>

<script setup>
import {ref, reactive, nextTick} from 'vue'

const table = ref()
const {module}Dialog = ref()
const dataForm = ref()
const dialogTitle = ref('')
const temp = ref(getTemp())
const rules = reactive({
    {fieldName}: {required: true, message: '请输入{字段中文名}', trigger: 'blur'}
})

const tableOptions = reactive({
    id: '{module}-list',
    url: '/{module}/{page}/list',
    page: true,
    where: {
        {fieldName1}: {label: '{字段1中文名}'},
        {fieldName2}: {component: 'select', label: '{字段2中文名}', props: {'all-option': true, type: '{dict_type}'}}
    },
    cols: [
        {field: '{fieldName1}', label: '{字段1中文名}'},
        {field: '{dictField}', label: '{字典字段}', dictType: '{dict_type}'},
        {
            label: '操作', type: 'buttons', width: 220, fixed: 'right',
            buttons: [
                {permission: '{module}:edit', label: '修改', link: true, click: (row) => handleUpdate(row)},
                {permission: '{module}:delete', label: '删除', link: true,
                   click: (row) => $common.handleDelete({url: '/{module}/{page}/delete', id: row.id, done: () => reloadTable()})}
            ]
        }
    ]
})

function getTemp() { return { id: '', {fieldName}: '' } }
function reloadTable() { table.value.reload() }

function handleCreate() {
    temp.value = getTemp()
    dialogTitle.value = '添加'
    {module}Dialog.value.show()
    nextTick(() => dataForm.value.restoreValidation())
}

function save(d) {
    dataForm.value.validate((errors) => {
        if (!errors) {
            d.loading()
            $common.post('/{module}/{page}/save', temp.value).then((response) => {
                d.hideLoading()
                {module}Dialog.value.hide()
                $message.success(dialogTitle.value + '成功')
                reloadTable()
            }).catch(() => d.hideLoading())
        }
    })
}

function handleUpdate(row) {
    $common.objAssign(temp.value, row)
    dialogTitle.value = '修改'
    {module}Dialog.value.show()
    nextTick(() => dataForm.value.restoreValidation())
}
</script>
```

### 检查清单（每个 .vue 缺一不可）

- [ ] 外层 `<div class="mb-list">`（**不是** `<mb-list>` 组件）
- [ ] 搜索区 `<div class="mb-search"><mb-search :where="tableOptions.where" @search="reloadTable"/></div>`
- [ ] 工具栏 `<div class="mb-toolbar"><n-space><n-button .../></n-space></div>`
- [ ] 表格 `<div class="mb-table"><mb-table ref="table" v-bind="tableOptions"/></div>`
- [ ] 表单手写 `<n-form>` + `<n-grid>` + `<n-form-item>` + `<mb-input>/<mb-select>`
- [ ] `<mb-modal @confirm="save($event)">`——payload 是 `$event`
- [ ] 弹窗打开用 `.show()`
- [ ] API 路径**无** `/api` 前缀（`url: '/{module}/{page}/list'`）
- [ ] API 调用用 `$common.post` / `$common.handleDelete`
- [ ] 字典字段：表单 `<mb-select type="{dict_type}"/>` + cols 加 `dictType`
- [ ] 每个 `n-button` 绑 `v-permission`，每个 col 按钮带 `permission`，**权限码唯一不复用**
- [ ] `n-input`/`n-button`/`n-form` 绑 `:size="$global.uiSize.value"`
- [ ] ui.md 标注的搜索字段全在 `where`，展示列全在 `cols`，操作列在末尾 `type: 'buttons'`
- [ ] 非标准页面（看板/配置页）同样每个按钮绑 `v-permission`（`{module}:{action}`）

### 禁止清单

| ❌ | ✅ 正确 |
|---|---|
| `<mb-list>` 组件本体（slot 有 bug） | `<div class="mb-list">` |
| `<mb-form>` 容器 | 手写 `<n-form>` |
| `<mb-modal><template #content>`（只有 default slot） | 内容直接放 default slot |
| `@confirm-click` | `@confirm` |
| `fetch()` / `axios` / `callApi` | `$common.post` / `$common.handleDelete` |
| `{dialog}.open()` | `.show()` |
| 手动分页（`pagination=`/`@page-change`） | `page: true`（mb-table 自带） |
| `<mb-search :items ... @reset>` | `:where` + `@search` |
| `<mb-table :columns :data>` | `cols` + `url` 自动加载 |
| 路径前加 `/api` | 直接写路径（前端自动加 baseApi） |
| `<script setup>` 里 `import { xxx } from 'vue'` 之外的裸全局依赖 | 全局对象（`$common`/`$global`/`$message`）由运行时注入，直接可用 |

## 菜单 SQL 规则

- 文件：`src/sql/menu/{父中文名}-{子中文名}.sql`（**全中文文件名**，禁止混英文）
- 菜单树几层就生成几层 INSERT（顶级 pid 按 ui.md；子菜单 pid 用 `nameToUuid(父菜单name)` 或包装子查询 `(SELECT id FROM (SELECT id FROM sys_menu WHERE name='{parent}' AND is_del=0 LIMIT 1) AS _t)`，**禁止硬编码随机 UUID**）
- 菜单中文名与 ui.md 菜单树**完全一致**（不缩写）
- 首页 `/home` 已在系统表，不生成
- 详细字段：`knowledge/gewumind-boot/05-menu-register.md`

## 字典 SQL 规则

- 对 database.md 字典清单**每个键**生成一条 `sys_dict`（type 行）+ `sys_dict_items`（枚举行）INSERT → `src/sql/dict/{键名}.sql`
- 字典键 = DDL 注释里 `dict:` 引用的键，两边必须一致
- `sys_dict_items` 在 UPSERT 表里，可重复发布
- 详细格式：`knowledge/gewumind-boot/13-data-dictionary.md`

## magic-script 文件布局（工作区）

```
src/magic-api/
├── api/设备管理/
│   ├── group.json              # {name, path, parentId, type, id, paths, options}（IDE 记账用；REST 发布时后端会自动建）
│   ├── 设备列表/
│   │   ├── group.json
│   │   ├── 列表.ms
│   │   └── 保存.ms
│   └── MQTT回调/
│       └── 心跳上报.ms
├── function/组织服务/
│   └── 获取当前用户组织机构.ms
└── task/监控任务/
    └── 心跳检查.ms
```

- `.ms` 工作区格式 = meta JSON 头 + 换行 + 32 个 `=` 分隔线 + 脚本体（与后端落盘格式一致）
- 目录名 = 中文组名（可嵌套）；`.ms` 文件名 = 中文名（`列表.ms`）
- **REST/MCP 发布时 agent 直接传 MsScript 字段即可，不必依赖 group.json**（后端自动建组）
- 完整 URL = 各级 group path 拼接 + 脚本 path（如 `/device/list`）
