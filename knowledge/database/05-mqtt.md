## mqtt 模块


**Maven 引入**：
```xml
<dependency>
    <groupId>org.eclipse.paho</groupId>
    <artifactId>org.eclipse.paho.mqttv5.client</artifactId>
    <version>1.2.5</version>
</dependency>
```

**配置**：
在 gewumind-boot 配置中心中设置：
- `mqtt.enabled` = `true`
- `mqtt.config` = JSON 格式的连接参数：
```json
{
  "broker": "tcp://localhost:1883",
  "client-id": "gewumind-boot",
  "username": "",
  "password": "",
  "timeout": 30,
  "keepalive": 60
}
```

修改配置后 5 秒内生效，无需重启。

**使用**（magic-script 中直接调用，无需 import）：
```js
// 发布消息
mqtt.publish('topic/test', 'hello');
mqtt.publishQos('topic/important', '重要消息', 2);

// 订阅消息（异步回调）
mqtt.subscribe('topic/+/status', function(msg){
    db.update('update device set status = ?', [msg]);
});

// 取消订阅
mqtt.unsubscribe('topic/+/status');
```

## 对应演示文件

- `3插件相关/3.2MQTT演示/3.2.1基础操作.ms` — MQTT 物联网协议基础操作
