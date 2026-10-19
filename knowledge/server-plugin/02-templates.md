## Server 脚本常见场景模板

### 0.0 变量命名约定（重要！）

⚠️ **server 脚本里不能直接用 `ws` / `tcp` / `sse` 作为 helper 变量名**。因为 magic-script 的 `defaultImport` 机制在脚本执行时会把同名局部变量**覆盖**成模块实例，导致 `ws.reply()` 等方法找不到。

**正确做法**：
- helper 用 `wsHelper` / `tcpHelper` / `sseHelper` 接收（由 Java 层 `vars.put(...)` 注入）
- 模块公开方法用 `ws` / `tcp` / `sse`（即 defaultImport 的模块实例）

```javascript
wsHelper.reply('hi')                 // per-connection helper 方法
wsHelper.broadcast(msg)              // 同 path 广播
wsHelper.send(clientId, msg)         // 给指定 client 发

ws.getConnectionCount(_path)         // 模块方法：按 path 查总数
ws.getClientIdsByPath(_path)         // 模块方法：按 path 查 clientId 列表
ws.sendToClient(clientId, msg)       // 模块方法：发指定 client
ws.broadcastToPath(_path, msg)       // 模块方法：按 path 广播
ws.isConnected(clientId)             // 模块方法：判断是否在线
```

**helper 有什么 / 模块有什么 的对比**：

| 方法 | wsHelper | ws（模块） |
|------|:---:|:---:|
| `reply(msg)` | ✅ | ❌ |
| `broadcast(msg)` | ✅ | ❌ |
| `send(clientId, msg)` | ✅ | ❌ |
| `connectionCount()` | ✅（per-path） | ✅（全部 path） |
| `currentClientId()` | ✅ | ❌ |
| `getConnectionCount(path)` | ❌ | ✅ |
| `getClientIdsByPath(path)` | ❌ | ✅ |
| `sendToClient(clientId, msg)` | ❌ | ✅ |
| `broadcastToPath(path, msg)` | ❌ | ✅ |
| `isConnected(clientId)` | ❌ | ✅ |

`tcpHelper` / `sseHelper` 同理。

### 0. 生命周期钩子（_onConnect / _onClose）

server script 顶部声明两个**特殊变量名**，模块会自动注册并在客户端连接/断开时调用：

```javascript
// 客户端连接时触发
var _onConnect = (clientId, path) => {
    println('[Chat] 用户加入: ' + clientId)
    // 业务：写 db / 推历史消息 / 更新在线列表
}

// 客户端断开时触发
var _onClose = (clientId, path) => {
    println('[Chat] 用户离开: ' + clientId)
    // 业务：清理 session / 通知好友 / 更新最后在线时间
}

// 正常业务代码
println('[Chat] 收到消息: ' + _message)
```

维度：
- ws / sse：`path` 维度（如 `/chat/room1`、`/notifications`）
- tcp：`port:<port>` 维度（如 `port:9000`）

按 path/port 隔离，不同注册的脚本互不干扰。完整示例：
- `server/服务/ws/在线状态追踪.ms`（WebSocket）
- `server/服务/sse/在线状态追踪.ms`（SSE）
- `server/服务/tcp/在线状态追踪.ms`（TCP）

### SSE — 在线状态追踪（连接时下发 snapshot）

```javascript
// _onConnect / _onClose 同上

println('[Presence-SSE] 客户端连接: ' + _clientId)

// 推 welcome + 当前在线快照
sseHelper.emit(_clientId, 'welcome', '{"clientId":"' + _clientId + '"}')

var snapshot = '{"connections":' + sse.getConnectionCount(_path) + ',"time":' + current_timestamp() + '}'
sseHelper.emit(_clientId, 'snapshot', snapshot)
sseHelper.emit(_clientId, 'heartbeat', '{"ts":' + current_timestamp() + '}')
```

浏览器订阅：
```javascript
const es = new EventSource('/sse/presence')
es.addEventListener('welcome', e => console.log('welcome:', e.data))
es.addEventListener('snapshot', e => console.log('online:', JSON.parse(e.data)))
es.addEventListener('heartbeat', e => console.log('alive:', e.data))
// 客户端断线（关闭页面、网络断开）会自动触发 onClose 服务端
```

### TCP — 在线状态追踪（IoT 设备上下线记录）

```javascript
// _onConnect / _onClose 同上

println('[Presence-TCP] 设备连接: clientId=' + _clientId + ' @ port=' + _channel)
println('[Presence-TCP] 当前 port ' + _channel + ' 连接数: ' + tcp.getConnectionCount(Integer.parseInt(_channel)))

// TCP 必须带 \n 分隔符，客户端才能按行解析
tcpHelper.reply('{"type":"welcome","clientId":"' + _clientId + '","serverTime":' + current_timestamp() + '}\n')

if (_message != null && _message.length() > 0) {
    println('[Presence-TCP] 收到数据: ' + _message)
    tcpHelper.reply('{"type":"ack","received":"' + _message + '"}\n')
}
```

测试：
```bash
# 终端 1
nc localhost 9002

# 终端 2（开 2 个连接看 _onConnect 触发 2 次）
nc localhost 9002

# 终端 3 看实时日志
tail -f backend/logs/*.log | grep Presence
```




