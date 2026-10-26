# Report Skill Overview

当用户要求"做一张报表 / 生成报表 / 添加报表"时，按本 skill 操作。

## 什么是本项目里的"报表"

报表 = "MagicReport" 组件 + 一个 magic-script `.ms` 数据接口的组合。每个报表由 3 部分构成：

```
┌─ 前端 ───────────────────────────────────────────┐
│ views/report-demo/<name>.vue  (薄壳 10-30 行)    │
│   └─ <MagicReport entryApi ... />                │
└─────────────────────────────────────────────────┘
                     ▲ POST
                     │  {p1, p2, p3}
                     ▼
┌─ 后端 ───────────────────────────────────────────┐
│ data/zh/magic-api/api/数据演示/6报表操作/<name>.ms │
│   - 元数据 JSON 头 (path, method, groupId)       │
│   - ============                                  │
│   - magic-script 脚本：                          │
│       return <纯数组 / 纯对象，不包装>            │
└─────────────────────────────────────────────────┘
                     ▲
                     │
┌─ 菜单 ───────────────────────────────────────────┐
│ sys_menu: id='rpt-demo-<name>', pid='rpt-demo-parent'
│ url='/report-demo/<name>', show=1                │
└─────────────────────────────────────────────────┘
```

数据约定：**返回纯数组 `[]` 或纯对象 `{}`，不要自己写 `{success, code, data}`**——magic-api 会自动包装。

## 何时使用本 skill

LLM 在以下场景加载：
- 用户说"做一张报表 / 新建报表 / 添加报表 / 生成报表"
- 用户描述业务数据需求（"按部门统计销售额"、"展示销售月报"等）
- 用户想"改报表的列 / 加筛选条件 / 加导出"

## 不使用本 skill 的情况

- 用户只问"报表在哪里 / 怎么用" → 直接回答，不生成代码
- 想要的是列表 / 表格（CRUD 列表） → 应该用 `gewumind-boot` 的 `mb-table` 组件（见 skills/gewumind-boot/01-mb-table.md），不是 MagicReport
- 用户说的是图表（柱状图 / 饼图） → 用 ECharts 相关 skill（20-echarts.md）

## 工作流（按角色）

**PM / 需求方** 只需要描述需求 → 把需求转给 dev，不需读本 skill 的 03+ 部分。

**架构师 / 文档** 读：
- 00-overview.md（本文件）
- 01-props.md（理解 MagicReport 的 props）
- 04-generate-workflow.md（命名约定、文件路径）

**Dev / 实现** 读全部：
- 00-overview.md
- 01-props.md（props schema：title、params、columns、aggregates、groupBy、exportMeta 等）
- 02-params-and-data.md（params 字段类型 + 后端接口契约）
- 03-columns-and-format.md（columns：format / tagMap / cellStyle / rowSpan / children）
- 04-generate-workflow.md（如何从 0 创建一张报表：.ms 文件 + 薄壳 + 菜单）
- 05-conventions-and-troubleshoot.md（命名 / 颜色 / 导出 / 错误排查）

## 对应演示文件

- `6报表操作/` — 目录下有 12 个已完成的报表演示文件，涵盖利润表、销售报表、库存报表、资产负债表、预算执行、销售趋势等
