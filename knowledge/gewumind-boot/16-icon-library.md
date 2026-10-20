## 图标库（sys_menu.icon / mb-icon）

gewumind-boot 集成两套图标：naive-ui `vicons`（PascalCase）+ gewumind-boot 自定义 svg（kebab-case）。**写菜单/按钮/tab 时必先调 `listIcons`**，不能凭空想图标名。

> **新建菜单的 `icon` 是必填项**：空 icon 视为不合格。生成菜单 SQL 后逐条校验，空的话从下面的可用图标里补。

---

### 调用工具

**`listIcons()`** — 返回所有可用图标，按场景分类：

```json
{
  "xicons": {
    "通用操作": ["AddOutline", "Close", "Checkmark", "Menu", "Search"],
    "编辑": ["CreateOutline", "SaveSharp", "CopyOutline", "EditOutline"],
    "删除/禁用": ["TrashOutline", "RemoveOutline"],
    "数据": ["DownloadOutline", "CloudUploadOutline", "Folder", "FolderOpenOutline"],
    "导航": ["ChevronDown", "CaretUpOutline", "CaretDownOutline", "ArrowDownOutline",
             "ArrowSort16Filled", "ArrowSortUp16Filled", "ArrowSortDown16Filled"],
    "业务": ["People", "SettingsSharp", "SettingsOutline", "Accessibility", "Camera"],
    "Filled 风格": ["Organization12Filled", "BookLetter24Filled", "ContentSettings24Filled",
                "ClipboardCode24Filled", "Delete24Regular", "History24Filled"]
  },
  "svgIcons": {
    "业务模块": ["oper-log", "login-log", "log", "monitor", "configure", "database",
              "dict", "office", "role", "menu", "user", "interface", "examples",
              "home", "component"],
    "状态": ["eye", "eye-open", "fullscreen", "error", "same-level", "password"]
  }
}
```

---

### 使用场景对照

| 场景 | 用什么 | 例子 |
|---|---|---|
| **菜单 `icon` 字段**（sys_menu 表） | 两种都行 | `icon='SettingsSharp'` / `icon='oper-log'` |
| **按钮 / 操作图标**（mb-search slot / 操作列） | `<mb-icon icon="..." />` | `<mb-icon icon="AddOutline" />` |
| **Tab 图标** | 同按钮 | `<n-tab-pane name="x" tab="..." ><mb-icon icon="..." />` |
| **空状态 / 404 / 错误页** | 大尺寸 + svgIcons | `<mb-icon icon="error" size="64" />` |

**判断标准**：
- 系统操作（加/删/查/改/导）→ xicons 的 PascalCase（`AddOutline` `TrashOutline` `DownloadOutline`）
- 业务模块（用户/角色/菜单/配置/日志）→ svgIcons 的 kebab-case（`user` `role` `oper-log`）

---

### 标准模式：菜单 + 按钮完整 icon 设计

**用户对话**： "加个产品管理的菜单和详情页"

**AI 完整工作流**：

1. `listIcons()` — 查可用图标
2. AI 选：
   - 菜单 icon → `icon='oper-log'` 不对（那是日志的），应该 `icon='examples'` 或 `icon='component'`（更通用）
   - **正确**：菜单 icon 用 svgIcons 的 kebab-case 业务模块：`icon='home'` / `icon='examples'` / `icon='component'` / `icon='user'` / `icon='role'`
3. 写菜单 SQL：
   ```sql
   INSERT INTO sys_menu (id, pid, name, component_id, icon, open_mode, ...)
   VALUES (..., '产品管理', ..., 'home', 0, ...)
   ```
4. 按钮 icon → 用 xicons 的 PascalCase（系统操作）：
   ```vue
   <mb-search>
     <template #buttons>
       <n-button @click="onAdd">
         <mb-icon icon="AddOutline" /> 新增
       </n-button>
       <n-button @click="onExport">
         <mb-icon icon="DownloadOutline" /> 导出
       </n-button>
     </template>
   </mb-search>
   <mb-table :cols="[
     { field: 'name', label: '名称' },
     { field: 'status', label: '状态', dictType: 'status' },
     { label: '操作', type: 'buttons', buttons: [
       { label: '编辑', icon: 'CreateOutline', click: row => onEdit(row) },
       { label: '删除', icon: 'TrashOutline', click: row => onDelete(row) }
     ]}
   ]" />
   ```

---

### 菜单 icon 推荐表（按业务模块）