### 1. SSE — 通知订阅（客户端连上时下发初始状态）

```json
{
  "id" : "server-sse-news-001",
  "groupId" : "server-sse-group",
  "name" : "新闻订阅",
  "protocol" : "sse",
  "target" : "/news",
  "path" : null,
  "enabled" : true,
  "updateBy" : "admin"
}
================================
// 客户端连 /sse/news 时执行
println('[News] 订阅: ' + _clientId)

// 推 welcome 事件
sseHelper.emit(_clientId, 'welcome', '{"clientId":"' + _clientId + '"}')

// 推当前最新的 5 条新闻作为初始状态
for (var i in range(0, 5)) {
    sseHelper.emit(_clientId, 'news', '{"id":' + i + ',"title":"新闻 ' + i + '"}')
}
```

**浏览器使用**：
```javascript
const es = new EventSource('/sse/news')
es.addEventListener('welcome', e => console.log('welcome:', e.data))
es.addEventListener('news', e => {
    const item = JSON.parse(e.data)
    console.log('收到新闻:', item.title)
}
```

### 2. WebSocket — Echo 服务（最简回声）

```json
{
  "id" : "server-ws-echo-001",
  "groupId" : "server-ws-group",
  "name" : "Echo",
  "protocol" : "ws",
  "target" : "/echo",
  "path" : "/ws/echo",
  "enabled" : true
}
================================
println('[WS Echo] 收到: ' + _message)
wsHelper.reply('Echo: ' + _message)
```

**客户端使用**（`scripts/send_ws_msg.py`）：
```bash
python3 scripts/send_ws_msg.py ws://localhost:9089/ws/echo "hello"
# 服务端回复: Echo: hello
```

### 3. WebSocket — 聊天室（path 自动隔离 room）

```json
{
  "id" : "server-ws-chat-001",
  "groupId" : "server-ws-group",
  "name" : "聊天室",
  "protocol" : "ws",
  "target" : "/chat",
  "path" : "/ws/chat",
  "enabled" : true
}
================================
// _path 形如 /chat/room1
var room = _path
if (room.startsWith('/chat/')) {
    room = room.substring(6)
}
println('[Chat] room=' + room + ' 收到: ' + _message)

// 转发给同 room 客户端（path 不同自动隔离）
var chatMsg = '[' + _clientId + ' @ ' + room + '] ' + _message
wsHelper.broadcast(chatMsg)
```

### 4. TCP — IoT 数据采集（JSON 行分隔协议）

```json
{
  "id" : "server-tcp-iot-001",
  "groupId" : "server-tcp-group",
  "name" : "IoT采集",
  "protocol" : "tcp",
  "target" : "9001",
  "path" : null,
  "enabled" : true
}
================================
// 设备发 JSON 行：{"deviceId":"sensor-1","value":23.5}
var data = null
if (_message != null && _message.trim().startsWith('{')) {
    try {
        import('org.ssssssss.magicapi.utils.JsonUtils')
        data = JsonUtils.readValue(_message.trim(), Object)
    } catch (e) {
        tcpHelper.reply('{"status":"parse_error"}\n')
        return
    }
}

if (data == null || data.deviceId == null) {
    tcpHelper.reply('{"status":"missing_device_id"}\n')
    return
}

// 校验通过，回执 OK
tcpHelper.reply('{"status":"ok","deviceId":"' + data.deviceId + '"}\n')
println('[IoT] 收到: deviceId=' + data.deviceId + ' value=' + data.value)
```

### 5. TCP — Echo（带换行符）

```json
{
  "id" : "server-tcp-echo-001",
  "groupId" : "server-tcp-group",
  "name" : "Echo",
  "protocol" : "tcp",
  "target" : "9000",
  "path" : null,
  "enabled" : true
}
================================
println('[TCP Echo] 收到: ' + _message)
println('[TCP Echo] 当前连接数: ' + tcpHelper.connectionCount())
tcpHelper.reply('Echo: ' + _message + '\n')
```

### ⚠️ 反模式（不要这么写）

```javascript
// ❌ 不要检查方法是否存在（emit / broadcast 是方法不是属性）
if (sseHelper.emit != null) { sseHelper.emit(...) }
// 会报：找不到属性 emit 或者方法 getEmit、方法 isEmit

// ❌ 不要在 server 脚本里主动 broadcast（除非聊天室那种接收驱动转发）
wsHelper.broadcast('这条消息没触发原因，是 server 主动推的')
// 走 API 脚本

// ❌ TCP 不要忘记 \n
tcpHelper.reply('data without newline')  // 客户端可能收不到

// ❌ 不要 const / let（magic-script 不支持，但 var 可以）
const i = 1  // 报错
let j = 2    // 报错
var k = 3    // OK（也支持直接赋值：k = 3）
```
## 对应演示文件

- `3插件相关/3.4SSE演示/3.4.1推送通知.ms` — SSE 推送通知
- `3插件相关/3.5TCP演示/3.5.1基础操作.ms` — TCP 接收/发送
- `3插件相关/3.5TCP演示/3.5.2推送字节.ms` — TCP 推送字节
- `3插件相关/3.6WebSocket演示/3.6.1基础操作.ms` — WebSocket 基础
- `3插件相关/3.6WebSocket演示/3.6.2推送消息.ms` — WebSocket 消息推送
