## 各插件模块统一规范

所有插件模块（redis/kafka/mqtt/sse/tcp/ws）都遵循同一个模式：

```javascript
// 1. 先 import
import redis;   // 或 kafka, mqtt, ws, tcp, sse

// 2. 检查是否启用
if (!redis.isEnabled()) {
    exit 0, 'Redis 未启用';
}

// 3. 调用方法
redis.set('key', 'value');
```

### 配置中心

所有插件通过 `sys_configure` 表或 application.yml 配置管理开关和参数。在脚本中使用 `env.get('xxx')` 读取。

### Redis 模块

```javascript
import redis;

if (!redis.isEnabled()) { exit 0, 'Redis 未启用'; }

// String
redis.set('key', 'value');
redis.setex('key', 60, 'value');   // 60秒过期
var v = redis.get('key');

// Hash
redis.hSet('hash', 'field', 'value');
var h = redis.hGet('hash', 'field');
var all = redis.hGetAll('hash');

// List
redis.lPush('list', 'v1', 'v2');
var range = redis.lRange('list', 0, -1);

// Pub/Sub
redis.publish('channel', 'message');

// 通用
redis.exists('key');
redis.ttl('key');
redis.del('key', 'key2');
```

### Kafka 模块

```javascript
import kafka;

if (!kafka.isEnabled()) { exit 0, 'Kafka 未启用'; }

// 发送消息
kafka.send('topic', 'message');
kafka.sendKeyed('topic', 'key', 'message');
kafka.sendBatch('topic', [
    {key: 'k1', value: 'v1'},
    {key: 'k2', value: 'v2'}
]);
```

### MQTT 模块

```javascript
import mqtt;

if (!mqtt.isEnabled()) { exit 0, 'MQTT 未启用'; }

mqtt.publish('topic/sub', 'message');
mqtt.publishQos('topic/sub', 'message', 2);   // QoS 0/1/2
```

### WebSocket 模块

```javascript
import ws;

if (!ws.isEnabled()) { exit 0, 'WebSocket 未启用'; }

ws.broadcastToPath('/ws/users', { msg: 'hello' });
ws.sendToClient('clientId123', { msg: 'private' });
var count = ws.getConnectionCount('/ws/users');
var ids = ws.getClientIdsByPath('/ws/users');
```

### TCP 模块

```javascript
import tcp;

if (!tcp.isEnabled()) { exit 0, 'TCP 未启用'; }

tcp.broadcastToPort(9000, 'hello');
tcp.sendToClient('clientId', 'data');
var count = tcp.getConnectionCount(9000);
var ids = tcp.getClientIdsByPort(9000);
```

### SSE 模块（Server-Sent Events）

```javascript
import sse;

if (!sse.isEnabled()) { exit 0, 'SSE 未启用'; }

sse.broadcastToPath('/sse/news', 'event-name', { data: 'hello' });
var count = sse.getConnectionCount('/sse/news');
```

