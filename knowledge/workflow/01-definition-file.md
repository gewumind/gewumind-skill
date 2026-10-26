# 工作流定义文件（Definition .ms）

## 文件位置

```
backend/data/zh/magic-api/workflow/流程示例/<name>.ms
```

文件名建议用中文（如 `请假审批.ms`），与 SFC 组件 + 菜单名对应。

## 完整格式

**注意**：当前实现里 nodes / routes / forms **直接写在 JSON 头里**，不再写在 `getDefinition` 的脚本返回值。脚本里只写空兜底。

```jsonc
{
  "id"         : "wf-<name>-def-001",
  "groupId"    : "wf-oa-group-001",
  "name"       : "<流程中文名>",
  "path"       : "/<name>",
  "method"     : "POST",
  "description": "<流程说明，会展示在审批弹窗顶部>",
  "processId"  : "<name>_v1",
  "version"    : 1,
  "category"   : "OA",
  "entryApi"   : "/data/plugins/workflow-api/<name>",
  "nodes": [
    {"id": "apply",         "label": "员工申请",   "type": "start",   "role": "${initiator}"},
    {"id": "mgr_approve",   "label": "部门经理审批","type": "approve", "role": "dept_manager"},
    {"id": "dir_approve",   "label": "总经理审批", "type": "approve", "role": "director"},
    {"id": "hr_record",     "label": "HR 备案",    "type": "cc",      "role": "hr"},
    {"id": "end",           "label": "结束",       "type": "end"}
  ],
  "routes": [
    {"from": "apply",       "to": "mgr_approve"},
    {"from": "mgr_approve", "to": "dir_approve", "when": "variables.days > 3"},
    {"from": "mgr_approve", "to": "hr_record",   "when": "variables.days <= 3"},
    {"from": "dir_approve", "to": "hr_record"},
    {"from": "hr_record",   "to": "end"}
  ],
  "forms": {
    "apply": {
      "title": "请假申请",
      "editable": ["initiator"],
      "fields": [
        {"name": "leave_type", "label": "请假类型", "type": "select", "required": true,
         "options": [{"value":"事假","label":"事假"},{"value":"病假","label":"病假"},{"value":"年假","label":"年假"}]},
        {"name": "days", "label": "请假天数", "type": "number", "required": true},
        {"name": "reason", "label": "请假事由", "type": "textarea", "required": true}
      ]
    },
    "mgr_approve": {
      "title": "部门经理审批",
      "editable": ["dept_manager"],
      "fields": [
        {"name": "mgr_comment", "label": "审批意见", "type": "textarea", "required": true}
      ]
    },
    "dir_approve": {
      "title": "总经理审批",
      "editable": ["director"],
      "fields": [
        {"name": "dir_comment", "label": "审批意见", "type": "textarea", "required": true}
      ]
    },
    "hr_record": {
      "title": "HR 备案",
      "editable": ["hr"],
      "fields": [
        {"name": "hr_comment", "label": "备案备注", "type": "textarea", "required": true}
      ]
    }
  }
}
================================
var action = body.action
if (action == 'getDefinition') {
    return {
        "title": "{applicantName} 请假 {days} 天（{leave_type}）",
        "nodes": [], "routes": [], "forms": {}   // 实际从前端 JSON 头读，这里只是兜底
    }
}
return { success: false, message: 'unknown action: ' + action }
```

> ⚠️ **运行时实际行为**：`WorkflowDefinitionShortcutController.loadFromFile` 直接读 JSON 头的 nodes/routes/forms，不是读 `getDefinition` 返回值。脚本只是兜底响应，让 reload 时不报错。

## JSON 头字段

| 字段 | 必填 | 说明 |
|------|------|------|
| `id` | 是 | `wf-<name>-def-001`（仅记录用） |
| `groupId` | 是 | `wf-oa-group-001` |
| `name` | 是 | 流程中文名 |
| `path` | 是 | `/<name>`（与 group 路径无关，仅标识） |
| `method` | 是 | POST |
| `processId` | 是 | **全局唯一**，如 `leave_v1` |
| `entryApi` | 是 | `/data/plugins/workflow-api/<name>`（完整绝对路径） |
| `category` | 是 | OA |
| `description` | 是 | 流程说明 |
| `version` | 是 | 1 |
| `nodes` / `routes` / `forms` | 是 | 直接在 JSON 头里定义 |

## 节点定义（nodes）

```jsonc
{
  "id": "apply",
  "label": "员工申请",
  "type": "start",
  "role": "${initiator}"
}
```

### 节点类型

| type | 说明 | role 取值 |
|------|------|-----------|
| `start` | 开始节点（发起人） | `${initiator}` |
| `approve` | 审批节点（同时可填写本节点字段） | 角色 code（dept_manager / it_manager / finance / director / hr / sales_manager / legal） |
| `cc` | 抄送节点（只需确认已读，不审批） | 任意角色 |
| `end` | 结束节点 | 不需要 role |

### 常用角色 → userId 映射

