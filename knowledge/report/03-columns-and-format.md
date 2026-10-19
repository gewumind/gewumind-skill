# columns 与数据格式化

`columns` 数组中每项是一列的定义，MagicReport 用它构造 `<n-data-table>`。完整的列能力 = "基础显示" + "格式化" + "标签着色" + "底纹着色" + "跨行合并" + "复杂表头（children）"。

## 完整字段

```ts
interface ColumnDef {
    key:        string                  // 数据字段名（与后端 rows[i] 的属性对应）
    title:      string                  // 列头
    width?:     number
    align?:     'left' | 'center' | 'right'      // 默认 left
    fixed?:     'left' | 'right'        // 列冻结
    ellipsis?:  boolean                 // 文本过长省略号 + tooltip

    // 排序（n-data-table sorter）
    sorter?:    false | ((a, b) => number)

    // 格式化
    format?:    'money' | 'number' | 'percent' | string
    // money  → "¥" + 千分位
    // number → 千分位
    // percent→ (0.93) → "93.00%"

    // 单元格底纹 / 文字颜色
    cellStyle?: (value, row, idx) => CSSStyle
    // 整行底纹（用 rowClassName prop）
    rowClassName?: (row) => string

    // tag 着色
    tagMap?:    Record<string, 'default' | 'success' | 'warning' | 'error' | 'info'>
    labelMap?:  Record<string, string>     // 值 → 显示文本（与 tagMap 配合）

    // 完全自定义
    render?:    (row, rowIndex, allRows) => VNode

    // 跨行 / 跨列合并
    rowSpan?:   (row, rowIndex, allRows) => number   // 0 = 隐藏被合并的行
    colSpan?:   (row, rowIndex) => number

    // 列宽拖拽
    resizable?: boolean                   // 默认 true，false 关闭

    // 复杂表头
    children?:  ColumnDef[]

    // 单列汇总（可替代顶层 aggregates）
    _aggregate?: 'sum' | 'avg' | 'count' | 'min' | 'max' | 'skip'
}
```

## 典型用法

### 1. 基础列

```js
{ key: 'item', title: '项目', width: 200 }
```

### 2. 数字格式化

```js
{ key: 'revNow', title: '本期收入', width: 130, align: 'right', format: 'money' }
```

### 3. 标签着色

```js
{
    key: 'status', title: '状态',
    tagMap: { RUNNING: 'warning', DONE: 'success', FAIL: 'error' },
    labelMap: { RUNNING: '进行中', DONE: '已完成', FAIL: '失败' }
}
```

### 4. 单元格底纹 / 文字颜色

```js
{
    key: 'progress', title: '进度', format: 'percent',
    cellStyle: (v) => ({
        background: v >= 0.9 ? '#e8f5e9'
                  : v >= 0.5 ? '#fff8e1'
                  : '#ffebee',
        textAlign: 'center',
        fontWeight: 600
    })
}
```

### 5. 整行底纹

```vue
<template>
    <MagicReport :row-class-name="rowClassName" ... />
</template>

<script setup>
const rowClassName = (row) => {
    if (row.amount > 500000) return 'mr-row-critical'
    return ''
}
</script>

<style scoped>
:deep(.mr-row-critical td) { background: #fff5f5; }
</style>
```

### 6. 完全自定义 render

```js
import { h } from 'vue'
import { resolveComponent } from 'vue'

{
    key: 'name', title: '员工',
    render: (row) => h(resolveComponent('n-tag'),
        { type: 'info', size: 'small' },
        { default: () => row.name })
}
```

**注意**：用 `resolveComponent('n-tag')` 而**不是字符串 `'n-tag'`**——在 Vue 3.3 strict 模板里，字符串组件名需要在 setup 时 resolve。

### 7. 跨行合并（合并同部门的多行）

`rowSpan(row, rowIndex)` 不传 rows，要用闭包手动拿：

