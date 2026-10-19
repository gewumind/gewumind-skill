# 入口 API（Entry API .ms）

## 文件位置

```
backend/data/magic-api/api/脚本演示/3插件相关/3.7工作流演示/<name>_entry.ms
```

文件名带 `_entry` 后缀（如 `请假审批.ms` 在 component/，但入口是 `leave_entry.ms`）。

> 注意：定义文件用中文名（如 `请假审批.ms`），入口 API 用英文短名 + `_entry` 后缀（如 `leave_entry.ms`）。两者 processId 必须一致。

## JSON 头

```jsonc
{
  "id"      : "wp-<name>-001",
  "groupId" : "wf-op-group-001",
  "name"    : "<name> 流程入口",
  "path"    : "<name>",
  "method"  : "POST"
}
```

group.json 在同目录：`groupId: "wf-op-group-001"`, `path: "/workflow-api"`, magic-api 把整个目录挂载在 `/data/plugins/workflow-api/` 下。

## 完整骨架

```js
================================
var action = body.action
var processId = '<name>_v1'

if (action == 'start')     { /* ... */ }
if (action == 'approve')   { /* ... */ }
if (action == 'reject')    { /* ... */ }   // 逐层驳回
if (action == 'deny')      { /* ... */ }   // 不同意（终止）
if (action == 'resubmit')  { /* ... */ }
if (action == 'confirm')   { /* ... */ }   // 抄送节点确认
if (action == 'myTasks')   { /* ... */ }
if (action == 'myStarted')  { /* ... */ }
if (action == 'detail')    { /* ... */ }
if (action == 'terminate') { /* ... */ }

return { success: false, message: 'unsupported action: ' + action }
```

## start（自动提交模式）

员工提交后自动推进到第一个审批节点：

```js
if (action == 'start') {
    if (!processId) return { success: false, message: '缺少 processId' }
    var uid = body.userId || 'employee'
    var data = {}
    for (k, v in body) {
        // 排除内部字段，把表单字段提取到 data
        if (k == 'action' || k == 'processId' || k == 'userId' || k == 'bizType' || k == 'bizTitle' || k == 'items' || k == 'taskId' || k == 'formData' || k == 'comment' || k == 'children') continue
        data[k] = v
    }
    var children = body.items
    var titleVars = {}
    for (kv, vv in data) { titleVars[kv] = vv }
    titleVars.applicant = uid
    var rTitle = body.bizTitle || body.title || workflow.applyTitle(processId, titleVars)
    var inst = workflow.start(processId, {
        initiator: uid,
        title: rTitle,
        currentNode: 'apply',
        variables: body,
        biz: { type: body.bizType || processId.replace(/_v\d+$/, ''), title: rTitle, data: data, children: children }
    })
    var task = workflow.createTask(inst.id, 'apply', '员工申请', uid)
    workflow.approve(task.id, 'system', '员工提交申请')
    var nextNode = workflow.findNextNode(processId, 'apply', body, inst.id, '' + uid, 50)
    if (nextNode == 'end' || nextNode == null) {
        workflow.moveToNext(inst.id, 'end', '结束', null)
        return { success: true, instanceId: inst.id, nextNode: 'end', nextNodeLabel: '结束', autoSubmitted: true }
    }
    var nextNodeName = workflow.getNodeLabel(processId, nextNode)
    var users = workflow.resolveRole(workflow.getNodeRole(processId, nextNode), uid)
    var assignee = users.size() > 0 ? users.get(0) : (uid != inst.initiator ? uid : null)
    var nextTask = workflow.moveToNext(inst.id, nextNode, nextNodeName, assignee)
    return { success: true, instanceId: inst.id, nextNode: nextNode, nextNodeLabel: nextNodeName, assignee: assignee, nextTask: nextTask, autoSubmitted: true }
}
```

## approve（合并本节点字段到 variables）

