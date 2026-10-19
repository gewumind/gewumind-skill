## Subscriber .ms 文件结构

每个 subscriber 脚本是一个文件，**JSON 元数据 + 分隔符 `================================` + magic-script 源码**。存放在 `data/magic-api/subscriber/<group>/<name>.ms`（如 `data/magic-api/subscriber/订阅/Redis订阅示例.ms`）。

### 元数据（JSON 头）

**关键字段**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | string | 是 | UUID |
| `groupId` | string | 是 | 所属分组的 UUID |
| `name` | string | 是 | 显示名 |
| `module` | string | 是 | `redis` / `kafka` / `mqtt` |
| `target` | string | 是 | 频道名 / topic 名 |
| `enabled` | boolean | 是 | 是否启用 |
| `path` | string | 否 | 通常是 `/<module>/<target>`，可随意 |
| `updateBy` | string | 否 | 最后修改人 |

**示例（Redis）**：

```json
{
  "id" : "subscriber-redis-demo-001",
  "groupId" : "subscriber-group-001",
  "name" : "Redis订阅示例",
  "module" : "redis",
  "target" : "demo:news",
  "path" : "/redis/demo",
  "enabled" : true
}
================================
println('[Redis] 收到: ' + _message + ' @ ' + _channel)

// 处理业务
log.info('处理消息: {}', _message)
```

**示例（Kafka）**：

```json
{
  "id" : "subscriber-kafka-demo-001",
  "groupId" : "subscriber-group-001",
  "name" : "Kafka订阅示例",
  "module" : "kafka",
  "target" : "demo-topic",
  "enabled" : true
}
================================
println('[Kafka] 收到: ' + _message + ' topic=' + _topic + ' key=' + _key)
```

**示例（MQTT）**：

```json
{
  "id" : "subscriber-mqtt-demo-001",
  "groupId" : "subscriber-group-001",
  "name" : "Mqtt订阅示例",
  "module" : "mqtt",
  "target" : "demo/topic",
  "enabled" : true
}
================================
println('[MQTT] 收到: ' + _message + ' topic=' + _topic)
```

### 同 target 行为

- 同一 `(module, target)` 只能有一个 enabled 脚本（订阅是一次性的）
- 不同 target 在同一模块下互不影响

### 调试技巧

- **修改 target / module**：保存后**重启应用**或后台点"重新订阅"
- **修改脚本内容**：保存后**自动重新注册**（订阅保留）
- **测试发布**：在 API 脚本里 `redis.publish('demo:news', 'hello')` 立即触发
- **外部测试**：
  - Redis: `redis-cli publish demo:news "hello"`
  - Kafka: `kafka-console-producer.sh --topic demo-topic --bootstrap-server localhost:9092`
  - MQTT: `mosquitto_pub -h localhost -t demo/topic -m "hello"`

### 注意事项

- **不要在脚本里 throw 异常**：会被 catch 吞掉，必须自己 `log.error`
- **避免长时间阻塞**：消息消费是同步的，单条脚本超时（默认 60s）会影响后续消息
- **大数据量消息**：建议直接写库或塞队列，不要在脚本里做复杂同步逻辑
- **跨数据库写**：建议用 `db.table('xxx').insert()` 风格（见 `database/` skill）
- **消息幂等性**：相同消息可能重复消费（Kafka 至少一次投递），写库时务必带唯一约束
- **变量声明**：用 `var`（与项目现有 `.ms` 一致），或直接赋值；**不要 `let` / `const`**
## 对应演示文件

- `3插件相关/3.1Kafka演示/3.1.1基础操作.ms` — Kafka 订阅者结构参考
- `3插件相关/3.2MQTT演示/3.2.1基础操作.ms` — MQTT 订阅者结构参考
- `3插件相关/3.3Redis演示/3.3.1基础操作.ms` — Redis 订阅者结构参考
