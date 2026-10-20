# 创建一张新报表的完整流程

## 步骤 1：放好后端 .ms 文件

```
backend/data/magic-api/api/数据演示/6报表操作/<name>.ms
```

`.ms` 文件内容 = 元数据 JSON 头 + `================================` 分隔 + magic-script 脚本。

```jsonc
{
  "properties" : {},
  "id"      : "rpt-<name>-api-001",
  "script"  : null,
  "groupId" : "rpt-op-group-001",
  "name"    : "<报表中文名>",
  "description" : "<一句话说明>",
  "path"    : "/<name>",
  "method"  : "POST"
}
================================
// 演示 / mock 数据
var month = (body == null) ? null : body.month
if (month == null || month == '') { month = '2026-07'; }
return [
    { item: '一、营业收入', revNow: 1200000, costNow: 800000 },
    { item: '二、营业成本', revNow: 800000,  costNow: 720000 },
    ...
]
```

或者真查数据库：

```js
================================
var month = body.month
var sql = "SELECT * FROM t_profit WHERE 1=1"
if (month != null && month != '') sql += " AND month = #{month}"
return db.select(sql)
```

**不要写** `{success, code, data}` 包装——交给 magic-api。

## 步骤 2：创建前端薄壳 page

```
frontend/src/views/report-demo/<name>.vue
```

```vue
<template>
    <MagicReport
        title="<报表标题>"
        subtitle="<副标题>"
        entryApi="/data/report-op/<name>"
        :params="params"
        :columns="columns"
        :aggregates="aggregates"
    />
</template>

<script setup>
import MagicReport from '@/components/report/MagicReport.vue'
import { ref } from 'vue'
import { resolveComponent } from 'vue'

const params = [
    { field: 'month', label: '月份', type: 'month', default: '2026-07' }
]

const columns = [
    { key: 'item',     title: '项目',     width: 200 },
    { key: 'revNow',   title: '本期收入', width: 130, align: 'right', format: 'money' }
]

const aggregates = [
    { key: 'revNow', func: 'sum' }
]
</script>
```

## 步骤 3：注册菜单

在 `backend/src/main/java/com/gewumind/boot/extension/WorkflowModule.java` 的 `initDemoMenus()` 中追加：

```java
jdbcTemplate.update(
    "INSERT INTO sys_menu (id, pid, name, url, sort, is_show, is_del, open_mode, keep_alive) " +
    "VALUES ('rpt-demo-<name>', 'rpt-demo-parent', '<报表显示名>', '/report-demo/<name>', <sort>, 1, 0, '0', 0)"
);
// 同时加进 oldMenus 数组，否则下次启动会清掉
```

`sort` 数字决定侧边栏顺序（95-110 之间已用：`rpt-demo-basic=97, zh-grid=98, expand=99, fixed=100, grouped=101, conditional=102, filter=103, supplier-tabs=104, merge=105`）。

还要在 `sys_role_menu` 初始化列表里加 `rpt-demo-<name>`，否则角色拿不到该菜单。

## 步骤 4：测试 / 验证

```
后端启动 → 进入「<name>」菜单 → 输入查询条件 → 看到表格 + 汇总
```

## AI 生成时的判断要点

**1) 数据源**

如果用户描述的是已有数据：
- 利润表/财务 → `t_profit` / `t_balance`
- 销售 → `t_order` / `t_sales_*`
- 库存 → `t_inventory`
- 人员 → `t_user` / `sys_user`

参考 `data-magic-api/api/数据演示/` 已有数据表。

如果用户只是想要演示：
- 用 `return [ {col1: ..., col2: ...}, ... ]` 直接返回 mock 数据
- 数据要有结构、有意义，让人看懂是什么

**2) 列设计**

- 数字金额列加 `format: 'money'`，右对齐 + 宽度 120+
- 百分比用 `format: 'percent'`，值范围 [0, 1]
- 日期/时间字段用 yyyy-MM-dd 字符串即可（不需要 columns 格式化）
- 状态字段用 `tagMap` 着色 + `labelMap` 中文

**3) 查询条件**

- 时间范围：`month` 或 `startDate + endDate`
- 模糊查询：`text` 类型 + LIKE
- 下拉：`select`，优先 `dict` 系统字典，复杂选项用 `optionsApi`
- 多列合并：参数少用 inline，多用 `colsPerRow`

**4) 汇总**