```js
if (action == 'approve') {
    var taskId = body.taskId
    var op = body.userId || 'manager'
    var form = body.formData
    var comment = body.comment || body.reason || ''
    if (!taskId) return { success: false, message: '缺少 taskId' }
    var taskInfo = workflow.getTask(taskId)
    if (taskInfo == null) return { success: false, message: '任务不存在' }
    var instId = taskInfo.instance_id
    var nodeId = taskInfo.node_id

    // 业务表更新：绕过 magic-script HashMap 顺序 bug，走 backend
    var bizFields = {}
    bizFields.comment = '' + comment
    bizFields.final_status = 'APPROVED'
    if (form && form.size() > 0) {
        for (fk, fv in form) {
            if (fk == 'comment' || fk == 'final_status') continue
            bizFields[fk] = fv
        }
    }
    try { workflow.updateBizFields(instId, bizFields) } catch (e) { print("[warn] updateBizFields 失败: " + e.getMessage()) }

    // 后端 approve 接受 formData，自动 merge 到 instance.variables_json
    workflow.approve(taskId, op, '' + comment, form)

    // 推进到下一节点
    var inst = workflow.getInstance(instId)
    var vars2 = inst.variables
    if (vars2 == null) vars2 = {}
    var nextNode = workflow.findNextNode(processId, nodeId, vars2, instId, '' + inst.initiator, 50)
    if (nextNode == 'end' || nextNode == null) {
        workflow.moveToNext(instId, 'end', '结束', null)
        return { success: true, taskId: taskId, status: 'APPROVED', nextNode: 'end', autoSkipped: true }
    }
    var nextNodeName = workflow.getNodeLabel(processId, nextNode)
    var users = workflow.resolveRole(workflow.getNodeRole(processId, nextNode), inst.initiator)
    var assignee = null
    if (users != null && users.size() > 0) assignee = users.get(0)
    var nextTask = workflow.moveToNext(instId, nextNode, nextNodeName, assignee)
    return { success: true, taskId: taskId, status: 'APPROVED', nextNode: nextNode, nextNodeLabel: nextNodeName, assignee: assignee, nextTask: nextTask }
}
```

## reject / deny（**逐层驳回修改**）⭐ 关键

**语义**：当前审批节点驳回时，找 routes 中的"上一个审批节点"，让上一步处理人修改重提。如果上一节点是 apply（发起节点），直接打回发起人。

- IT 驳回 → apply（员工重填）
- finance 驳回 → it_approve（IT 重填）
- director 驳回 → finance_approve（财务重填）

```js
if (action == 'reject' || action == 'deny') {
    var taskId2 = body.taskId
    var op2 = body.userId || 'manager'
    var reason2 = body.reason || body.comment || ''
    if (!taskId2) return { success: false, message: '缺少 taskId' }
    var taskInfo2 = workflow.getTask(taskId2)
    if (taskInfo2 == null) return { success: false, message: '任务不存在' }
    var instId2 = taskInfo2.instance_id

    // 业务表驳回
    var bizFields2 = {}
    bizFields2.comment = '' + reason2
    bizFields2.final_status = 'REJECTED'
    var form2 = body.formData
    if (form2 && form2.size() > 0) {
        for (fkk, fvv in form2) {
            if (fkk == 'comment' || fkk == 'final_status') continue
            bizFields2[fkk] = fvv
        }
    }
    try { workflow.updateBizFields(instId2, bizFields2) } catch (e) { print("[warn] " + e.getMessage()) }

    // 逐层驳回：根据 routes 找"上一个审批节点"
    var nodeId2 = taskInfo2.node_id
    if (nodeId2 != null && nodeId2 != 'apply') {
        var prevNode = workflow.findPreviousNode(processId, nodeId2)
        workflow.reject(taskId2, op2, '' + reason2, form2)
        if (prevNode == null || prevNode == 'apply') {
            // 已经是第一个审批节点 → 直接打回发起人
            var denied2 = workflow.deny(taskId2, op2, '' + reason2, processId)
            return denied2
        }
        // 驳回到上一审批节点：让上一步处理人重填
        var prevRole = workflow.getNodeRole(processId, prevNode)
        var prevAssignee = null
        if (prevRole != null && prevRole != '') {
            var instNow = workflow.getInstance(instId2)
            var prevUsers = workflow.resolveRole(prevRole, instNow != null ? '' + instNow.initiator : '')
            if (prevUsers != null && prevUsers.size() > 0) prevAssignee = prevUsers.get(0)
        }
        // 5 参版本：把驳回意见 reason2 写入新任务的 reject_reason，前端弹窗头部展示
        var rt = workflow.resubmitNodeTask(instId2, prevNode, prevAssignee, null, '' + reason2)
        if (rt.success == false) return rt
        return { success: true, taskId: taskId2, status: 'RUNNING', rejectedTo: prevNode, nextNode: prevNode, nextNodeLabel: rt.nextNodeLabel, assignee: rt.assignee, nextTask: rt.nextTask }
    }

    var denied = workflow.deny(taskId2, op2, '' + reason2, processId)
    return denied
}
```

