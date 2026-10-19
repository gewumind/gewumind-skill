# MagicReport props 速查

`MagicReport` 是 `frontend/src/components/report/MagicReport.vue`，对外只接收一组 props。

## 完整 props 表

```ts
interface Props {
    entryApi:    string                  // 必填。后端 magic-api 路径，如 '/data/report-op/profit'
    title?:      string                  // 报表标题（卡片头）
    subtitle?:   string                  // 副标题

    params:      ParamDef[]              // 查询条件字段数组
    columns:     ColumnDef[]             // 表格列定义数组
    aggregates?: AggregateDef[]         // 汇总行配置

    loadOptions?: boolean                // 默认 true。是否自动加载 param 中的 dict/optionsApi
    maxHeight?:   number | string        // 表格最大高度
    scrollX?:     number                 // 横向滚动阈值，默认 1200
    rowClassName?:(row) => string        // 给整行加 class（用于底纹）
    colsPerRow?:  number                 // 0=inline 模式；>0=grid 模式（每行 N 个字段）
    groupBy?:     string                 // 分组字段名（明细带汇总报表）

    exportMeta?: {                       // Excel 导出元数据
        title?:     string
        subtitle?:  string
        maker?:     string                // 制表人
        remark?:    string                // 备注
        total?:     boolean               // 是否加合计行
        date?:      string                // 制表日期
    }
}
```

## 最小可用 prop 组合

```vue
<MagicReport
    entryApi="/data/report-op/profit"
    :columns="[ {key:'item', title:'项目'}, ... ]"
/>
```

只需要这三个就能跑（无查询条件、表格按 columns 直接渲染）。

## 输入输出

```
POST entryApi (magic-api 自动加 token + baseURL)
body = params.values (form 字段)
↓
{
    "code": 200, "message": "success",
    "data": [ ...rows 或 {key: value} ],
    "timestamp": 1234, "executeTime": 5
}
↓
MagicReport 自动 unwrap: rows = res.data.data 或 res.data（兼容两种）
```

**关键**：
- 后端 `.ms` 脚本**直接返回** `return [...]` 或 `return {...}`，**不要**自己写 `{code, data}`
- 前端用 `Array.isArray(res.data) ? res.data : []` 兼容 magic-api 包过的 `res.data = {code, data: [...]}`

## event / slot

| 类型            | 名称              | 用途                                              |
| --------------- | ----------------- | ------------------------------------------------- |
| `event`         | `cell-click`      | `(cell, row, column, rowIndex, columnIndex)`     |
| `slot` (default) | —                 | 接 rows prop 引用（用于跨行合并等场景）           |
| `slot`          | `tabs`            | 在查询条和表格之间插入 tabs（多 Sheet 用）         |

## 反模式

- ❌ 不要把大量 `params.columns` 写进 MagicReport 外的 wrapper——直接传 props 即可
- ❌ 不要在 MagicReport 外层包 `n-card`（会重复 header）
- ❌ 不要在 params 里塞 `placeholder: 200` 这种类型混用

## 对应演示文件

- `6报表操作/6.1利润表.ms` — 基础报表：columns 定义、数据返回格式
- `6报表操作/6.2月销售报表.ms` — 带参数的报表：params 定义、月份/区域过滤
- `6报表操作/6.3库存报表.ms` — 多参数报表：仓库/关键字/分类筛选