```js
import { ref } from 'vue'

const reportRows = ref([])

const columns = [
    {
        key: 'name', title: '员工',
        rowSpan: (row, rowIndex) => {
            // 与上一行同部门则隐藏
            if (rowIndex > 0 && reportRows.value[rowIndex - 1].dept === row.dept) return 0
            // 否则合并到下一个同部门截止
            let span = 1
            for (let i = rowIndex + 1; i < reportRows.value.length; i++) {
                if (reportRows.value[i].dept !== row.dept) break
                span++
            }
            return span
        }
    },
    { key: 'dept', title: '部门' },
    { key: 'salary', title: '工资', format: 'money' }
]
```

### 8. 复杂表头（中国式合并单元格）

```js
const columns = [
    { key: 'item', title: '项目', width: 180 },
    {
        title: '2026 年',
        children: [
            { key: 'revNow', title: '本期收入', width: 130, format: 'money' },
            { key: 'costNow', title: '本期成本', width: 130, format: 'money' },
            { key: 'profit', title: '毛利', width: 130, format: 'money',
              cellStyle: (v) => ({background: v > 0 ? '#e8f5e9' : '#ffebee'}) }
        ]
    },
    {
        title: '2025 年同期',
        children: [
            { key: 'revPrev', title: '收入', width: 130, format: 'money' },
            { key: 'costPrev', title: '成本', width: 130, format: 'money' },
            { key: 'profitPrev', title: '毛利', width: 130, format: 'money' }
        ]
    }
]
```

效果：
```
┌────────┬─────────────────────────┬──────────────────────┐
│ 项目   │      2026 年             │   2025 年同期         │
│        ├─────────┬───────┬───────┼────────┬───────┬────────┤
│        │ 本期收入 │ 本期成本 │ 毛利 │ 收入     │ 成本     │ 毛利 │
├────────┼─────────┼───────┼───────┼────────┴───────┴────────┤
│ 一、营业收入  │ 1,200,000 │ 800,000 │ 400,000 │ ...         │ 
...
```

### 9. 动态列头

后端返回 `{ months: ['2026-01', ..., '2026-12'] }` + `{ data: {...} }`，前端 columns 用 computed 拼：

```js
const months = ref([])
const cellData = ref({})

const columns = computed(() => {
    const cols = [{ key: 'product', title: '产品', fixed: 'left', width: 120 }]
    months.value.forEach(m => {
        cols.push({
            key: 'm_' + m,
            title: m,
            width: 100,
            align: 'right',
            render: (row) => row['m_' + m] || ''
        })
    })
    return cols
})
```

## 汇总 / 合计

两种方式（任选其一）：

```js
// 1) 顶层 aggregates（推荐）
const aggregates = [
    { key: 'revNow',  func: 'sum' },
    { key: 'costNow', func: 'avg' },
    { key: 'amount',  func: 'count' },
    { key: 'rate',    func: 'max' }
]

// 2) 列内 _aggregate（适合"只对少数列汇总"）
const columns = [
    { key: 'item',  title: '项目' },
    { key: 'rev',   title: '收入', format: 'money', _aggregate: 'sum' },
    { key: 'count', title: '笔数', _aggregate: 'count' }
]
```

支持的 func：`sum` / `avg` / `count` / `min` / `max` / `skip`（不显示）

## 排序控制

默认 `key` 字段会启用升序/降序切换。要关掉：

```js
{ key: 'remark', title: '备注', sorter: false }
```

自定义排序：

```js
{
    key: 'priority', title: '优先级',
    sorter: (a, b) => {
        const order = { high: 3, mid: 2, low: 1 }
        return (order[a.priority] || 0) - (order[b.priority] || 0)
    }
}
```

## 对应演示文件

- `6报表操作/6.1利润表.ms` — 基础列定义
- `6报表操作/6.2月销售报表.ms` — columns 格式化
- `6报表操作/6.9部门销售.ms` — 多级列头
- `6报表操作/6.12销售趋势.ms` — 12 个月列展示