## confirm（抄送节点确认）

抄送节点只需"确认已读"：

```js
if (action == 'confirm') {
    var taskIdC = body.taskId
    var opC = body.userId || 'hr'
    var commentC = body.comment || ''
    if (!taskIdC) return { success: false, message: '缺少 taskId' }
    var taskInfoC = workflow.getTask(taskIdC)
    if (taskInfoC == null) return { success: false, message: '任务不存在' }
    var instIdC = taskInfoC.instance_id
    var nodeIdC = taskInfoC.node_id
    var conf = workflow.confirm(taskIdC, opC, '' + commentC)
    if (conf.success == false) return conf
    var instC = workflow.getInstance(instIdC)
    var varsC = instC.variables
    if (varsC == null) varsC = {}
    var nextNodeC = workflow.findNextNode(processId, nodeIdC, varsC, instIdC, '' + instC.initiator, 50)
    if (nextNodeC == 'end' || nextNodeC == null) {
        workflow.moveToNext(instIdC, 'end', '结束', null)
        return { success: true, taskId: taskIdC, status: 'CONFIRMED', nextNode: 'end', autoSkipped: true }
    }
    var nextNodeNameC = workflow.getNodeLabel(processId, nextNodeC)
    var usersC = workflow.resolveRole(workflow.getNodeRole(processId, nextNodeC), instC.initiator)
    var assigneeC = null
    if (usersC != null && usersC.size() > 0) assigneeC = usersC.get(0)
    var nextTaskC = workflow.moveToNext(instIdC, nextNodeC, nextNodeNameC, assigneeC)
    return { success: true, taskId: taskIdC, status: 'CONFIRMED', nextNode: nextNodeC, nextNodeLabel: nextNodeNameC, assignee: assigneeC, nextTask: nextTaskC }
}
```

## detail（**必须返回 history**）

> 前端 `approvalSections` computed 依赖 history 聚合"最后填写人/时间"，缺失会导致审批弹窗字段分组渲染空白。

```js
if (action == 'detail') {
    if (!body.instanceId) return { success: false, message: '缺少 instanceId' }
    var inst = workflow.getInstance(body.instanceId)
    if (inst == null) return { success: false, message: '实例不存在: ' + body.instanceId }
    var history = workflow.queryHistory(body.instanceId)
    return { success: true, instance: inst, history: history }
}
```

## myTasks / myStarted

