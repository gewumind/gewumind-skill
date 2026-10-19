# 22 · 监听调试与三条开发路径

两件事：**① 怎么让人选对开发方式**（少走弯路），**② 监听调试这个自研能力**（magic-api 没有，生成的代码和文档都要知道它）。

---

## 1. 三条开发路径（先问用户走哪条）

生成任何产物之前，**先确认用户的开发方式**，三条路完全不同：

| 路径 | 适用 | 特征 |
|---|---|---|
| **① 导入 IDEA 改源码** | 改平台内核、加 Java 类 | 需要源码仓库；前端源码在**另一个仓库** |
| **② 下 release 在线开发** | **只做业务功能（最常见）** | 不需要 Maven / Node / IDEA；接口与页面都写 `.ms` |
| **③ 用 gewumind-skill** | 让 Agent 批量产出模块 | 需要一个**已跑起来的实例**供发布 |

### 1.1 路径 ② 是绝大多数场景的正解

只做业务功能时（写接口、写页面、加报表、审批流），**不要**建议用户去装 IDEA 拉源码——
`data/magic-api/**` 里的 `.ms` 就是源码，在线编辑器直接改，刷新即生效。

优先级：**② > ③ > ①**。只有明确要动 Java 内核时才提 ①。

### 1.2 路径 ② 的产物同样要落盘

即使在线开发，生成的产物也必须能**导出成文件**放进 `src/sql/` 等目录（见工作区布局），
否则无法版本管理、无法移交、无法在别的环境复现。

### 1.3 路径 ③ 需要一个活着的后端

`bundle_apply` 要连到运行中的实例（默认 `http://localhost:9089`）。
如果用户还没有可发布的环境，**先让他按路径 ② 跑起来**，再谈 skill。

---

## 2. 监听调试（Debug & Listen）—— 本项目独有

> ⚠️ **magic-api 官方没有这个能力。** 它是 `gewumind-boot` 内核在 magic-api 之上加的。
> 任何涉及「怎么调试」「怎么联调」的产出，都应优先推荐它。

### 2.1 它解决什么问题

magic-api 自带的调试模型是**编辑器内单次执行**：按 `Ctrl+Q` 用编辑器里的样例参数跑一遍。
但真实问题常常出在「**前端实际传了什么**」——参数没传、类型不对、被拦截器改过。

监听调试把**编辑器与真实请求链路**打通：

```
编辑器里设断点 + 点「监听调试」
        ↓
后端把这个脚本标记为「断点监听中」
        ↓
前端页面真实调用该接口
        ↓
请求被拦在断点处，编辑器里逐行执行、查看真实变量
```

### 2.2 使用步骤

1. 打开目标接口 / 订阅 / 服务端文件
2. 在代码**行号左侧空白边距**点一下设断点（出现红点）
3. 点工具栏 **「监听调试」**（图标 `debug-info`，进入后变红色 `stop`）
4. **去前端页面触发这个接口**
5. 在底部「调试信息」面板查看真实入参，`F6` 单步 / `F8` 继续
6. 再次点工具栏退出监听

### 2.3 与普通断点调试的区别

| | 普通断点（`Ctrl+Q`） | 监听调试 |
|---|---|---|
| 参数来源 | 编辑器样例参数 | **前端真实请求** |
| 适用 | 调脚本逻辑 | **前后台联调** |
| 能否手动运行 | 可以 | 进入监听后 ▶ 置灰，**不能** |

### 2.4 实现要点（供理解，不要重复造）

内核在 `/ai/api/debug` 系列端点上接管执行，前端通过三个自定义请求头传递断点信息：

```
Magic-Request-Client-Id    谁在调试
Magic-Request-Script-Id    调的是哪个脚本
Magic-Request-Breakpoints  断点行号，逗号分隔
```

支持三类资源：接口 `/ai/api/debug`、订阅 `/ai/subscriber/debug`、服务端 `/ai/server/debug`。

### 2.5 在文档与培训里怎么讲

这是**差异化卖点**，值得单独成节并配图。常见误用是「只用 `Ctrl+Q` 调试就以为联调没问题」——
生成的文档应明确区分两者。

---

## 3. 多数据源

默认发行包**只内置 MySQL 驱动**。连别的库要「加驱动 + 配数据源」：

```xml
<!-- pom.xml 加驱动，然后重新打包 -->
<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <version>42.7.3</version>
</dependency>
```

```yaml
# application.yml
gewumind:
  datasource:
    slave:
      url: jdbc:postgresql://10.0.0.9:5432/analytics
      username: postgres
      password: ...
      driver-class-name: org.postgresql.Driver
```

```javascript
db.slave.select('select 1')     // 静态指定
db[dbKey].select('select 1')    // 动态切换
```

> ⚠️ 说「支持多数据库」时要区分：**内核支持 ≠ 发行包内置**。
> 默认只有 MySQL 驱动，其他需自行加驱动重新打包。

---

## 4. 报表是 Vue 组件，不是 JSON 描述符

⚠️ **极容易搞错**。报表（`data/magic-api/component/报表示例/*.ms`）是**Vue SFC**：

```vue
<template>
    <MagicReport title="利润表" entryApi="/biz/report/profit"
                 :params="params" :columns="columns" />
</template>
<script setup>
import MagicReport from '@/components/report/MagicReport.vue'
const columns = [
    { key: 'item', title: '项目', width: 200 },
    { key: 'amount', title: '金额', align: 'right', format: 'money' }
]
</script>
```

- `entryApi` 由组件用 **`postJson`** 调用 → 后端脚本**必须用 `body` 取参**
- `format` 可选 `money` / `number` / `percent`
- 双层表头用 `columns[].children`；动态列用展开运算符拼接
- 合计用 `aggregates`，分组小计用 `groupBy`
- 导出传 `exportMeta`

详见 `knowledge/report/01-props.md`。

---

## 5. 工作流的 `workflow` 模块

发起与审批全靠这些方法，**不要自己造轮子**：

```javascript
workflow.start(processId, {initiator, title, currentNode, variables, biz})
workflow.createTask(instanceId, nodeId, nodeLabel, assignee)
workflow.findNextNode(processId, nodeId, variables, instanceId, userId, limit)
workflow.moveToNext(instanceId, nodeId, nodeLabel, assignee)
workflow.approve(taskId, userId, comment)
workflow.reject(taskId, userId, comment)   // 驳回
workflow.deny(taskId, userId, comment)     // 拒绝，流程终止
workflow.queryMyStarted(userId, processId, extra)
workflow.queryMyTasksFiltered(userId, processId, extra)
```

**最易错的一点**：`start` 时必须传 `variables: body`，
否则流程定义里 `routes[].when` 的 `variables.xxx` 取不到值，条件分支全部走不到，流程会直接结束。

详见 `knowledge/workflow/`。
