## mb-table 列表组件

基于 naive-ui `n-data-table` 封装，集成排序、列宽调整、列拖拽、字典翻译、合计、右键菜单、虚拟滚动、键盘导航、Excel 导出等。

源文件：`src/components/magic/data/mb-table.vue` + `mb-table-column.vue`

### Props

| Prop | 类型 | 默认 | 说明 |
|---|---|---|---|
| `url` | String | `''` | 列表数据接口（`$common.request(method)(url, where)`） |
| `method` | String | `'post'` | HTTP 方法 |
| `where` | Object | `{}` | 查询条件，传给接口；支持 `mb-search` 自动绑定 |
| `data` | Array | `null` | 静态数据（无 `url` 时使用） |
| `cols` | Array | `[]` | 列定义（见下方） |
| `id` | String | `''` | 表格 ID（用于记忆列宽、分页大小） |
| `rowKey` | String | `'id'` | 行唯一键 |
| `page` | Boolean | `true` | 是否分页 |
| `limit` | Number | `10` | 默认每页条数 |
| `showNo` | Boolean | `true` | 是否显示序号列 |
| `selection` | Boolean | `false` | 是否显示多选列（带全选/全不选/反选菜单） |
| `striped` | Boolean | `true` | 斑马纹 |
| `nowrap` | Boolean | `undefined` | 单元格不换行 |
| `virtualScroll` | Boolean | `false` | 虚拟滚动 |
| `defaultColWidth` | Number | `100` | 列默认宽度（px） |
| `loading` | Boolean | `true` | 加载状态 |
| `selectedRowEnable` | Boolean | `true` | 点击行选中 |
| `defaultSelectedRow` | Boolean | `false` | 默认选中第一行 |
| `keepCurrentPage` | Boolean | `false` | 切换查询条件时保留当前页 |
| `contextmenuEnable` | Boolean | `false` | 启用右键菜单 |
| `summary` | Object | `undefined` | 合计行配置（见下方） |
| `done` | Function | `() => {}` | 数据加载完成回调（`done(data)`） |
| `props` | Object | `{}` | 透传给 `n-data-table` |
| `onContextmenu` | Function | `() => {}` | 右键菜单事件 |
| `onContextmenuSelect` | Function | `() => {}` | 右键菜单选择 |
| `onDblclick` | Function | `() => {}` | 双击行事件 |
| `onDynamicSettingContextmenu` | Function | `() => []` | 动态右键菜单项 |

### 列定义 cols[]

| 字段 | 类型 | 说明 |
|---|---|---|
| `field` | String | 字段名（必填） |
| `label` | String | 列标题 |
| `width` | Number/String | 列宽（px 或百分比 `'20%'`） |
| `minWidth` | Number | 最小宽度 |
| `type` | String | 列类型：`text`(默认) / `html` / `templet` / `buttons` / `dictType` / `image` / `download` / `switch` / `dynamic`(自定义 slot) |
| `dictType` | String | 字典类型（`type='dictType'` 时使用，自动翻译） |
| `templet` | Function | `(row, col, index) => string`（`type='templet'`） |
| `render` | Function | 自定义渲染函数（覆盖 type） |
| `buttons` | Array | 操作列按钮（`type='buttons'`） |
| `sort` | Boolean | 是否可排序 |
| `realSort` | Boolean | 是否走后台排序（`where.orderByColumn/direction`） |
| `dataSortRule` | Boolean | 前端排序状态（true=asc / false=desc） |
| `realSortRule` | String | 后台排序状态（'0'=asc / '1'=desc） |
| `fixed` | String/Boolean | `'left'` / `'right'` / `false` |
| `permission` | String | 权限码（无权限不显示） |
| `if` | Function | `(row) => bool`，条件显示 |
| `titleTooltip` | String/Object | 标题悬浮提示 |
| `editIcon` | Boolean | 显示编辑图标 |
| `copyText` | Boolean | 单元格复制按钮 |
| `copyAll` | Boolean | 列复制全部（结合 `copyAllCallback`） |
| `defaultValue` | String | 字段为空时的占位 |
| `summary` | Boolean/Object | 是否计入合计行 |
| `align` | String | 对齐：`left` / `center` / `right` |
| `props` | Object | 透传列属性 |

### 操作列 buttons[]

```js
{
  label: '编辑',
  link: true,            // 显示为链接样式
  icon: 'EditFilled',    // icon 名（xicons）
  type: 'primary',       // 按钮类型
  permission: 'user:edit', // 权限码
  if: (row) => row.is_del == 0, // 条件显示
  click: (row) => { /* ... */ }
}
```

### 合计行 summary

