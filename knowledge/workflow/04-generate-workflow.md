# 从 0 创建完整工作流

## 完整创建步骤

### 步骤 1：定义文件

```
backend/data/magic-api/workflow/流程示例/<name>.ms
```

JSON 头里**直接**包含 `nodes` / `routes` / `forms`（运行时 `WorkflowDefinitionShortcutController.loadFromFile` 解析 JSON 头，不是执行 `getDefinition` 脚本）。完整模板见 `01-definition-file.md`。

### 步骤 2：入口 API

```
backend/data/magic-api/api/脚本演示/3插件相关/3.7工作流演示/<name>_entry.ms
```

模板见 `02-entry-api.md`。**重点**：
- approve / reject 用 `workflow.updateBizFields(instId, fields)` 写业务表（避免 HashMap 顺序 bug）
- reject 走**逐层驳回**：`workflow.findPreviousNode` + `workflow.resubmitNodeTask(prevNode, prevAssignee, null, reason)` 5 参版本
- detail **必须**返回 history（前端按节点分组渲染依赖）

### 步骤 3：前端 SFC

```
backend/data/magic-api/component/工作流示例/<name>.ms
```

模板见 `03-wrapper-page.md`。基本就是 `<MagicWorkflow :title :entryApi :processId />` 一个组件。

### 步骤 4：菜单 + 角色授权

数据库表 `sys_menu` + `sys_role_menu`：

```sql
INSERT INTO sys_menu (id, pid, icon, name, url, sort, is_show, is_del)
VALUES ('wf-demo-<name>', 'wf-demo-parent', 'GitPullRequestOutline', '<菜单显示名>',
        '/workflow-demo/<name>', 96, 1, 0);
INSERT INTO sys_role_menu (role_id, menu_id) VALUES ('1', 'wf-demo-<name>');
```

现有 sort：请假=10, 采购=20, 合同=30（跨部门=96 是新建）。

### 步骤 5：业务表 + 映射（如需要）

```sql
CREATE TABLE biz_<name> (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    wf_instance_id VARCHAR(64) NOT NULL,
    applicant VARCHAR(64) NOT NULL,
    <字段>...,
    comment TEXT,
    final_status VARCHAR(20) DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY wf_instance_id (wf_instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sys_wf_process_biz (process_id, biz_table, sort, biz_pk_field, biz_instance_field, description)
VALUES ('<name>_v1', 'biz_<name>', 1, 'id', 'wf_instance_id', '<name>');
```

注意列名要和定义文件 `forms[nodeId].fields` 的 `name` 对应，否则 entry 的 `updateBizFields` 会忽略（通过 `INFORMATION_SCHEMA.COLUMNS` 校验）。

### 步骤 6：演示账号（如需要新角色）

`WorkflowModule.initDemoUsers()` 加角色 + 用户 + 绑定，并加 `frontend/src/components/workflow/MagicWorkflow.vue` 的 `userOptions`。

### 步骤 7：验证

```bash
curl -s http://localhost:9089/magic/web/reload    # 重新加载 .ms
# 如果改了 Java 代码：mvn package + 重启 jar
curl -s http://localhost:9089/workflow-def/<name> -X POST -d '{"action":"getDefinition"}' | python3 -m json.tool | head
```

打开 `/workflow-demo/<name>` 走通流程。

---

## 命名约定

| 元素 | 命名 |
|------|------|
| 定义文件 id | `wf-<name>-def-001` |
| 定义文件 path | `/<name>`（与 group 无关，仅标识） |
| 入口 API id | `wp-<name>-001` |
| 入口 API path | `<name>`（不带 _entry 后缀，magic-api 用文件名作 path） |
| processId | `<name>_v1` |
| entryApi prop | `/data/plugins/workflow-api/<name>` |
| 菜单 id | `wf-demo-<name>` |
| 路由 URL | `/workflow-demo/<name>` |
| 定义文件名 | 中文 `<流程名>.ms` |
| 入口 API 文件名 | `<英文名>_entry.ms`（如 `leave_entry.ms`） |
| SFC 文件名 | 中文 `<流程名>.ms`（与定义文件同名） |

---

## 完整例子 1：创建"请假审批"流程

**用户需求**：做一个请假审批，员工申请 → 经理审批 → 如果超过 3 天走总经理审批 → HR 备案。

### 步骤 1：定义文件 `workflow/流程示例/请假审批.ms`

JSON 头（含 nodes / routes / forms）：

