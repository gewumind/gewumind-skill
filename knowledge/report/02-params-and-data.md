# params + 后端接口契约

## params 完整字段类型

```ts
type ParamType =
    | 'input' | 'text'                  // n-input
    | 'number' | 'input-number'          // n-input-number
    | 'number-range'                     // 两个 n-input-number 中间带 —
    | 'select' | 'select-multi' | 'multi-select'
    | 'autocomplete'                     // n-auto-complete（联想）
    | 'cascader'                         // n-cascader（树形）
    | 'date'                             // yyyy-MM-dd
    | 'month'                            // yyyy-MM
    | 'time'                             // HH:mm:ss

interface ParamDef {
    field:        string                  // 必填。提交到后端 body 的 key
    label:        string                  // 显示标签
    type:         ParamType               // 必填
    placeholder?: string
    default?:     any                     // 初始值
    hidden?:      boolean                 // 不渲染但保留值
    width?:       number                  // 输入控件宽度 (px)

    // 数字类
    min?:         number
    max?:         number
    precision?:   number
    minLabel?:    string
    maxLabel?:    string

    // select 类选项（三选一）
    options?:     { label, value }[]      // 静态数组
    dict?:        string                  // 系统字典 code（对应 /system/dict/dict-items?type=...）
    optionsApi?:  string | {              // 自定义接口
        url: string
        method?: 'GET' | 'POST'
        params?: Record<string, any>      // '...dependents...<fieldName>' 是占位符
    }
    optionsApiParams?: Record<string, any>
    filterable?:  boolean                 // select 可输入过滤

    // 联动：当前 param 修改时清空其它 param 的值 + 选项
    dependents?:  { field: string }[]
}
```

### 类型示例

```js
const params = [
    // 1) 文本输入
    { field: 'remark',    label: '关键字', type: 'input',     placeholder: '模糊查询', width: 160 },

    // 2) 数字（含范围）
    { field: 'amount',    label: '金额',   type: 'number',    min: 0, precision: 2, width: 140 },
    { field: 'amountRange', label: '区间', type: 'number-range', minLabel: '低', maxLabel: '高' },

    // 3) 日期
    { field: 'month',     label: '月份',   type: 'month',     default: '2026-07' },
    { field: 'startDate', label: '起',     type: 'date' },
    { field: 'endDate',   label: '止',     type: 'date' },

    // 4) 选择
    { field: 'status',    label: '状态',   type: 'select',
      options: [{label:'草稿',value:'DRAFT'}, {label:'已通过',value:'APPROVED'}] },
    { field: 'status',    label: '状态',   type: 'select',   dict: 'wf_status' },
    { field: 'dept',      label: '部门',   type: 'select',
      optionsApi: '/data/system/dept-list' },

    // 5) 多选
    { field: 'tags',      label: '标签',   type: 'select-multi',
      options: [{label:'A',value:'a'},{label:'B',value:'b'}], filterable: true },

    // 6) 联想 / 级联
    { field: 'customer',  label: '客户',   type: 'autocomplete',
      optionsApi: '/data/system/search-customers' },
    { field: 'city',      label: '所在城市', type: 'cascader',
      optionsApi: '/data/system/city-tree' },

    // 7) 联动
    { field: 'dept',      label: '部门',   type: 'select',
      optionsApi: '/data/system/dept-list',
      dependents: [{field: 'employee'}] },
    { field: 'employee',  label: '员工',   type: 'select',
      optionsApi: { url: '/data/system/emp-list', method: 'POST',
                    params: { dept: '...dependents...dept' } } }
]
```

### 联动 dependents tokens

`'...dependents...<field>'` 会被解析为该 param 当前值，请求前替换：

```js
optionsApi: {
    url: '/data/system/emp-list',
    params: { dept: '...dependents...dept' }   // → request body: {dept: '<dept 当前选中的值>'}
}
```

## 后端接口契约

### 文件位置与 groupId

```
backend/data/magic-api/api/数据演示/6报表操作/<name>.ms
backend/data/magic-api/api/数据演示/6报表操作/group.json
```

`group.json` 已存在（`id: 'rpt-op-group-001'`, `path: '/report-op'`）。新 `.ms` 直接放同目录下。

### `.ms` 文件结构

```jsonc
{
  "properties" : {},
  "id"      : "rpt-<name>-api-001",
  "script"  : null,
  "groupId" : "rpt-op-group-001",
  "name"    : "<中文名>",
  "description" : "<说明>",
  "path"    : "/<name>",
  "method"  : "POST",
  "parameters" : [],
  "options"    : [],
  "requestBody"  : "",
  "responseBody" : null
}
================================
// magic-script。返回**纯数据**（数组或对象）
return db.select("SELECT * FROM t_profit WHERE month = #{month}")
```