- 几乎所有"金额汇总"报表都要 `aggregates` 配 `sum`
- 复杂报表可以用 `_aggregate` 单独在某列配置

**5) 命名约定**

| 元素     | 命名                                                    |
| -------- | ------------------------------------------------------- |
| `.ms` 文件 ID | `rpt-<name>-api-001`                              |
| 菜单 ID     | `rpt-demo-<name>`                                  |
| 路由       | `/report-demo/<name>`                              |
| 报表 API path | `/<name>`                                       |
| entryApi   | `/data/report-op/<name>`                            |
| groupId    | `rpt-op-group-001`（已有的，不要改）              |

## 完整例子：分步生成

**用户**：做一张"季度销售对比表"，按季度对比本期与去年同期。

**AI 步骤**：

1. **生成后端 .ms**：
   ```
   backend/data/magic-api/api/数据演示/6报表操作/sales-quarterly.ms
   ```
   ```js
   {
     "id" : "rpt-sales-quarterly-api-001",
     "groupId" : "rpt-op-group-001",
     "name" : "季度销售对比",
     "path" : "/sales-quarterly",
     "method" : "POST"
   }
   ================================================================
   var year = (body == null ? null : body.year)
   if (year == null || year == '') year = '2026'
   return [
       { quarter: 'Q1', curAmount: 4500000, curQty: 320, prevAmount: 3800000, prevQty: 280, growth: 0.184 },
       { quarter: 'Q2', curAmount: 5200000, curQty: 380, prevAmount: 4200000, prevQty: 310, growth: 0.238 },
       { quarter: 'Q3', curAmount: 4800000, curQty: 340, prevAmount: 4500000, prevQty: 320, growth: 0.067 },
       { quarter: 'Q4', curAmount: 6100000, curQty: 420, prevAmount: 5200000, prevQty: 360, growth: 0.173 }
   ]
   ```

2. **生成前端薄壳**：
   ```
   frontend/src/views/report-demo/sales-quarterly.vue
   ```
   ```vue
   <template>
       <MagicReport
           title="季度销售对比"
           subtitle="对比本期与去年同期"
           entryApi="/data/report-op/sales-quarterly"
           :params="params"
           :columns="columns"
       />
   </template>

   <script setup>
   import MagicReport from '@/components/report/MagicReport.vue'
   const params = [
       { field: 'year', label: '年份', type: 'input', placeholder: '请输入年份', default: '2026' }
   ]
   const columns = [
       { key: 'quarter',    title: '季度',       width: 100 },
       { title: '本期',
         children: [
             { key: 'curAmount', title: '金额', width: 130, align: 'right', format: 'money' },
             { key: 'curQty',    title: '数量', width: 100, align: 'right' }
         ] },
       { title: '上年同期',
         children: [
             { key: 'prevAmount', title: '金额', width: 130, align: 'right', format: 'money' },
             { key: 'prevQty',    title: '数量', width: 100, align: 'right' }
         ] },
       { key: 'growth',    title: '增长率', width: 110, align: 'right', format: 'percent',
         cellStyle: (v) => ({ color: v >= 0.1 ? '#2e7d32' : v >= 0 ? '#1976d2' : '#c62828', fontWeight: 600 }) }
       ]
   </script>
   ```

3. **注册菜单**：在 `WorkflowModule.initDemoMenus()` 加：
   ```java
   jdbcTemplate.update(
       "INSERT INTO sys_menu (id, pid, name, url, sort, is_show, is_del, open_mode, keep_alive) " +
       "VALUES ('rpt-demo-sales-quarterly', 'rpt-demo-parent', '季度销售对比', '/report-demo/sales-quarterly', 106, 1, 0, '0', 0)"
   );
   ```

4. **确认**：菜单"报表示例"下出现"季度销售对比"，点击进入，输入年份查询，表格显示 4 行 + 汇总。

## 不写菜单的"测试模式"

如果只是想临时看效果，可以**不**注册菜单，直接在浏览器地址栏输入 `#/report-demo/<name>` 强制跳转，但 Vue Router 会因为找不到菜单而展示空白 page wrapper。

**推荐**：通过 平台前端 IDE 的"魔法报表"插件生成，发布时一次性把菜单注册和 page 写好。

## 对应演示文件

- `6报表操作/` — 目录下有 12 个已完成的报表演示文件，可作为生成新报表的参考模板
