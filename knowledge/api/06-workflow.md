## workflow 工作流模块

workflow 是系统集成的工作流引擎（类似 Activiti/Flowable），用于业务审批场景。

```javascript
import workflow;

// 检查是否启用
if (!workflow.isEnabled()) { return { success: false, message: '工作流未启用' }; }
```

### 核心操作

| 操作 | 用途 |
|---|---|
| `workflow.start(processId, options)` | 启动流程，返回 instance |
| `workflow.createTask(instId, nodeName, title, loginId)` | 创建节点任务 |
| `workflow.approve(taskId, loginId, comment)` | 审批通过 |
| `workflow.reject(taskId, loginId, comment)` | 审批驳回 |
| `workflow.deny(taskId, loginId, comment)` | 审批拒绝（终止流程） |
| `workflow.transfer(taskId, fromUser, toUser, comment)` | 转交 |
| `workflow.addSign(taskId, fromUser, toUser, comment)` | 加签 |
| `workflow.cc(taskId, fromUser, toUsers, comment)` | 抄送 |
| `workflow.moveToNext(instId, nodeName, title, assignee)` | 移动到下一节点 |
| `workflow.findNextNode(processId, currentNode, variables)` | 查找下一节点 |
| `workflow.getNodeLabel(processId, node)` | 获取节点显示名 |
| `workflow.getNodeRole(processId, node)` | 获取节点审批角色 |
| `workflow.resolveRole(roleName, initiator)` | 解析角色下的用户 |
| `workflow.updateVariables(instId, vars)` | 更新流程变量 |
| `workflow.getTask(taskId)` | 获取任务详情 |
| `workflow.getInstance(instId)` | 获取流程实例 |
| `workflow.queryMyTasksFiltered(loginId, options)` | 待办列表 |
| `workflow.queryMyStarted(loginId, options)` | 我发起的 |
| `workflow.queryHistory(instId)` | 流转历史 |
| `workflow.terminate(instId, loginId, comment)` | 终止流程 |

### 典型启动审批

```javascript
import workflow;

if (!workflow.isEnabled()) {
    exit 0, '工作流未启用';
}

var loginId = request.getParameter('loginId');
var body = request.getBody()::json;

if (action == 'start') {
    // 1. 启动流程实例
    var inst = workflow.start('leave_process', {
        initiator: loginId,
        title: body.days + '天请假',
        currentNode: 'apply',
        variables: body
    });

    // 2. 创建申请节点任务
    var task = workflow.createTask(inst.id, 'apply', '员工申请', loginId);

    // 3. 审批通过
    workflow.approve(task.id, loginId, '员工提交申请');

    // 4. 查找下一节点（基于流程图分支条件）
    var nextNode = workflow.findNextNode('leave_process', 'apply', body);
    if (nextNode == 'end' || nextNode == null) {
        workflow.moveToNext(inst.id, 'end', '结束', null);
        return { success: true, status: 'approved' };
    }

    // 5. 解析下一节点审批人
    var users = workflow.resolveRole(workflow.getNodeRole('leave_process', nextNode), loginId);
    var assignee = users.size() > 0 ? users[0] : null;

    // 6. 移动到下一节点
    workflow.moveToNext(inst.id, nextNode, nextNodeName, assignee);
}
```

