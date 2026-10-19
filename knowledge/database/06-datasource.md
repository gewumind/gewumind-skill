## 多数据源 / 多数据库


### 三种配置方式

#### 1. 后台代码配置（推荐）

```java
@Bean
public MagicDynamicDataSource magicDynamicDataSource() {
    MagicDynamicDataSource dynamicDataSource = new MagicDynamicDataSource();
    dynamicDataSource.setDefault(ds1);  // 设置默认数据源
    dynamicDataSource.add("slave", ds2);
    dynamicDataSource.add("report", ds3);
    return dynamicDataSource;
}
```

#### 2. application.yml 配置

```yaml
magic-api:
  datasource:
    driver-class-name: com.mysql.cj.jdbc.Driver
    url: jdbc:mysql://localhost:3306/db1
    username: root
    password: xxx

    slave:
      driver-class-name: com.mysql.cj.jdbc.Driver
      url: jdbc:mysql://localhost:3306/db2
      username: root
      password: xxx
```

#### 3. 运行时通过 magic-api 后台界面在线配置

直接在 `/magic/web` 后台添加数据源，无需重启。

### 三种切换方式

```javascript
// 1. 点语法（key 必须是合法 Java 标识符）
return db.slave.select('select * from logs')
return db.report.select('select * from monthly_report')

// 2. 中括号语法（key 可以是变量）
db['db1'].select('sql')
var dbKey = 'db2'
db[dbKey].select('sql')

// 3. 默认数据源
db.select('select * from sys_user')   // 不写 key = 默认
```

`db.{name}.xxx` 等同默认 `db.xxx`，可链式调用所有 `db` 方法（`page`、`update`、`transaction`、`cache`、`camel`...）。

### 多数据源 + 链式 API

```javascript
// 在指定数据源上用链式 API
return db.slave.table('sys_user').select()

// 在指定数据源上分页
return db.report.table('monthly_report').page()

// 在指定数据源上 where
return db.slave.table('sys_user')
    .where()
    .like('user_name', '%李富贵%')
    .eq('role', 'admin')
    .select()
```

### 列名命名转换

支持的命名风格：
- `normal` — 保持原样
- `camel` — 驼峰（user_name → userName）
- `pascal` — 帕斯卡（UserName）
- `upper` — 全大写（USER_NAME）
- `lower` — 全小写（user_name）

```javascript
return db.camel().select('select user_name from sys_user')   // [{userName: '李富贵'}]
return db.upper().select('...')
return db.lower().select('...')
return db.pascal().select('...')
return db.default().select('...')
```

**全局配置**（`application.yml`）：
```yaml
magic-api:
  sql-column-case: camel
```

### 多数据源 + 缓存

每个数据源独立缓存：

```javascript
db.cache('user_list', 60000).select('select * from sys_user')
db.slave.cache('user_list', 60000).select('select * from sys_user')
// 两者互不影响
```

### 多数据源 + 事务

事务会自动绑定到当前数据源。**跨数据源事务需要 JTA**，普通 `@Transactional` 不支持：

```javascript
var result = db.transaction(() => {
    var a = db.slave.update('...')   // 提交到 slave
    var b = db.report.update('...')  // 提交到 report
    return [a, b]
})
```

### 存储过程

```javascript
// db.call 支持完整入参 + 出参（官方推荐）
var cs1 = body.cs1
var cs2 = body.cs2
return db.call("""
    call test(#{cs1}, @{height(cs2), INTEGER}, @{v_area, VARCHAR})
""")
/**
返回值形如：
{
    height: 10,
    v_area: "16.85"
}
*/

// 参数语法：
// #{param}                        入参
// @{param, Types.VARCHAR}         出参（Types 是 java.sql.Types 常量字符串）
// @{param(value), Types.VARCHAR}   既是入参也是出参

// db.update("call ...") 只能调用无出参的存储过程
return db.update("call produce_name(#{param1}, #{param2})")
```

### 适用场景

| 场景 | 推荐方案 |
|------|---------|
| 读写分离 | `db`（写）+ `db.slave`（读） |
| 多业务库隔离 | `db.billing` / `db.user` / `db.report` |
| 多租户 | `db[tenantKey]` 动态切换 |
| 跨库查询 | 依赖 DB 层（dblink / federated） |

### 安全注意

```javascript
// ❌ 危险：用户输入的 dbKey 直接访问
var dbKey = body.dbKey
return db[dbKey].select('select 1')  // 可能访问未授权数据源

// ✅ 白名单校验
var dbKey = body.dbKey
var allowed = ['default', 'slave', 'report']
if (!allowed.contains(dbKey)) {
    exit 400, '非法的数据源'
}
return db[dbKey].select('select 1')
```
## 对应演示文件

- `1数据库操作/1.4其它/1.4.1动态切换数据源.ms` — db[变量] 动态切换
- `1数据库操作/1.4其它/1.4.2使用其它数据源操作.ms` — db.slave.select() 按 Key 切换
- `1数据库操作/1.4其它/1.4.3转换列名命名方式.ms` — db.camel() 驼峰转换
- `1数据库操作/1.4其它/1.4.4使用缓存.ms` — db.cache().select() SQL 缓存
