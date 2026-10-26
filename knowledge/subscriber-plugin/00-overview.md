## Subscriber 插件（redis / kafka / mqtt）总览


### 三种协议

| 协议 | 文件路径 | target 含义 | 配置文件项 |
|------|---------|-----------|----------|
| `redis` | `data/zh/magic-api/subscriber/订阅/<name>.ms` | redis 频道名（如 `demo:news`） | `redis.enabled` + `redis.config` (JSON) |
| `kafka` | `data/zh/magic-api/subscriber/订阅/<name>.ms` | kafka topic 名（如 `demo-topic`） | `kafka.enabled` + `kafka.config` (JSON) |
| `mqtt` | `data/zh/magic-api/subscriber/订阅/<name>.ms` | mqtt topic（如 `demo/topic`） | `mqtt.enabled` + `mqtt.config` (JSON) |

### 启用条件

- `redis.enabled = true` —— 启用 Redis 模块，`addDefaultImport("redis", this)` 把 `redis` 注入全局
- `kafka.enabled = true` / `mqtt.enabled = true` —— 同上

启用后**任何脚本上下文（api / server / subscriber / function）都能用 `redis.*` / `kafka.*` / `mqtt.*`**。

### 设计原则

- **Subscriber 脚本 = 事件消费者**：每次目标收到消息，整个脚本被执行一次
- **API 也能主动发布**：在 API 脚本里 `redis.publish('topic', 'msg')` 让其它订阅者立即收到
- **API 能用全部 KV/消息方法**：`redis.get/set/lpush/hgetall/...` 在 API 脚本里直接可用

### Subscriber 触发流程

```
事件源（Redis pub / Kafka producer / MQTT broker）
  ↓ 收到消息
模块的 message listener 回调
  ↓ 调 SubscriberMagicDynamicRegistry.execute()
  ↓ 创建 MagicScriptContext + 注入 _message/_topic/_channel + 模块实例
ScriptManager.executeScript(script, ctx)
  ↓ 整个脚本跑一遍
返回 / 异常被 catch 吞掉
```

注意：`SubscriberMagicDynamicRegistry.execute()` 用 `try/catch` 包裹脚本执行，**异常只记日志不抛**，所以脚本必须自己 `log.error` 排查问题。

### 三个模块 API 对照

| 操作 | redis | kafka | mqtt |
|------|-------|-------|------|
| **发布（API 调用）** | `redis.publish(channel, msg)` | `kafka.send(topic, msg)` | `mqtt.publish(topic, msg)` |
| **批量发布** | — | `kafka.sendBatch(topic, list)` | `mqtt.publishQos(topic, msg, qos)` |
| **带 key 发布** | — | `kafka.sendKeyed(topic, key, msg)` | — |
| **手动订阅（API）** | `redis.onMessage(channel, lambda)` | `kafka.onMessage(topic, lambda)` | `mqtt.onMessage(topic, lambda)` |
| **取消订阅（API）** | `redis.unsubscribe(channel)` | `kafka.unsubscribe(topic)` | `mqtt.unsubscribe(topic)` |
| **全部取消** | `redis.unsubscribeAll()` | `kafka.unsubscribeAll()` | `mqtt.unsubscribeAll()` |
| **列出订阅** | `redis.listSubscriptions()` | `kafka.listSubscriptions()` | `mqtt.listSubscriptions()` |
| **是否启用** | `redis.isEnabled()` | `kafka.isEnabled()` | `mqtt.isEnabled()` |

### Redis 额外 KV 方法（API 脚本里直接用）

| 方法 | 用途 |
|------|------|
| `redis.get(key)` / `set(k, v)` / `del(k)` | 字符串 |
| `redis.setex(k, v, seconds)` | 带过期 |
| `redis.exists(k)` / `expire(k, sec)` / `ttl(k)` | 元信息 |
| `redis.incr(k)` | 自增 |
| `redis.keys(pattern)` | 模式匹配 |
| `redis.hGet/hSet/hGetAll/hDel` | Hash |
| `redis.lPush/rPop/lRange` | List |

### Subscriber 脚本可用的内置变量

| 变量 | redis | kafka | mqtt |
|------|-------|-------|------|
| `_message` | ✅ 收到的消息内容 | ✅ 消息内容 | ✅ 消息内容 |
| `_channel` | ✅ redis 频道 | ❌ | ❌ |
| `_topic` | ❌ | ✅ kafka topic | ✅ mqtt topic |
| `_key` | ❌ | ✅ kafka key | ❌ |
| 模块对象 | `redis` | `kafka` | `mqtt` |
## 对应演示文件

- `3插件相关/3.1Kafka演示/3.1.1基础操作.ms` — Kafka 消息队列
- `3插件相关/3.2MQTT演示/3.2.1基础操作.ms` — MQTT 物联网协议
- `3插件相关/3.3Redis演示/3.3.1基础操作.ms` — Redis 缓存操作
