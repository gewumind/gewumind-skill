## Server 主动推送 —— 走 API 脚本


### API 调用方式

```javascript
// SSE —— 广播给同 path 所有客户端
sseHelper.broadcastToPath('/notifications', 'alert', '{"msg":"新订单"}')

// SSE —— 给指定 client
sseHelper.emitToClient(clientId, 'notice', '{"content":"..."}')

// WS —— 广播给同 path 所有客户端
wsHelper.broadcastToPath('/chat/room1', '{"msg":"系统通知"}')

// WS —— 给指定 client
wsHelper.sendToClient(clientId, '{"type":"private"}')

// TCP —— 广播给同 port 所有客户端
tcpHelper.broadcastToPort(9000, '{"alert":"高温"}\n')

// TCP —— 给指定 client
tcpHelper.sendToClient(clientId, 'PING\n')
```

### 查询状态

```javascript
// 连接数（按 path / port）
count = sse.getConnectionCount('/notifications')
count = ws.getConnectionCount('/push')
count = tcp.getConnectionCount(9000)

// 列出所有 clientId
ids = sse.getClientIdsByPath('/notifications')     // List<String>
ids = ws.getClientIdsByPath('/push')               // List<String>
ids = tcp.getClientIdsByPort(9000)                 // List<String>
```

### 示例：API 收到 HTTP 请求后推送 SSE 通知

文件位置：`api/数据演示/SSE演示/推送通知.ms`

```json
{
  "id" : "demo-sse-push-001",
  "groupId" : "demo-sse-group-001",
  "name" : "推送通知",
  "method" : "POST",
  "path" : "/sse/send",
  "parameters" : [
    { "name" : "event", "type" : "requestBody", "dataType" : "String" },
    { "name" : "data",  "type" : "requestBody", "dataType" : "String", "required" : true }
  ]
}
================================
var eventName = body.event ?: 'message'
var payload = body.data ?: '{}'

// 广播给所有订阅 /notifications 的客户端
sseHelper.broadcastToPath('/notifications', eventName, payload)

return {
    success: true,
    onlineClients: sse.getConnectionCount('/notifications'),
    message: '已广播到 ' + sse.getConnectionCount('/notifications') + ' 个客户端'
}
```

### 示例：HTTP 触发推送时同时给单个 client 发

```javascript
var target
if (body.clientId != null && body.clientId.length() > 0) {
    wsHelper.sendToClient(body.clientId, body.data)
    target = body.clientId
} else {
    wsHelper.broadcastToPath(body.path ?: '/push', body.data)
    target = 'broadcast:' + (body.path ?: '/push')
}

return {
    target: target,
    onlineClients: ws.getConnectionCount(body.path ?: '/push')
}
```

### 示例：TCP 设备管理（API 推指令给指定设备）

```javascript
var clients = tcp.getClientIdsByPort(9001)

if (body.clientId == null || body.clientId.length() == 0) {
    return { error: '请指定 clientId', availableClients: clients }
}

var cmd = body.cmd ?: 'PING'
tcpHelper.sendToClient(body.clientId, cmd + '\n')

return {
    clientId: body.clientId,
    cmd: cmd,
    sent: true
}
```

### 注意事项

- **同一时刻只能有一个脚本监听同一 target**：sse/ws 同 path 或 tcp 同 port 后注册者覆盖前者
- **TCP 9000 端口示例 vs IoT 示例冲突**：两个 enabled 文件不能共用同一端口，要测哪个就把另一个 `enabled: false`
- **WS 协议路径前缀**：客户端连 `ws://host:9089/ws/<target>`，脚本里 `_path` 是去掉 `/ws` 之后的路径
- **TCP 9001 端口被占用时启动失败**：检查 `tcp.config` / `target` 字段不要冲突
## 对应演示文件

- `3插件相关/3.4SSE演示/3.4.1推送通知.ms` — SSE 向订阅客户端推送通知
- `3插件相关/3.5TCP演示/3.5.2推送字节.ms` — TCP 推送字节数据
- `3插件相关/3.6WebSocket演示/3.6.2推送消息.ms` — WebSocket 推送消息