```jsonc
{
  "id": "wf-leave-def-001",
  "groupId": "wf-oa-group-001",
  "name": "请假审批",
  "path": "/leave",
  "method": "POST",
  "description": "员工填写请假类型、天数与事由发起申请。部门经理审批；请假超过 3 天需总经理审批，3 天及以内直接进入 HR 备案（抄送，确认即可）。",
  "processId": "leave_v1",
  "version": 1,
  "category": "OA",
  "entryApi": "/data/plugins/workflow-api/leave",
  "nodes": [
    {"id": "apply",       "label": "员工申请",     "type": "start",   "role": "${initiator}"},
    {"id": "mgr_approve", "label": "部门经理审批", "type": "approve", "role": "dept_manager"},
    {"id": "dir_approve", "label": "总经理审批",   "type": "approve", "role": "director"},
    {"id": "hr_record",   "label": "HR 备案",      "type": "cc",      "role": "hr"},
    {"id": "end",         "label": "结束",         "type": "end"}
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
        {"name": "days",   "label": "请假天数", "type": "number",   "required": true},
        {"name": "reason", "label": "请假事由", "type": "textarea", "required": true}
      ]
    },
    "mgr_approve": {
      "title": "部门经理审批", "editable": ["dept_manager"],
      "fields": [{"name": "mgr_comment", "label": "审批意见", "type": "textarea", "required": true}]
    },
    "dir_approve": {
      "title": "总经理审批", "editable": ["director"],
      "fields": [{"name": "dir_comment", "label": "审批意见", "type": "textarea", "required": true}]
    },
    "hr_record": {
      "title": "HR 备案", "editable": ["hr"],
      "fields": [{"name": "hr_comment", "label": "备案备注", "type": "textarea", "required": true}]
    }
  }
}
================================
var action = body.action
if (action == 'getDefinition') { return {} }
return { success: false, message: 'unknown action: ' + action }
```

### 步骤 2：入口 API `api/脚本演示/3.7工作流演示/leave_entry.ms`

按 `02-entry-api.md` 标准模板实现 start / approve / reject / deny / confirm / detail / myTasks / myStarted / terminate / resubmit。**驳回用逐层驳回模板**。

### 步骤 3：SFC `component/工作流示例/请假审批.ms`

```vue
<template>
    <MagicWorkflow
        title="请假审批"
        subtitle="员工请假流程：申请→部门经理→(条件)总经理→HR 备案"
        processId="leave_v1"
        entryApi="/data/plugins/workflow-api/leave"
        category="OA"
    />
</template>
<script setup>
import MagicWorkflow from '@/components/workflow/MagicWorkflow.vue'
</script>
```

### 步骤 4：菜单

```sql
INSERT INTO sys_menu (id, pid, icon, name, url, sort, is_show, is_del)
VALUES ('wf-demo-leave', 'wf-demo-parent', 'GitPullRequestOutline', '请假审批', '/workflow-demo/leave', 10, 1, 0);
INSERT INTO sys_role_menu (role_id, menu_id) VALUES ('1', 'wf-demo-leave');
```

### 步骤 5：业务表

```sql
CREATE TABLE biz_leave (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    wf_instance_id VARCHAR(64) NOT NULL,
    applicant VARCHAR(64) NOT NULL,
    leave_type VARCHAR(20) NOT NULL,
    days INT NOT NULL,
    reason TEXT,
    comment TEXT,
    final_status VARCHAR(20) DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY wf_instance_id (wf_instance_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO sys_wf_process_biz (process_id, biz_table, sort, biz_pk_field, biz_instance_field, description)
VALUES ('leave_v1', 'biz_leave', 1, 'id', 'wf_instance_id', '请假');
```

---

## 完整例子 2：创建"跨部门申请"流程（高级）

**用户需求**：员工发起跨部门协作申请，需 IT 评估、财务审核、总经理综合审批。每个部门审批人只能填本部门专属字段。驳回逐层回到上一步处理人。

### 步骤 1：定义文件

每个节点都有专属 `fields` + `editable` 角色：

