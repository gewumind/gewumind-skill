# Workflow Skill Overview

当用户要求"做一个工作流 / 审批流程 / 新建流程 / 添加审批"时，按本 skill 操作。

## 什么是本项目里的"工作流"

工作流 = 前端 SFC 组件 + 流程定义文件(.ms) + 入口 API(.ms) 的组合。每个工作流由 **4 部分** 构成：

```
┌─ 前端（component 目录）─────────────────────────────────────────┐
│ data/zh/magic-api/component/工作流示例/<name>.ms                   │
│   └─ <MagicWorkflow :title :entryApi :definitionApi ... />      │
└────────────────────────────────────────────────────────────────┘
                      ▲ POST { action, userId, ... }
                      │
┌─ 后端 magic-api 脚本层 ─────────────────────────────────────────┐
│ data/zh/magic-api/workflow/流程示例/<name>.ms（流程定义）            │
│   - JSON 头直接包含：nodes / routes / forms / description       │
│   - ============================================================  │
│   - 脚本：if (action == 'getDefinition') { return { ... } }       │
│                                                                  │
│ data/zh/magic-api/api/脚本演示/3插件相关/3.7工作流演示/<name>_entry.ms│
│   - action dispatch：start/approve/reject/deny/resubmit/         │
│     myTasks/myStarted/detail/terminate                          │
└────────────────────────────────────────────────────────────────┘
                      ▲
                      │
┌─ 后端 Java 层 ──────────────────────────────────────────────────┐
│ WorkflowModule.java（src/main/java/com/gewumind/boot/extension/）  │
│   - processDefCache：Map<processId, ProcessDef>                  │
│   - loadAllProcessDefs() → 扫描流程定义文件注册到缓存            │
│   - 运行时：start/approve/reject/deny/resubmit/resubmitNodeTask/  │
│             findPreviousNode/updateBizFields/findNextNode/...    │
└────────────────────────────────────────────────────────────────┘
```

## 何时使用本 skill

LLM 在以下场景加载：
- 用户说"做一个审批流程 / 新建工作流 / 加一个流程"
- 用户描述审批业务场景（"请假审批"、"报销流程"、"合同审批"、"跨部门申请"等）
- 用户想"改流程节点 / 加审批环节 / 改分支条件 / 加驳回层级"
- 用户想"每个部门填自己的字段 / 按部门权限填表"

## 不使用本 skill 的情况

- 用户问"流程审批记录 / 待办在哪" → 直接回答，不生成代码
- 用户要做的是**报表**（数据展示 + 查询） → 用 `report` skill（MagicReport）
- 用户要做的是**CRUD 页面**（增删改查） → 用 `gewumind-boot` 的 mb-table/mb-form

## 当前演示流程

| 流程 | processId | 节点 | 演示特性 |
|------|-----------|------|---------|
| 请假审批 | `leave_v1` | apply → mgr → dir>3d → hr(cc) → end | 条件分支 + 抄送 |
| 采购审批 | `purchase_v1` | apply → dept → finance>5000 → end | 金额阈值分支 |
| 合同审批 | `contract_v1` | apply → sales → legal → finance → end | 多角色链式审批 |
| 跨部门申请 | `cross_v1` | apply → it → finance → director → end | **跨部门填写 + 逐层驳回** |

报销 (`expense_v1`) 和出差 (`trip_v1`) 已删除。

## 工作流（按角色）

**PM / 需求方** 只需要描述需求 → 把需求转给 dev，不需读本 skill 的 03+ 部分。

**Dev / 实现** 读全部：
- 00-overview.md（本文件）
- 01-definition-file.md（定义文件格式 + nodes/routes/forms）
- 02-entry-api.md（入口 API action handler 模板 + 跨部门 / 逐层驳回模式）
- 03-wrapper-page.md（前端 SFC 组件模板）
- 04-generate-workflow.md（从 0 创建完整工作流的步骤）
- 05-conventions.md（命名 / 约束 / 已知问题）

## 对应演示文件位置

- **定义文件**：`backend/data/zh/magic-api/workflow/流程示例/*.ms`（4 个）
- **入口 API**：`backend/data/zh/magic-api/api/脚本演示/3插件相关/3.7工作流演示/*_entry.ms`（4 个）
- **前端 SFC**：`backend/data/zh/magic-api/component/工作流示例/*.ms`（4 个 + 流程详情）
