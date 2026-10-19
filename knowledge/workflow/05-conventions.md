# 工作流约定与约束

## 命名约定

| 元素 | 格式 | 示例 |
|------|------|------|
| 定义文件 id | `wf-<name>-def-001` | `wf-leave-def-001` |
| 定义文件 groupId | `wf-oa-group-001` | — |
| 定义文件 path | `/<name>`（在 JSON 头中） | `/leave` |
| 定义文件名 | 中文 | `请假审批.ms` |
| 入口 API id | `wp-<name>-001` | `wp-leave-001` |
| 入口 API groupId | `wf-op-group-001` | — |
| 入口 API 文件名 | `<英文名>_entry.ms` | `leave_entry.ms` |
| processId | `<name>_v1` | `leave_v1` |
| entryApi prop（前端用） | `/data/plugins/workflow-api/<name>` | `/data/plugins/workflow-api/leave` |
| definitionApi prop | `/workflow-def/<name>` | `/workflow-def/leave` |
| 菜单 id | `wf-demo-<name>` | `wf-demo-leave` |
| 菜单 URL | `/workflow-demo/<name>` | `/workflow-demo/leave` |
| SFC 文件名 | 中文 | `请假审批.ms` |
| 业务表名 | `biz_<name>` | `biz_leave` |

## 关键约束

### 定义文件

- JSON 头**直接包含** `nodes` / `routes` / `forms`（运行时由 `WorkflowDefinitionShortcutController.loadFromFile` 解析，不是执行 `getDefinition` 脚本）
- `processId` 在定义文件和入口 API 中**必须完全一致**
- `getDefinition` 脚本体仅作兜底响应（reload 时不报错），前端实际读 JSON 头
- `entryApi` 字段填**完整绝对路径** `/data/plugins/workflow-api/<name>`（不是 `/workflow-api/<name>`，magic-api 把 api 目录挂载在 `/data/plugins` 下）
- 条件分支 `when` 表达式用 magic-script 语法，引用 `variables.<field>`

### 入口 API

- 所有 action 通过 `body.action` 分发
- `var uid = body.userId || 'employee'` 前端未传 userId 时兜底
- `workflow.updateBizFields(instId, fields)` 是写业务表的唯一正确方式（绕过 HashMap key 顺序问题）
- 驳回走**逐层驳回**：用 `workflow.findPreviousNode(processId, currentNode)` 找 routes 中 `to == currentNode` 的非 start from
- 驳回新任务的 reject_reason 用 `workflow.resubmitNodeTask(..., rejectReason)` 5 参版本写入
- `detail` action **必须**返回 `history` 数组（前端 `approvalSections` computed 依赖）
- `magic-script` 不支持裸 `continue`，必须用 `if (...) { continue; }`
- 不要在 entry 里用 named parameter `#{xxx}` 自己拼 SQL（HashMap key 顺序不稳定）

### 跨部门填写（核心特性）

- 每个审批节点可以有自己专属的 `forms[nodeId].fields` 和 `editable` 角色
- 前端按 `editable` 数组 + 当前用户角色自动判断字段只读/可编辑
- approve 时 `workflow.approve(taskId, userId, comment, formData)` 后端会自动 merge formData 到 instance.variables_json
- 用户跨节点填写流程：发起人填 apply → IT 填 it_xxx → 财务填 finance_xxx → 总经理填 director_xxx

### 逐层驳回（核心特性）

- 驳回语义：当前审批节点驳回 → 找 routes 中的"上一个审批节点" → 由上一步处理人修改重提
- IT 驳回 → apply（员工）
- finance 驳回 → it_approve（IT 重填）
- director 驳回 → finance_approve（财务重填）
- 驳回原因通过 5 参 `resubmitNodeTask` 写入新任务 `sys_wf_task.reject_reason`
- 前端 `rejectInfo` computed 读取后显示在审批弹窗顶部红色卡片

### 前端

- `entryApi` prop 必须指向**完整绝对路径** `/data/plugins/workflow-api/<name>`
- `processId` prop 与定义文件 JSON 头一致
- 所有请求通过 `common.postJson()`（response 已 unwrap，不需要 `.data`）
- 附件上传通过 FormData，不设置 Content-Type
- 演示身份切换器内置 10 个账号（employee / manager / director / hr01 / finance01 / ceo / sales01 / legal01 / it01 / observer01）
- 审批弹窗按节点分组渲染字段，每个节点显示填写人/时间/状态
- 驳回重提任务在弹窗顶部显示红色"驳回原因"卡片

### 后端

- `WorkflowModule.loadAllProcessDefs()` 启动时扫描 `workflow/流程示例/` 注册到 processDefCache
- 运行时修改 .ms 文件需要 reload（`curl /magic/web/reload`）才能生效
- `app.init-tables=false`（application.yml 默认）→ 新增 schema 列需手工 ALTER：
  - `sys_wf_task` 加 `is_from_reject TINYINT DEFAULT 0` / `reject_reason VARCHAR(500)`
- 配置中心 `workflow.enabled` 设为 false 时，所有工作流端点返回 403

## 已知问题

- `typeof x == 'object'` 在 magic-script 中可能异常 —— 用 null 守卫代替
- magic-script 不支持 `continue` 关键字 —— 用 `if (cond) { continue; }` 块包裹
- magic-script `var x = a ? b : c` 三元表达式类型需兼容（混合类型可能异常）
- magic-script HashMap 顺序不稳定 → 业务表更新必须走 `workflow.updateBizFields()`（backend 内部用 LinkedHashMap + List 绑定）
- `n-description` 组件在 naive-ui 中不存在 —— 使用 `n-descriptions`
- `v-else` 在多个 `v-if` 兄弟元素中会乱掉 —— 用 `v-if="!cond"` 代替
- `common.get()` / `common.postJson()` 的 response 已被 interceptor 解包 —— 直接得到 JSON body
- 表单字段 `date` / `time` / `datetime` 提交时是**毫秒时间戳**（number），不是日期字符串
- 驳回原因为空时显示"（驳回人未填写原因）"占位（前端 rejectInfo computed 处理）
- magic-api 的 magic-script CompileCache 是进程内缓存；改 .ms 后必须 reload 或重启

## 当前 4 个演示流程

| # | 流程 | processId | 节点数 | 演示特性 |
|---|------|-----------|--------|---------|
| 1 | 请假审批 | `leave_v1` | 5 | 条件分支（天数>3 走总经理）+ 抄送节点（HR cc） |
| 2 | 采购审批 | `purchase_v1` | 5 | 金额阈值分支（>5000 走财务） |
| 3 | 合同审批 | `contract_v1` | 5 | 多角色顺序审批（销售→法务→财务） |
| 4 | 跨部门申请 | `cross_v1` | 5 | 跨部门填写 + 逐层驳回修改 + 节点字段权限 |

> 报销审批（expense_v1）和出差申请（trip_v1）已删除。

## 对应演示文件位置

- 定义文件：`backend/data/magic-api/workflow/流程示例/*.ms`（4 个）
- 入口 API：`backend/data/magic-api/api/脚本演示/3插件相关/3.7工作流演示/*_entry.ms`（4 个）
- 前端 SFC：`backend/data/magic-api/component/工作流示例/*.ms`（4 个 + 流程详情）
- 业务表：`biz_leave` / `biz_purchase` / `biz_cross`（合同流程不写业务表）
- 演示账号：`WorkflowModule.initDemoUsers()` 内置 10 个
- 菜单：`sys_menu` 表的 `wf-demo-*` 行