### ID 命名规则

`.ms` 文件的 `id` 字段：`rpt-<name>-api-001`，例如 `rpt-profit-api-001`。

### 完整 POST 入口 URL

`<group.path><api.path>` = `/report-op/<name>`

前端 `entryApi="/data/report-op/<name>"`，axios 会自动加 `VITE_APP_BASE_API`（默认 `/api`）。

### 返回值约束

- 只能 `return <纯数组>` 或 `return <纯对象>`，**不要写** `{code, data, message, success}` 包装
- 字段名（key）必须能被前端 `columns[].key` 直接消费
- `null` / `undefined` / 空字符串都正常处理

### 标准查询 .ms 模板

```js
================================
// 必传参数 + 模糊查询
var month  = body.month
var remark = body.remark

var sql = "SELECT * FROM t_profit WHERE 1=1"
if (month != null && month != '') {
    sql += " AND month = #{month}"
}
if (remark != null && remark != '') {
    sql += " AND remark LIKE #{'%' + remark + '%'}"
}
sql += " ORDER BY month DESC, item ASC"

return db.select(sql)
```

### demo / 静态数据 .ms 模板

```js
================================
var month = (body == null) ? null : body.month
if (month == null || month == '') { month = '2026-07'; }
return [
    { item: '一、营业收入', revNow: 1200000, costNow: 800000 },
    ...
]
```

### 动态 optionsApi 后端 .ms 模板

API 返回 `{label, value}` 数组（cascader 多一个 `children`）。

```js
================================
return db.select("SELECT id AS value, name AS label FROM sys_dept WHERE is_del = 0 ORDER BY sort")
```

## 现有 demo 后端列表

`api/数据演示/6报表操作/` 内现有 19 个 demo `.ms` 文件，覆盖各种报表 pattern：

| 文件                          | 演示的能力                                |
| ----------------------------- | ---------------------------------------- |
| `profit.ms`                   | 基础清单报表                              |
| `profit-zh-grid.ms`           | 中国式复杂表头（合并单元格）              |
| `cross.ms`                    | 交叉表（行 × 列矩阵）                    |
| `cross-row-expand.ms`         | 动态列头                                  |
| `sales-monthly.ms`            | 月报 + 同比                               |
| `sales-monthly-merge.ms`      | 跨行合并                                  |
| `grouped-report.ms`           | 明细带汇总（groupBy）                     |
| `conditional-format.ms`       | 条件格式                                  |
| `inventory.ms`                | 库存清单                                  |
| `inventory-detail.ms`         | 库存明细（嵌套子表）                      |
| `inventory-filter.ms`         | 多层筛选                                  |
| `suppliers.ms` / `supplier-detail.ms` | 主数据 + 关联表                    |
| `supplier-tabs.ms`            | 多 Sheet                                  |
| `balance-sheet.ms`            | 行类型（section / subtotal / grand）       |
| `budget-exec.ms`              | 预算执行（条件颜色 + 红黄绿）             |
| `dept-sales.ms`               | 部门销售（明细带汇总）                    |
| `cross-region-product.ms`    | 跨区域产品销售                            |
| `employee-salary.ms`          | 员工工资（部门跨行合并）                  |
| `sales-trend.ms`              | 产品销售趋势（动态多列）                  |
```

LLM 在生成新报表前先看这 19 个文件，挑最接近的 demo 复制再修改即可。

## 对应演示文件

- `6报表操作/6.1利润表.ms` — 报表：按月查询利润
- `6报表操作/6.2月销售报表.ms` — 报表：按月/区域查询销售
- `6报表操作/6.3库存报表.ms` — 报表：按仓库/关键字/分类查询库存
- `6报表操作/6.4库存明细.ms` — 报表：按编码查询库存明细
- `6报表操作/6.5供应商列表.ms` — 报表：按月查询供应商列表
- `6报表操作/6.6供应商详情.ms` — 报表：按ID查询供应商详情
- `6报表操作/6.7资产负债表.ms` — 报表：静态资产负债表
- `6报表操作/6.8预算执行.ms` — 报表：项目预算与执行统计
- `6报表操作/6.9部门销售.ms` — 报表：按公司/部门查询销售
- `6报表操作/6.10跨区域产品销售.ms` — 报表：按月查询跨区销售
- `6报表操作/6.11员工工资.ms` — 报表：员工工资明细
- `6报表操作/6.12销售趋势.ms` — 报表：全年12个月销售趋势