```jsonc
{
  "id": "wf-cross-def-001",
  "groupId": "wf-oa-group-001",
  "name": "跨部门申请",
  "path": "/cross",
  "method": "POST",
  "description": "员工发起跨部门协作项目申请，需 IT 部门评估技术需求与资源、财务审核预算与风险、总经理综合审批。各部门审批人只能编辑本部门专属字段并给出审批意见。",
  "processId": "cross_v1",
  "version": 1,
  "category": "OA",
  "entryApi": "/data/plugins/workflow-api/cross",
  "nodes": [
    {"id": "apply",            "label": "员工申请",         "type": "start",   "role": "${initiator}"},
    {"id": "it_approve",       "label": "IT部门审批与填写", "type": "approve", "role": "it_manager"},
    {"id": "finance_approve",  "label": "财务审批与填写",   "type": "approve", "role": "finance"},
    {"id": "director_approve", "label": "总经理审批与填写", "type": "approve", "role": "director"},
    {"id": "end",              "label": "结束",             "type": "end"}
  ],
  "routes": [
    {"from": "apply",            "to": "it_approve"},
    {"from": "it_approve",       "to": "finance_approve"},
    {"from": "finance_approve",  "to": "director_approve"},
    {"from": "director_approve", "to": "end"}
  ],
  "forms": {
    "apply": {
      "title": "项目基础信息", "editable": ["initiator"],
      "fields": [
        {"name": "project_name",   "label": "项目名称",     "type": "text",     "required": true},
        {"name": "total_budget",   "label": "预算金额(元)", "type": "number",   "required": true},
        {"name": "expected_start", "label": "期望启动日期", "type": "date",     "required": true},
        {"name": "reason",         "label": "项目说明",     "type": "textarea", "required": true}
      ]
    },
    "it_approve": {
      "title": "IT 部门：技术评估", "editable": ["it_manager"],
      "fields": [
        {"name": "it_requirement", "label": "技术需求评估",   "type": "textarea", "required": true},
        {"name": "it_priority",    "label": "技术优先级",     "type": "select", "required": true,
         "options": [{"value":"high","label":"高"},{"value":"medium","label":"中"},{"value":"low","label":"低"}]},
        {"name": "it_estimated_days","label":"预计准备周期(天)","type":"number","required":true},
        {"name": "it_remark",      "label": "IT部门备注",    "type": "textarea"}
      ]
    },
    "finance_approve": {
      "title": "财务：预算审核", "editable": ["finance"],
      "fields": [
        {"name": "finance_budget_review","label": "预算审核意见","type":"textarea","required":true},
        {"name": "finance_risk",         "label": "财务风险等级","type":"select","required":true,
         "options": [{"value":"low","label":"低"},{"value":"medium","label":"中"},{"value":"high","label":"高"}]},
        {"name": "finance_funding_source","label": "资金来源",   "type":"select","required":true,
         "options": [{"value":"annual_budget","label":"年度预算"},{"value":"special_budget","label":"专项预算"},{"value":"reserve","label":"备用金"}]},
        {"name": "finance_remark",       "label": "财务备注",   "type":"textarea"}
      ]
    },
    "director_approve": {
      "title": "总经理：综合审批", "editable": ["director"],
      "fields": [
        {"name": "director_decision","label":"审批结论","type":"select","required":true,
         "options": [{"value":"approve","label":"同意"},{"value":"conditional","label":"有条件同意"},{"value":"reject","label":"不同意"}]},
        {"name": "director_remark",  "label":"总经理意见","type":"textarea"}
      ]
    }
  }
}
================================
var action = body.action
if (action == 'getDefinition') { return {} }
return { success: false, message: 'unknown action: ' + action }
```

### 步骤 2：入口 API

参考 `02-entry-api.md` 的"逐层驳回"模板。approve 时把 formData 传给 `workflow.updateBizFields` + `workflow.approve`。

### 步骤 3-7：同请假流程

### 步骤 6：演示账号

需要 `it_manager` 角色 + `it01` 用户，在 `WorkflowModule.initDemoUsers()` 加，并在 `MagicWorkflow.vue` 的 `userOptions` 加。

---

## AI 生成时的判断要点

### 1) 流程节点设计

- 至少包含：start (发起人) → 至少一个 approve 节点 → end
- 使用 `${initiator}` 作为发起人节点角色
- 条件分支场景：同 from 多条 route + when
- 跨部门场景：每个审批节点给一个明确角色 + 自己的 fields + editable

### 2) 表单字段设计

- 文本 `text` / `textarea`
- 数字 `number`
- 枚举 `select` + options
- 数据字典 `dict` + dictCode
- 时间 `date` / `time` / `datetime`

### 3) 路由条件

`when` 表达式用 magic-script 语法，引用 `variables.<field>`，如 `variables.days > 3`、`variables.amount >= 5000`。

### 4) 跨部门字段权限

每个审批节点：
```jsonc
"nodeX_approve": {
  "editable": ["对应角色 code"],
  "fields": [{...本部门专属字段...}]
}
```

不要把所有字段都放到 apply 节点。前端会自动按 editable 判断只读/可编辑。

### 5) start action 的 title

标题要有意义便于待办列表识别：`body.days + '天' + body.type` 或 `{applicantName} 跨部门申请：{project_name}（预算 ¥{total_budget}）`。

### 6) 参考已有文件

创建前看现有 4 个演示：`请假审批.ms` / `采购审批.ms` / `合同审批.ms` / `跨部门申请.ms`。
