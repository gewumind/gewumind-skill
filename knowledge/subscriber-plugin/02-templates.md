## Subscriber 脚本常见场景模板

### 1. Redis 订阅 —— 收到消息后写库

```json
{
  "id" : "sub-redis-news-save-001",
  "groupId" : "subscriber-group-001",
  "name" : "新闻落库",
  "module" : "redis",
  "target" : "demo:news",
  "enabled" : true
}
================================
// _message = '{"title":"...","content":"..."}'
println('[Redis] 收到: ' + _message)

try {
    import('org.ssssssss.magicapi.utils.JsonUtils')
    data = JsonUtils.readValue(_message, Object)

    // 写库（带唯一约束防重复）
    db.table('news')
      .primary('id')
      .insert({
          id: data.id,
          title: data.title,
          content: data.content,
          create_date: new Date()
      })

    log.info('新闻落库成功: id={}', data.id)
} catch (e) {
    log.error('新闻落库失败: {}', e.getMessage())
}
```

### 2. Redis 订阅 —— 触发 SSE 通知

```json
{
  "id" : "sub-redis-news-sse-001",
  "groupId" : "subscriber-group-001",
  "name" : "新闻触发SSE",
  "module" : "redis",
  "target" : "demo:news",
  "enabled" : true
}
================================
println('[Redis→SSE] 收到: ' + _message)

// 解析后转发给所有订阅 /sse/news 的客户端
sse.broadcastToPath('/news', 'article', _message)
log.info('已广播给 {} 个 SSE 客户端', sse.getConnectionCount('/news'))
```

### 3. Kafka 订阅 —— 按 key 路由

```json
{
  "id" : "sub-kafka-order-001",
  "groupId" : "subscriber-group-001",
  "name" : "订单事件",
  "module" : "kafka",
  "target" : "order-events",
  "enabled" : true
}
================================
println('[Kafka] topic=' + _topic + ' key=' + _key + ' msg=' + _message)

try {
    import('org.ssssssss.magicapi.utils.JsonUtils')
    order = JsonUtils.readValue(_message, Object)

    // 按 key 路由到不同表
    if (_key == 'CREATE') {
        db.table('sys_order').primary('id').insert(order)
        log.info('订单创建: id={}', order.id)
    } else if (_key == 'UPDATE') {
        db.table('sys_order').primary('id').saveOrUpdate(order)
        log.info('订单更新: id={}', order.id)
    } else if (_key == 'DELETE') {
        db.update('delete from sys_order where id = #{id}', {id: order.id})
        log.info('订单删除: id={}', order.id)
    }
} catch (e) {
    log.error('订单处理失败: key={} msg={} err={}', _key, _message, e.getMessage())
}
```

### 4. Kafka 订阅 —— 多消费者组

```json
{
  "id" : "sub-kafka-stats-001",
  "groupId" : "subscriber-group-001",
  "name" : "统计数据",
  "module" : "kafka",
  "target" : "user-events",
  "enabled" : true
}
================================
// kafka.onMessageWithGroup 写法（在 API 里使用更灵活）
// 这里演示 subscriber 写法的简单消费
println('[Kafka] 统计消息: ' + _message)

try {
    import('org.ssssssss.magicapi.utils.JsonUtils')
    evt = JsonUtils.readValue(_message, Object)

    // 原子累加（Redis incr 更安全）
    redis.incr('stats:' + evt.eventType)
    log.info('事件 {} 累计 +1', evt.eventType)
} catch (e) {
    log.error('统计失败: {}', e.getMessage())
}
```

### 5. MQTT 订阅 —— IoT 数据采集

```json
{
  "id" : "sub-mqtt-iot-001",
  "groupId" : "subscriber-group-001",
  "name" : "IoT采集",
  "module" : "mqtt",
  "target" : "sensors/+/temp",
  "enabled" : true
}
================================
// _topic = "sensors/sensor-001/temp"（支持 + 通配）
// _message = "23.5"
println('[MQTT] device=' + _topic + ' value=' + _message)

// 解析 device id
var parts = _topic.split('/')
var deviceId = parts[1]

// 解析数值
var temp = Double.parseDouble(_message)

// 写库
db.table('sensor_data').insert({
    device_id: deviceId,
    temperature: temp,
    collect_time: new Date()
})

// 高温告警：推 SSE
if (temp > 80) {
    sse.broadcastToPath('/alerts', 'high_temp', '{"device":"' + deviceId + '","value":' + temp + '}')
    log.warn('高温告警: device={} temp={}', deviceId, temp)
}
```

### 6. 幂等写库（避免重复消费）

```json
{
  "id" : "sub-redis-dedupe-001",
  "groupId" : "subscriber-group-001",
  "name" : "幂等落库",
  "module" : "redis",
  "target" : "events:user-action",
  "enabled" : true
}
================================
println('[Redis] 收到: ' + _message)

try {
    import('org.ssssssss.magicapi.utils.JsonUtils')
    evt = JsonUtils.readValue(_message, Object)

    // Redis SETNX 做分布式锁（防重复）
    lockKey = 'processed:event:' + evt.eventId
    acquired = redis.setex(lockKey, '1', 3600)  // setex 用于设置，单纯防重推荐 setnx
    // 实际：用 redis 模块的 set 方法 + 唯一索引双重防重
    db.table('user_action_log').primary('event_id').insert({
        event_id: evt.eventId,
        user_id: evt.userId,
        action: evt.action,
        create_date: new Date()
    })
    log.info('事件落库: eventId={}', evt.eventId)
} catch (e) {
    // 唯一约束冲突 = 已处理过，跳过
    if (e.getMessage().contains('Duplicate') || e.getMessage().contains('unique')) {
        log.info('事件已处理，跳过')
        return
    }
    log.error('事件处理失败: {}', e.getMessage())
}
```

### 反模式

```javascript
// ❌ 不要 throw 不接（会被 catch 吞掉）
throw new RuntimeException('failed')

// ❌ 不要做长时间阻塞操作
Thread.sleep(60000)

// ❌ 不要忘了日志
println(...)  // println 是输出但不进 log 文件
log.info(...)  // 用 log.* 才能进日志系统

// ❌ 不要 const / let（magic-script 不支持）
const x = 1  // 报错
let j = 2    // 报错
var k = 3    // OK（也支持直接赋值：k = 3）
```
## 对应演示文件

- `3插件相关/3.1Kafka演示/3.1.1基础操作.ms` — Kafka 收发消息
- `3插件相关/3.2MQTT演示/3.2.1基础操作.ms` — MQTT 发布/订阅
- `3插件相关/3.3Redis演示/3.3.1基础操作.ms` — Redis 发布/订阅
