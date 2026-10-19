## API 脚本里主动发布事件


### Redis —— 发布 + KV 操作

```javascript
// 文件：api/数据演示/Redis演示/基础操作.ms

// 1. 发布消息到频道（订阅者立即收到）
var count = redis.publish('demo:news', '{"title":"新闻1","content":"..."}')
// 返回：收到消息的订阅者数

// 2. KV 操作
redis.set('demo:name', 'Magic-Boot')
var name = redis.get('demo:name')

redis.setex('demo:code', '123456', 60)  // 60秒过期

// 3. Hash
redis.hSet('demo:user:1', 'name', '张三')
var user = redis.hGetAll('demo:user:1')

// 4. List（队列）
redis.lPush('demo:queue', 'task1')
var tasks = redis.lRange('demo:queue', 0, -1)

// 5. 自增
count = redis.incr('demo:counter')

// 6. 判断是否存在
var exists = redis.exists('demo:name')

// 7. 过期管理
var ttl = redis.ttl('demo:code')
redis.expire('demo:temp', 300)

// 8. 删除
redis.del('demo:counter')

return {
    name: name,
    user: user,
    tasks: tasks,
    exists: exists,
    ttl: ttl,
    publishCount: count,
    message: 'Redis 基础操作完成'
}
```

### Kafka —— 发送消息

```javascript
// 文件：api/数据演示/Kafka演示/基础操作.ms

// 1. 普通发送
kafka.send('order-events', '{"orderId":"123","status":"created"}')

// 2. 带 key 发送（保证同一 key 落到同一 partition，顺序消费）
kafka.sendKeyed('order-events', 'ORDER_123', '{"orderId":"123","status":"paid"}')

// 3. 批量发送
kafka.sendBatch('metrics', [
    '{"metric":"cpu","value":80}',
    '{"metric":"mem","value":60}'
])

// 4. 列出当前所有订阅
var subs = kafka.listSubscriptions()
// 返回：Map<"topic:subscriberId", "script preview">

// 5. 检查是否启用
if (!kafka.isEnabled()) {
    return { error: 'Kafka 未启用' }
}

return {
    sent: true,
    subscriptions: subs,
    message: 'Kafka 基础操作完成'
}
```

### MQTT —— 发布

```javascript
// 文件：api/数据演示/MQTT演示/基础操作.ms

// 1. 普通发布（默认 QoS 0）
mqtt.publish('sensors/sensor-001/temp', '23.5')

// 2. 指定 QoS 发布（QoS 1 = 至少一次，QoS 2 = 恰好一次）
mqtt.publishQos('sensors/sensor-001/temp', '23.5', 1)

// 3. 检查连接
if (!mqtt.isEnabled()) {
    return { error: 'MQTT 未启用' }
}

return {
    published: true,
    subscriptions: mqtt.listSubscriptions()
}
```

### 跨模块触发（API 里同时推 Redis + SSE）

```javascript
// 业务事件：订单支付成功
//   1. 写库
//   2. publish 到 Redis（其它服务可能订阅）
//   3. broadcast 给前端 SSE 客户端
var orderId = body.orderId
var status = 'paid'

// 1. 写库
db.table('sys_order').primary('id').saveOrUpdate({
    id: orderId,
    status: status,
    update_date: new Date()
})

// 2. 发 Redis 广播事件（其它服务可能订阅 order-events）
redis.publish('order-events', '{"orderId":"' + orderId + '","status":"' + status + '"}')

// 3. 推 SSE 给前端
sse.broadcastToPath('/orders', 'status_change', '{"orderId":"' + orderId + '","status":"' + status + '"}')

return {
    orderId: orderId,
    status: status,
    onlineSSEClients: sse.getConnectionCount('/orders')
}
```

### 注意事项

- **API 里 publish 后订阅者同步消费**：在同一个请求里 publish 出去，订阅者的脚本会同步执行。如果订阅者脚本超时，会影响 API 响应（建议 API 用异步线程或 fire-and-forget）
- **`redis.publish()` 返回 Long**：是订阅者数量（不是发送是否成功的标志）
- **`kafka.send()` 无返回值**：fire-and-forget；如果需要可靠性，自己写重试逻辑
- **MQTT QoS 选择**：QoS 0 = 至多一次（最快），QoS 1 = 至少一次（推荐），QoS 2 = 恰好一次（最慢）
- **跨上下文调用**：API 里也能直接用 subscriber 模块的所有方法（已实测，详见 `gewumind-boot/08-...md` §8.7.3）
## 对应演示文件

- `3插件相关/3.1Kafka演示/3.1.1基础操作.ms` — Kafka 发送消息
- `3插件相关/3.2MQTT演示/3.2.1基础操作.ms` — MQTT 发布消息
- `3插件相关/3.3Redis演示/3.3.1基础操作.ms` — Redis 发布/订阅