```js
// 全局合计（前端计算）
{
  url: '/api/summary',  // 或 data 静态
  method: 'post',
  data: { /* 静态数据 */ }
}

// 列级合计（按列自动 sum）
{ field: 'amount', summary: true }
{ field: 'amount', summary: { prefix: '￥', suffix: '', handlerTotal: (v) => v.toFixed(2) } }
```

### Events

| Event | 参数 | 说明 |
|---|---|---|
| `update:checked-row-keys` | `keys: string[]` | 选中行的 rowKey 列表 |
| `update:checked-row-datas` | `rows: object[]` | 选中行的完整数据 |
| `selected-row` | `row: object` | 点击行时（`selectedRowEnable`） |

### 暴露方法（ref）

```js
const tableRef = ref()
tableRef.value.reload({ reload: true, keepCurrentPage: false, page: 1, notClearChecked: false })
tableRef.value.exportExcel({ fileName: '用户列表.xlsx' })
tableRef.value.expand()         // 展开所有树节点
tableRef.value.toggleExpand()   // 切换展开
tableRef.value.expandByKeys(['id1', 'id2'])
tableRef.value.getData()        // 当前页数据
```

### 完整示例

```vue
<mb-table
  ref="tableRef"
  id="user-table"
  url="/sys/user/list"
  method="post"
  :where="where"
  :cols="cols"
  :page="true"
  :selection="true"
  :summary="{ url: '/sys/user/summary' }"
  @update:checked-row-keys="keys => selectedKeys = keys"
  @selected-row="row => selectedRow = row"
  :done="data => console.log('loaded', data)"
/>
```

```js
const where = {
  username: { label: '账号', component: 'input' },
  status:   { label: '状态', component: 'select',
              componentProps: { options: [{value:'1',label:'启用'},{value:'0',label:'禁用'}] } },
  createDate: { label: '日期', component: 'date' }
}
const cols = [
  { field: 'username', label: '账号', width: 120 },
  { field: 'name', label: '姓名', width: 100 },
  { field: 'status', label: '状态', dictType: 'status', width: 80 },
  { field: 'amount', label: '金额', summary: true, align: 'right' },
  { label: '操作', type: 'buttons', width: 180, fixed: 'right', buttons: [
    { label: '编辑', link: true, icon: 'EditFilled', permission: 'user:edit', click: edit },
    { label: '删除', link: true, icon: 'Delete24Regular', permission: 'user:del', click: del }
  ]}
]
```

## ⚠️ 实测补充（行为契约）

| 事项 | 实际行为 |
|---|---|
| 列 `render` 返回值 | 可返回字符串或 **VNode**（需 `import { h } from 'vue'`）。返回 VNode 才能绑定点击事件（做「打开弹窗」等交互） |
| 导出优先级 | `exportRender(row) > render(row) > row[field]`。`render` 返回 VNode 时若未提供 `exportRender`，导出会拿到不可序列化的对象 |
| `nowrap` | 全局默认可能为 `true`，长文本列（备注/附件）需显式 `:nowrap="false"` 并配 `white-space: normal` |
| `showNo` | **默认 true**，报表类页面要显式 `showNo: false` 去掉序号列 |
| `limit` | 默认 10，报表/明细类建议显式设 100 |
| 图片类列 | `type: 'image'` 在表格里直接铺缩略图。**数据量大时建议改成「有 N 项」+ 点击弹窗预览**，既美观也避免表格被撑高 |
| 确认弹窗 | 平台删除统一用 `$common.handleDelete({ url, id, done })`，内部是 `n-dialog`（naive-ui），**不是 layui layer**，自动化脚本里别找 `.layui-layer-btn0` |

### 「有 N 张」+ 弹窗预览的推荐写法

```vue
// 1) 列定义：只显示数量，点击打开弹窗
{
  field: 'fileUrls', label: '附件', width: 110,
  render: (row) => {
    const urls = String(row.fileUrls || '').split(',').filter(Boolean)
    if (!urls.length) return '—'
    return h('a', { class: 'link', onClick: (e) => { e.stopPropagation(); openPreview(urls) } },
              `有 ${urls.length} 项`)
  },
  exportRender: (row) => String(row.fileUrls || '')   // 导出原始地址，而不是「有 N 项」
}
```

```vue
<!-- 2) 弹窗：大图 + 缩略图列表 -->
<mb-modal ref="previewDialog" :title="previewTitle" width="900px" :show-footer="false">
  <a v-if="previewUrl" :href="previewUrl" target="_blank"><img :src="previewUrl" class="preview-img" /></a>
  <img v-for="(u,i) in previewUrls" :key="i" :src="u" class="preview-thumb"
       :class="{active:u===previewUrl}" @click="previewUrl = u" />
</mb-modal>
```

> 文件失效（磁盘丢失）时用 `@error` 换成占位图，避免出现裂图图标。
