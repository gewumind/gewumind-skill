## Server 插件（ws / tcp / sse）总览


### 三种协议

| 协议 | 默认端口 | 文件路径 | 客户端连接示例 |
|------|---------|---------|---------------|
| `sse` | 跟随 Spring Boot（9089） | `data/zh/magic-api/server/服务/sse/<name>.ms` | `new EventSource('/sse/<target>')` |
| `ws` | 跟随 Spring Boot（9089） | `data/zh/magic-api/server/服务/ws/<name>.ms` | `new WebSocket('ws://host:9089/ws/<target>')` |
| `tcp` | 文件 `target` 字段（字符串数字） | `data/zh/magic-api/server/服务/tcp/<name>.ms` | `nc host <port>` |

### 启用条件

配置中心（`sys_configure` 表）：
- `sse.enabled = true`
- `ws.enabled = true`
- `tcp.enabled = true`

启用后 `addDefaultImport("sse", this)` / `("ws", this)` / `("tcp", this)` 会把对应模块注册为 magic-script **全局 defaultImport**，**任何脚本上下文（api / server / subscriber / function）都能用**。

### 设计原则：server 脚本只做 init + receive

- ✅ 客户端连接时的初始化（welcome 消息 / 握手 / 鉴权）
- ✅ 接收客户端发来的数据并用 `*.reply(...)` 回执
- ❌ **不要**在 server 脚本里主动 `broadcast` / `send` 给其他客户端 —— 主动推送走 API 脚本

主动推送（系统通知、订单告警、进度更新）请用 `api/数据演示/{SSE,WebSocket,TCP}演示/推送通知.ms` 等 API 入口，在 API 里调：

```javascript
sseHelper.broadcastToPath('/notifications', 'alert', '{"msg":"..."}')
wsHelper.broadcastToPath('/push', 'hello')
tcpHelper.broadcastToPort(9000, 'PING\n')
```

例外场景：`ws/聊天室示例.ms` 这种"收到消息后转发到同 room" 的逻辑可以保留 `wsHelper.broadcast`，因为它属于"接收驱动的群发"，不是主动推送。

### 三个模块公开方法对比

| 操作 | sse | ws | tcp |
|------|-----|-----|-----|
| 给当前连接回执 | `sseHelper.emit(_clientId, event, data)` | `wsHelper.reply(msg)` | `tcpHelper.reply(msg)` |
| 同 path / port 广播 | `sseHelper.broadcast(event, data)` | `wsHelper.broadcast(msg)` | `tcpHelper.broadcast(msg)` |
| 给指定 client 发 | `sseHelper.emit(clientId, event, data)` | `wsHelper.send(clientId, msg)` | `tcpHelper.send(clientId, msg)` |
| 当前连接数 | `sseHelper.connectionCount()` | `wsHelper.connectionCount()` | `tcpHelper.connectionCount()` |
| 当前 clientId | `sseHelper.currentClientId()` | `wsHelper.currentClientId()` | `tcpHelper.currentClientId()` |
| 当前 path / port | `_path` | `_path` | `_channel` (字符串) |
| 当前消息 | — （sse server 只在连接时触发，无 message） | `_message` | `_message` |

### 客户端标识符

| 协议 | clientId 格式 | 来源 |
|------|--------------|------|
| sse | UUID（服务端生成） | `SseServerModule.handleConnect` |
| ws | Spring `WebSocketSession.getId()` | `WebSocketEndpoint.handleTextMessage` |
| tcp | Netty `Channel.id().asLongText()` | `TcpHandler.channelRead` |
## 对应演示文件

- `3插件相关/3.4SSE演示/3.4.1推送通知.ms` — SSE Server-Sent Events
- `3插件相关/3.5TCP演示/3.5.1基础操作.ms` — TCP 基础操作
- `3插件相关/3.5TCP演示/3.5.2推送字节.ms` — TCP 推送字节数据
- `3插件相关/3.6WebSocket演示/3.6.1基础操作.ms` — WebSocket 基础操作
- `3插件相关/3.6WebSocket演示/3.6.2推送消息.ms` — WebSocket 推送消息
