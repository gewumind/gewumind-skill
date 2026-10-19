## redis 模块


**Maven 引入**：
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-redis</artifactId>
</dependency>
```

**配置**：
在 gewumind-boot 配置中心中设置：
- `redis.enabled` = `true`（启用 Redis）
- `redis.config` = JSON 格式的连接参数：
```json
{
  "host": "localhost",
  "port": 6379,
  "password": "",
  "database": 0,
  "pool.max-active": 8
}
```

修改配置后 5 秒内生效，无需重启。

**使用**（magic-script 中直接调用，无需 import）：
```js
redis.set('key', 'value');
redis.setex('key', 10, 'value');  // 10 秒过期
redis.get('key');
redis.del('key');
redis.incr('counter');
redis.exists('key');
redis.expire('key', 60);
redis.ttl('key');
redis.keys('user:*');

// Hash 操作
redis.hSet('hash', 'field', 'value');
redis.hGet('hash', 'field');
redis.hGetAll('hash');
redis.hDel('hash', 'field');

// List 操作
redis.lPush('list', 'a');
redis.rPop('list');
redis.lRange('list', 0, -1);

// 发布/订阅
redis.publish('channel', 'message');  // 发布消息到频道
redis.subscribe('channel', (message) => {
    print('收到: ' + message);  // 回调函数，收到消息时触发
});
redis.unsubscribe('channel');  // 取消订阅
```

## 对应演示文件

- `3插件相关/3.3Redis演示/3.3.1基础操作.ms` — Redis 缓存基础操作