| 菜单名 | 推荐 icon | 类别 |
|---|---|---|
| 用户管理 | `user` / `People` | svgIcons / xicons 都行 |
| 角色管理 | `role` / `Accessibility` | svgIcons / xicons |
| 菜单管理 | `menu` / `Menu` | 同样 |
| 组织机构 | `office` / `Organization12Filled` | |
| 数据字典 | `dict` / `BookLetter24Filled` | |
| 配置中心 | `configure` / `ContentSettings24Filled` | |
| 操作日志 | `oper-log` / `History24Filled` | |
| 登录日志 | `login-log` / `History24Filled` | |
| 系统监控 | `monitor` / `Camera` | |
| 在线用户 | `user` | |
| Druid 监控 | `database` | |
| 数据源 | `database` | |
| 代码生成 | `examples` | |
| 组件管理 | `component` | |
| 接口管理 | `interface` | |
| 备份恢复 | `fullscreen` | |
| 系统设置 | `SettingsSharp` / `SettingsOutline` | |
| 系统管理（顶级菜单） | `SettingsSharp` | |

---

### 按钮 / 操作 icon 推荐表

| 操作 | icon | 备注 |
|---|---|---|
| 新增 | `AddOutline` | 加号 |
| 删除 | `TrashOutline` | 垃圾桶 |
| 批量删除 | `TrashOutline` + "批量" | |
| 编辑 / 修改 | `CreateOutline` | 笔 |
| 详情 / 查看 | `eye-open` / `eye` | 眼睛 |
| 导出 | `DownloadOutline` | 下载 |
| 导入 | `CloudUploadOutline` | 上传 |
| 复制 | `CopyOutline` | |
| 保存 | `SaveSharp` | |
| 取消 | `Close` | X |
| 确认 | `Checkmark` | ✓ |
| 搜索 | `Search` | 放大镜 |
| 排序 | `ArrowSortUp16Filled` / `ArrowSortDown16Filled` / `ArrowSort16Filled` | |
| 展开/收起 | `ChevronDown` / `CaretUpOutline` | |
| 配置 / 设置 | `SettingsOutline` | 齿轮 |
| 启用 | `Checkmark` | |
| 禁用 | `Close` | |
| 导出 Excel | `DownloadOutline` + 文件名 | 跟导出功能配套 |

---

### 完整 demo：菜单 + 列表 + 操作列

```vue
<template>
  <div class="mb-list">
    <div class="mb-search">
      <mb-search :where="tableOptions.where" @search="reloadTable">
        <template #buttons>
          <n-button type="primary" @click="onAdd">
            <mb-icon icon="AddOutline" /> 新增
          </n-button>
          <n-button @click="onExport">
            <mb-icon icon="DownloadOutline" /> 导出
          </n-button>
        </template>
      </mb-search>
    </div>
    <div class="mb-table">
      <mb-table ref="table" v-bind="tableOptions" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
const table = ref()
const tableOptions = reactive({
  id: 'pro_product',
  url: '/product/list',
  cols: [
    { field: 'name', label: '产品名' },
    { field: 'category', label: '分类', dictType: 'hat_type' },
    { field: 'status', label: '状态', dictType: 'status', width: 80 },
    {
      label: '操作', type: 'buttons', width: 220, fixed: 'right',
      buttons: [
        { label: '编辑', icon: 'CreateOutline', permission: 'product:save',
          click: row => onEdit(row) },
        { label: '删除', icon: 'TrashOutline', permission: 'product:delete',
          click: row => onDelete(row) },
        { label: '详情', icon: 'eye-open',
          click: row => onDetail(row) }
      ]
    }
  ]
})
</script>
```

```sql
-- 菜单 SQL 里的 icon 字段
INSERT INTO sys_menu (..., name, icon, open_mode, ...)
VALUES (..., '产品管理', 'home', 0, ...)
```

---

### AI 工具调用清单

| 工具 | 用途 | 何时调 |
|---|---|---|
| `listIcons()` | 查所有可用图标 | 写菜单/按钮前必先调 |
| `listIcons(category='业务模块')` | 查某分类 | 知道大概分类时 |
| `generateMenuSql(... icon='home')` | 写菜单带 icon | 上面"标准模式" |
| `.vue` 里 `<mb-icon icon="...">` | 按钮/tab icon | 跟 mb-table / mb-form 一起写 |

**记住**：写菜单 SQL 时 `icon` 字段必传，从 `listIcons()` 结果里选。**不要凭空写** `icon='UserIcon'` 这种不存在的图标名 —— 前端 `<mb-icon>` 会渲染成空方块。