| 角色 code | 演示 userId | 说明 |
|-----------|------------|------|
| `${initiator}` | 发起人 | 由调用入口 API 传的 userId 决定 |
| `dept_manager` | `manager` | 部门经理 |
| `director` | `director` | 总经理 |
| `hr` | `hr01` | HR 专员 |
| `finance` | `finance01` | 财务专员 |
| `it_manager` | `it01` | IT 负责人（新增） |
| `sales_manager` | `sales01` | 销售经理 |
| `legal` | `legal01` | 法务 |
| `ceo` | `ceo` | CEO |

## 路由定义（routes）

```jsonc
[
  {"from": "apply",       "to": "mgr_approve"},
  {"from": "mgr_approve", "to": "dir_approve", "when": "variables.days > 3"},
  {"from": "mgr_approve", "to": "hr_record",   "when": "variables.days <= 3"},
  {"from": "dir_approve", "to": "hr_record"},
  {"from": "hr_record",   "to": "end"}
]
```

- `from` / `to`：节点 id
- `when`：可选条件（magic-script 语法），引用 `variables.<field>`
- 同 `from` 多条 route = 条件分支；无 `when` 为默认
- 运行时 `WorkflowModule.findNextNode()` 解析

## 表单定义（forms）— 关键设计

每个节点都可以有自己的 `forms[nodeId].fields`，这是**跨部门填写**的基础：

```jsonc
{
  "apply": {
    "title": "项目基础信息",
    "editable": ["initiator"],           // 谁能编辑（角色 code 数组）
    "fields": [
      {"name": "project_name", "label": "项目名称", "type": "text", "required": true}
    ]
  },
  "it_approve": {
    "title": "IT 部门：技术评估",
    "editable": ["it_manager"],          // 只 IT 角色能编辑
    "fields": [
      {"name": "it_requirement", "label": "技术需求评估", "type": "textarea", "required": true},
      {"name": "it_priority",    "label": "技术优先级",    "type": "select", "required": true,
       "options": [{"value":"high","label":"高"},{"value":"medium","label":"中"},{"value":"low","label":"低"}]}
    ]
  }
}
```

**`editable` 字段语义**：
- 数组中列出能编辑该节点字段的角色 code（与 sys_role.code 对应）
- 前端 `approveFieldsReadonly` computed 判断：当前用户角色是否在 editable 内 → 否则字段 disabled（只读）
- 后端 entry approve 也只对当前节点字段调用 `updateBizFields`，跨部门字段不会重复覆盖

### 字段类型

| type | 渲染 | 额外属性 |
|------|------|---------|
| `text` | n-input | — |
| `textarea` | n-input type=textarea | — |
| `number` | n-input-number | — |
| `select` | n-select | `options: [{value, label}]` |
| `radio` | n-radio-group | `options` |
| `dict` | n-select（动态） | `dictCode: "字典code"` → GET `/ai/dict/{code}` |
| `api-select` | n-select（动态） | `api: "/path"`, `apiParams: {key:val}` |
| `date` / `time` / `datetime` | n-date-picker | 值为**毫秒时间戳**（提交时 number） |
| `autocomplete` | n-auto-complete | `api: "/search?q="` |

## 模板：条件分支流程

```jsonc
{
  "id": "wf-<name>-def-001",
  "groupId": "wf-oa-group-001",
  "name": "<流程名>",
  "path": "/<name>",
  "method": "POST",
  "description": "<流程说明>",
  "processId": "<name>_v1",
  "version": 1,
  "category": "OA",
  "entryApi": "/data/plugins/workflow-api/<name>",
  "nodes": [
    {"id": "apply",  "label": "员工申请", "type": "start",   "role": "${initiator}"},
    {"id": "node1",  "label": "经理审批", "type": "approve", "role": "dept_manager"},
    {"id": "node2",  "label": "高管审批", "type": "approve", "role": "director"},
    {"id": "end",    "label": "结束",     "type": "end"}
  ],
  "routes": [
    {"from": "apply", "to": "node1"},
    {"from": "node1", "to": "node2", "when": "variables.字段名 > 阈值"},
    {"from": "node1", "to": "end",   "when": "variables.字段名 <= 阈值"}
  ],
  "forms": {
    "apply": {
      "title": "申请表单",
      "editable": ["initiator"],
      "fields": [
        {"name": "字段名", "label": "字段标签", "type": "number", "required": true}
      ]
    }
  }
}
================================
var action = body.action
if (action == 'getDefinition') { return {} }
return { success: false, message: 'unknown action: ' + action }
```

## 模板：跨部门填写流程（重点）

每个节点都有专属字段，前端按角色权限只读/编辑：

