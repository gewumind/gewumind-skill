## mongodb 模块


**Maven 引入**：
```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-mongodb</artifactId>
</dependency>
```

**配置**（application.yaml）：
```yaml
spring:
  data:
    mongodb:
      host: localhost
      port: 27017
      database: magciaapi
      username: magciaapi
      password: 123456
```

**使用**（通过 `mongo.{db}.{collection}.{方法}` 链式访问）：
```js
import mongo;

// 插入多条
mongo.magciaapi.users.insert([
    { name: 'a', age: 18 },
    { name: 'b', age: 20 }
]);

// 插入单条
mongo.magciaapi.users.insert({ name: 'c', age: 22 });

// 查询
mongo.magciaapi.users.find({ name: 'a' }).skip(2).limit(1).list();
mongo.magciaapi.users.find({ age: { $gt: 18 } }).list();

// 修改（单条 / 多条）
mongo.magciaapi.users.update({ name: 'a' }, { name: 'A' });
mongo.magciaapi.users.updateMany({ age: 18 }, { status: 'adult' });

// 计数
mongo.magciaapi.users.count({ name: 'a' });
mongo.magciaapi.users.count();

// 删除
mongo.magciaapi.users.remove({ name: 'a' });
mongo.magciaapi.users.removeOne({ name: 'a' });
```
