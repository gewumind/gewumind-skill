## mb-editor-table 可编辑表格

在 `mb-table` 基础上加单元格编辑能力：点击单元格激活编辑、blur 退出、可嵌入任意 mb-* 组件、支持树形增删。

源文件：`src/components/magic/data/mb-editor-table.vue`

### Props

| Prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `cols` | Array | `[]` | 列定义（详见下） |
| `id` | String | `''` | 表格 ID |
| `props` | Object | `{}` | 透传给 `mb-table` |
| `showNo` | Boolean | `true` | 是否显示序号列 |
| `page` | Boolean | `false` | 是否分页（编辑表格通常 false） |
| `rowKey` | String | `'id'` | 行唯一键 |
| `preview` | Boolean | `false` | 预览模式（禁用编辑） |
| `rowHoverEdit` | Boolean | `true` | 行 hover 时显示编辑虚线框 |
| `keepCurrentPage` | Boolean | `true` | 切换查询条件时保留当前页 |
| `summary` | Object | - | 合计（同 mb-table） |
| `operation` | Object | - | 操作列配置（删除、添加下级、添加同级） |
| `operationWidth` | Number | `85` | 操作列宽度 |
| `onSelectedRow` | Function | `() => {}` | 选中行回调 |

### 列定义 cols[]（mb-editor-table 扩展）

相比 mb-table 的 cols 多了几个字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `component` | String | 编辑模式下的组件名（`select` / `input` / `date` / `textarea` / `tree-select` / 自定义 slot 名 `#xxx`） |
| `componentProps` | Object | 透传给编辑组件 |
| `componentStyle` | Object | 组件 inline 样式（textarea 初始化时会自动定位） |
| `componentDynamicBind` | Function | `(row, col) => bind`，动态绑定 props |
| `alwaysEdit` | Boolean | 一直保持编辑模式（不需要点击激活） |
| `edit` | Boolean/Function | `(row) => bool`，此行此列是否可编辑 |
| `handlerComponentProps` | Function | `(bind, row) => void`，修改 bind |
| `blur` | Function | `(row) => void`，失焦回调 |
| `if` | Function | `(row) => bool`，条件显示 |
| `showLabel` | Object/Function | `{ data, valueField, labelField }` 反显字典标签 |
| `show` | Function | `(row) => bool`，显示控制 |
| `labelStyle` | Object | 文本模式样式 |
| `exportRender` | Function | 导出时的渲染函数 |

### operation 操作列

```js
operation: {
  delete: true,              // boolean 或 { if: (row) => ..., confirm: true }
  sub: true,                 // boolean 或 { if: (row) => ... }
  same: true,                // boolean 或 { if: (row) => ... }
  deleteAfter: () => {},     // 删除后回调
  buttons: [                 // 额外按钮（同 mb-table 操作列）
    { label: '查看', link: true, icon: 'Search', click: (row) => {} }
  ]
}
```

自动生成的按钮：
- **删除** icon=`Delete24Regular`，删除本行+子节点
- **添加下级** icon=`sub-level`，给当前行加 children
- **添加同级** icon=`same-level`，给父级加兄弟

### 完整示例（树形可编辑）

```vue
<mb-editor-table
  ref="magicTable"
  :cols="cols"
  :operation="{ delete: { confirm: true }, sub: true, same: true }"
  @selected-row="row => currentRow = row"
/>
```

```js
const cols = [
  { field: 'name', label: '名称', component: 'input',
    componentProps: { placeholder: '请输入名称' },
    rules: { required: true, message: '必填', trigger: ['blur'] } },
  { field: 'code', label: '编码', component: 'input', alwaysEdit: true },
  { field: 'type', label: '类型', component: 'select',
    componentProps: { options: [{ value: '1', label: '菜单' }, { value: '2', label: '按钮' }] } },
  { field: 'status', label: '状态', component: 'switch',
    componentProps: { checkedValue: '1', uncheckedValue: '0' } },
  { field: 'description', label: '描述', component: 'textarea' }
]
```

### 编辑模式

- **点击激活**：默认行 hover 显示虚线框，点击单元格进入编辑态
- **alwaysEdit**：始终保持编辑态（如状态字段）
- **edit(row) 函数**：动态控制某行某列是否可编辑
- **失焦自动退出**：编辑组件 `blur` 事件自动触发 `componentBlur` 退出编辑
- **滚动自动退出**：滚动时 textarea 自动退出（避免错位）

### 暴露方法（ref）

```js
const tableRef = ref()

// 数据
tableRef.value.getData()        // 当前编辑数据（去掉内部 _index_ 字段）
tableRef.value.setData(data)    // 设置数据（自动加 _index_）
tableRef.value.push(data)       // 追加一行
tableRef.value.unshift(data)    // 顶部插入

// 模式切换
tableRef.value.editMode(rowIndex, colIndex, col, row)   // 激活编辑
tableRef.value.previewMode(rowIndex, colIndex)            // 退出编辑
tableRef.value.closeCurrentColEditMode()                  // 关闭当前编辑
tableRef.value.getTableRef()                             // 拿到 mb-table 引用

// 事件回调控制
tableRef.value.disableComponentCallback(['field1', 'field2'])  // 禁用某些字段的回调
tableRef.value.enableComponentCallback(['field1'])              // 恢复回调
```

### 内部机制

- 数据用 `_index_` 字段标记位置（递归遍历所有层级），处理 naive-ui 树形表格 index 不含子级的问题
- 编辑态用 `edits[rowIndex + '' + colIndex] = true/false` 维护
- `componentDynamicBind` 可以根据行数据动态调整组件 props（如 select 的 options 跟随父节点）
- 事件回调的 `data` 参数会被装饰为 `{ editorCurrentRow: row, ...原始参数 }`

### 与 mb-table 区别

| 维度 | mb-table | mb-editor-table |
|---|---|---|
| 单元格编辑 | ❌ 只读 | ✅ 点击激活 / alwaysEdit |
| 操作列 | 自定义 buttons | 内置 删除/添加下级/添加同级 + 自定义 |
| 数据操作 | reload | getData/setData/push/unshift |
| 树形增删 | ❌ | ✅ |
| 行数 | 大数据虚拟滚动 | 适合中小数据（树形 CRUD） |