```jsonc
{
  "id": "wf-cross-def-001",
  "groupId": "wf-oa-group-001",
  "name": "跨部门申请",
  "path": "/cross",
  "method": "POST",
  "description": "员工发起跨部门协作项目申请，需 IT 评估技术需求与资源、财务审核预算、总经理综合审批",
  "processId": "cross_v1",
  "version": 1,
  "category": "OA",
  "entryApi": "/data/plugins/workflow-api/cross",
  "nodes": [
    {"id": "apply",            "label": "员工申请",                "type": "start",   "role": "${initiator}"},
    {"id": "it_approve",       "label": "IT部门审批与填写",        "type": "approve", "role": "it_manager"},
    {"id": "finance_approve",  "label": "财务审批与填写",          "type": "approve", "role": "finance"},
    {"id": "director_approve", "label": "总经理审批与填写",        "type": "approve", "role": "director"},
    {"id": "end",              "label": "结束",                    "type": "end"}
  ],
  "routes": [
    {"from": "apply",            "to": "it_approve"},
    {"from": "it_approve",       "to": "finance_approve"},
    {"from": "finance_approve",  "to": "director_approve"},
    {"from": "director_approve", "to": "end"}
  ],
  "forms": {
    "apply": {
      "title": "项目基础信息",
      "editable": ["initiator"],
      "fields": [
        {"name": "project_name",   "label": "项目名称",      "type": "text",     "required": true},
        {"name": "total_budget",   "label": "预算金额(元)",  "type": "number",   "required": true},
        {"name": "expected_start", "label": "期望启动日期",  "type": "date",     "required": true},
        {"name": "reason",         "label": "项目说明",      "type": "textarea", "required": true}
      ]
    },
    "it_approve": {
      "title": "IT 部门：技术评估",
      "editable": ["it_manager"],
      "fields": [
        {"name": "it_requirement", "label": "技术需求评估", "type": "textarea", "required": true},
        {"name": "it_priority",    "label": "技术优先级",   "type": "select", "required": true,
         "options": [{"value":"high","label":"高"},{"value":"medium","label":"中"},{"value":"low","label":"低"}]},
        {"name": "it_estimated_days","label":"预计准备周期(天)", "type": "number", "required": true},
        {"name": "it_remark",      "label": "IT部门备注",   "type": "textarea"}
      ]
    },
    "finance_approve": {
      "title": "财务：预算审核",
      "editable": ["finance"],
      "fields": [
        {"name": "finance_budget_review", "label": "预算审核意见", "type": "textarea", "required": true},
        {"name": "finance_risk",          "label": "财务风险等级", "type": "select", "required": true,
         "options": [{"value":"low","label":"低"},{"value":"medium","label":"中"},{"value":"high","label":"高"}]},
        {"name": "finance_funding_source","label": "资金来源",     "type": "select", "required": true,
         "options": [{"value":"annual_budget","label":"年度预算"},{"value":"special_budget","label":"专项预算"},{"value":"reserve","label":"备用金"}]},
        {"name": "finance_remark",        "label": "财务备注",     "type": "textarea"}
      ]
    },
    "director_approve": {
      "title": "总经理：综合审批",
      "editable": ["director"],
      "fields": [
        {"name": "director_decision", "label": "审批结论", "type": "select", "required": true,
         "options": [{"value":"approve","label":"同意"},{"value":"conditional","label":"有条件同意"},{"value":"reject","label":"不同意"}]},
        {"name": "director_remark",   "label": "总经理意见","type": "textarea"}
      ]
    }
  }
}
================================
var action = body.action
if (action == 'getDefinition') { return {} }
return { success: false, message: 'unknown action: ' + action }
```

**字段流转机制**：
1. 发起人填 apply 字段 → 提交后 variables 含 project_name 等
2. IT 审批弹窗：it_requirement 等字段可编辑（editable=['it_manager'] + 当前是 it01），其他节点字段（finance_xxx, director_xxx）只读显示
3. IT approve 后，entry 脚本调 `workflow.approve(taskId, op, comment, form)` → 后端 mergeVariables 自动合并 it_requirement 到 instance.variables_json
4. 财务审批时 variables 里已经有 it_requirement（可读），finance 填自己的字段后 approve
5. 总经理看到所有节点的字段已填值，写自己的 director_decision/director_remark 后 approve → 结束

## 注意事项

- `processId` 在定义文件和入口 API 中**必须完全一致**
- JSON 头的 `nodes` / `routes` / `forms` 是运行时真正读取的，脚本里 `getDefinition` 返回值仅作兜底
- `entryApi` 填**完整绝对路径** `/data/plugins/workflow-api/<name>`（magic-api 把 `api/` 目录挂载在 `/data/plugins/` 下）
- `definitionApi` prop 在前端是 `/workflow-def/<name>`（不带 `/data/plugins/`）
- 条件分支 `when` 表达式用 magic-script 语法，引用 `variables.<field>`
- `editable` 字段是字段权限的关键：决定哪些角色能编辑该节点字段
- 抄送节点 (`type: "cc"`) 审批弹窗只有"确认"按钮（无同意/驳回），用 `workflow.confirm(taskId, op, comment)` 处理

## 对应演示文件

- `backend/data/zh/magic-api/workflow/流程示例/请假审批.ms` — 请假审批（条件分支 + 抄送）
- `backend/data/zh/magic-api/workflow/流程示例/采购审批.ms` — 采购审批（金额分支）
- `backend/data/zh/magic-api/workflow/流程示例/合同审批.ms` — 合同审批（多角色链式）
- `backend/data/zh/magic-api/workflow/流程示例/跨部门申请.ms` — 跨部门申请（跨部门填写 + 逐层驳回）
