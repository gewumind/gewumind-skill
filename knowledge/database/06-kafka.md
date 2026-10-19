## kafka 模块


**Maven 引入**：
```xml
<dependency>
    <groupId>org.apache.kafka</groupId>
    <artifactId>kafka-clients</artifactId>
</dependency>
```

**配置**：
在 gewumind-boot 配置中心中设置：
- `kafka.enabled` = `true`
- `kafka.config` = JSON 格式的连接参数：
```json
{
  "bootstrap-servers": "localhost:9092",
  "producer.acks": "all",
  "producer.retries": 3,
  "consumer.group-id": "gewumind-boot",
  "consumer.auto-offset-reset": "latest"
}
```

修改配置后 5 秒内生效，无需重启。

**使用**（magic-script 中直接调用，无需 import）：
```js
// 发送消息
kafka.send('my-topic', 'hello');

// 带 Key 发送（相同 Key 的消息进同一分区）
kafka.sendKeyed('orders', 'order-001', '{"id":1}');

// 批量发送
kafka.sendBatch('events', [
    {key: 'a', value: '...'},
    {key: 'b', value: '...'}
]);

// 订阅消费（异步，后台线程持续拉取）
kafka.subscribe('my-topic', function(msg){
    println('收到: ' + msg);
});

// 指定消费者组订阅
kafka.subscribeWithGroup('my-topic', 'my-group', function(msg){
    db.insert('into event_log(content) values(?)', [msg]);
});

// 取消订阅
kafka.unsubscribe('my-topic');
```

## 对应演示文件

- `3插件相关/3.1Kafka演示/3.1.1基础操作.ms` — Kafka 消息队列基础操作