```js
if (action == 'myTasks') {
    var uid = body.userId || 'demo-user'
    var extra = {}
    var pid = body.processId
    if (pid != null && pid != '') extra.processId = pid
    var nk = body.nodeKeyword
    if (nk != null && nk != '') extra.nodeKeyword = nk
    var cf = body.createTimeFrom
    if (cf != null && cf != '') extra.createTimeFrom = cf
    var ct = body.createTimeTo
    if (ct != null && ct != '') extra.createTimeTo = ct
    var isf = body.instanceStartFrom
    if (isf != null && isf != '') extra.instanceStartFrom = isf
    var ist = body.instanceStartTo
    if (ist != null && ist != '') extra.instanceStartTo = ist
    var ts = body.status
    if (ts == null || ts == '') ts = 'PENDING'
    return { success: true, data: workflow.queryMyTasksFiltered(uid, ts, extra) }
}

if (action == 'myStarted') {
    var uid2 = body.userId || 'demo-user'
    var extra2 = {}
    var tk = body.titleKeyword
    if (tk != null && tk != '') extra2.titleKeyword = tk
    var ss = body.status
    if (ss != null && ss != '') extra2.status = ss
    var sf = body.startTimeFrom
    if (sf != null && sf != '') extra2.startTimeFrom = sf
    var st2 = body.startTimeTo
    if (st2 != null && st2 != '') extra2.startTimeTo = st2
    return { success: true, data: workflow.queryMyStarted(uid2, processId, extra2) }
}
```

## terminate（撤回）

```js
if (action == 'terminate') {
    if (!body.instanceId) return { success: false, message: '缺少 instanceId' }
    var inst3 = workflow.getInstance(body.instanceId)
    if (inst3 == null) return { success: false, message: '实例不存在' }
    if (inst3.status == 'COMPLETED' || inst3.status == 'CANCELLED') {
        return { success: false, message: '该实例已结束，无法撤回' }
    }
    var wd = workflow.withdraw(body.instanceId, body.userId || inst3.initiator)
    if (wd.success == false) return wd
    var updated3 = workflow.getInstance(body.instanceId)
    return { success: true, instance: updated3 }
}
```

## resubmit（员工驳回后修改重提）

员工被驳回到 apply 节点后修改表单重新提交：

```js
if (action == 'resubmit') {
    if (!body.instanceId) return { success: false, message: '缺少 instanceId' }
    var inst4 = workflow.getInstance(body.instanceId)
    if (inst4 == null) return { success: false, message: '实例不存在' }
    if (inst4.status != 'REJECTED' && inst4.status != 'WITHDRAWN') {
        return { success: false, message: '只驳回状态可修改重提: ' + inst4.status }
    }
    var formData = body.formData
    if (formData == null) formData = {}
    var rs = workflow.resubmit(body.instanceId, body.userId || inst4.initiator, formData)
    return rs
}
```

## 关键规则

- `var uid = body.userId || 'employee'` 前端未传 userId 时兜底
- `processId` 必须与定义文件 JSON 头中的 processId 完全一致
- start action 中 `workflow.start()` 第二参数 config 包含 `initiator` / `title` / `currentNode` / `variables`
- approve / reject **必须**用 `workflow.updateBizFields(instId, fields)` 写业务表，**不要**自己拼 SQL（magic-script HashMap named 占位符顺序不稳定）
- 驳回路径：`workflow.findPreviousNode(processId, currentNode)` 找 routes 中 `to == currentNode` 的非 start from
- 驳回新任务的 reject_reason 通过 `resubmitNodeTask(..., rejectReason)` 5 参版本写入
- 所有 `if (action == 'X') { continue }` 中 `continue` 必须包在 `{ }` 块里（magic-script 不支持裸 continue）
- 前端 detail action **必须**返回 history 数组

## 对应演示文件

- `backend/data/magic-api/api/脚本演示/3插件相关/3.7工作流演示/leave_entry.ms` — 请假审批入口
- `backend/data/magic-api/api/脚本演示/3插件相关/3.7工作流演示/purchase_entry.ms` — 采购审批入口
- `backend/data/magic-api/api/脚本演示/3插件相关/3.7工作流演示/contract_entry.ms` — 合同审批入口
- `backend/data/magic-api/api/脚本演示/3插件相关/3.7工作流演示/cross_entry.ms` — 跨部门申请入口（**含跨部门填写 + 逐层驳回**）
