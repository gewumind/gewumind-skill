## Server .ms 文件结构

每个 server 脚本是一个文件，**JSON 元数据 + 分隔符 + magic-script 源码**。存放在 `data/magic-api/server/<group>/<protocol>/<name>.ms`（如 `data/magic-api/server/服务/sse/通知推送示例.ms`）。

### ⚠ 分隔符必须带首尾 `\r\n`（铁律）

后端 `ComponentManagementController.SEPARATOR` 的定义是：

```java
private static final String SEPARATOR = "\r\n================================\r\n";
```

即 **CRLF + 32 个 `=` + CRLF**，不是裸的 32 个 `=`。后端用 `content.indexOf(SEPARATOR)` 切分文件头与源码；一旦分隔符不匹配（最常见是漏掉首尾 `\r\n`），`indexOf` 返回 `-1`，后端会把**整个文件（含 JSON 头）当成源码**返回，表现为：

- 在线编程/在线编辑里打开组件内容是一大坨 JSON，或看起来"是空的"
- `getSourceCode` / `readBody` 全部返回错内容

**凡是程序读写 `.ms`（api / component / function / task / server / subscriber / datasource / workflow），都必须用同一个常量，不要手写。**

Node 侧：

```js
const SEP = '\r\n================================\r\n'
const i = content.indexOf(SEP)
if (i < 0) throw new Error('分隔符不匹配：缺少首尾 \\r\\n')
const header = JSON.parse(content.slice(0, i))
const source = content.slice(i + SEP.length)
// 写回时：JSON.stringify(header, null, 2) + SEP + source
```

Java 侧：`content.indexOf(SEPARATOR)`，判断 `sep > -1` 再切分。

### 元数据（JSON 头）

**关键字段**（其它字段由 magic-api 控制台维护）：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | UUID，唯一标识 |
| `groupId` | string | 是 | 所属分组的 UUID |
| `name` | string | 是 | 显示名（中文友好） |
| `protocol` | string | 是 | `sse` / `ws` / `tcp` |
| `target` | string | 是 | 路径或端口：sse/ws 是 `/xxx`；tcp 是端口号字符串如 `"9000"` |
| `enabled` | boolean | 是 | 是否启用 |
| `path` | string/null | 否 | sse/ws 填 `null`；tcp 填 `null` |
| `updateBy` | string | 否 | 最后修改人 |

**示例**（SSE）：

```json
{
  "properties" : { },
  "id" : "server-sse-notify-001",
  "script" : null,
  "groupId" : "server-sse-group",
  "name" : "通知推送示例",
  "createTime" : null,
  "updateTime" : 1784787393516,
  "lock" : null,
  "createBy" : null,
  "updateBy" : "admin",
  "path" : null,
  "protocol" : "sse",
  "target" : "/notifications",
  "enabled" : true
}
================================
// 客户端连上时立刻推送 welcome 事件
println('[SSE] 客户端连接: ' + _clientId + ' @ ' + _path)
sseHelper.emit(_clientId, 'welcome', '{"msg":"hello"}')
```

**示例**（WebSocket）：

```json
{
  "id" : "server-ws-echo-001",
  "groupId" : "server-ws-group",
  "name" : "Echo示例",
  "path" : "/ws/echo",
  "protocol" : "ws",
  "target" : "/echo",
  "enabled" : true
}
================================
println('[WS Echo] 收到: ' + _message)
wsHelper.reply('Echo: ' + _message)
```

**示例**（TCP）：

```json
{
  "id" : "server-tcp-echo-001",
  "groupId" : "server-tcp-group",
  "name" : "Echo示例",
  "path" : null,
  "protocol" : "tcp",
  "target" : "9000",
  "enabled" : true
}
================================
println('[TCP Echo] 收到: ' + _message)
tcpHelper.reply('Echo: ' + _message + '\n')
```

### 同组多文件行为

- **同一 `target` 只能有一个 enabled 文件**，后注册者覆盖前者（与 magic-api 行为一致）
- 不同 target 共存不冲突（不同 path / port）

### group.json

子目录需要有 `group.json`（参考 `server/服务/sse/group.json` 等），`path` 字段是 `target` 的逻辑前缀。**直接放在 `server/` 根目录的文件无法被加载**（没有 parent group）。

### 编写原则

1. **只写 init + receive**：不要在 server 脚本里 `*.broadcast`（除非聊天室那种"接收驱动转发"场景）
2. **必须用 `try/catch` 包裹 throwable 逻辑**：脚本执行失败会被吞掉日志，必须自己 `log.warn`
3. **变量声明**：用 `var`（与现有项目一致），或直接赋值（magic-script 都支持）；**不要 `let` / `const`**
4. **不要检查 `sseHelper.emit != null`**：`emit` 是方法不是属性，`if (sseHelper.emit != null)` 会报"找不到 getEmit"
5. **回复消息必须带分隔符**（TCP）：TCP 是字节流协议，回复内容必须带 `\n` 才能让客户端按行解析
## 对应演示文件

- `3插件相关/3.4SSE演示/3.4.1推送通知.ms` — SSE 服务端结构参考
- `3插件相关/3.5TCP演示/3.5.1基础操作.ms` — TCP 服务端结构参考
- `3插件相关/3.6WebSocket演示/3.6.1基础操作.ms` — WebSocket 服务端结构参考
