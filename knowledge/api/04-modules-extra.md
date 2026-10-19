## log / env / assert 模块

### log 模块（SLF4J 风格）

magic-api 2.2.2 中 `log` 是内置模块（无需 import）。

```javascript
import log;

// info/warn/debug/error
log.info('用户登录: {}', username);
log.warn('警告信息');
log.debug('debug 内容');
log.error('出错了');

// error 接收异常对象，自动打印堆栈
try {
    db.update('...');
} catch(e) {
    log.error('保存失败', e);
}

// println() 直接打印到 stdout（脚本开发时调试用）
println('当前变量:', { id: 1, name: 'test' });
```

**格式化占位符 `{}`**：

```javascript
log.info('查询用户 id={}, name={}', 123, '张三');
// 19:23:45.123 [main] INFO - 查询用户 id=123, name=张三
```

### env 模块（0.4.6+）

读取 Spring Boot 配置项：

```javascript
import env;

// 读取 application.yml 配置
var port = env.get('server.port');
var dbUrl = env.get('spring.datasource.url');
var active = env.get('spring.profiles.active');

// 带默认值
var mode = env.get('app.mode', 'default');

// 类型转换（env.get 总返回 String）
var portNum = env.get('server.port')::int;
```

### assert 断言

**magic-script `assert` 是语法特性，不是模块**——失败时直接 `exit code, msg`：

```javascript
// ===== 单条件 =====
assert id != null : 400, 'id不能为空';

// ===== 多条件（&&）=====
assert email != null && email.contains("@") : 400, '邮箱格式不正确';

// ===== 简化形式（code 默认 1）=====
assert name != '' && name != null : '名称不能为空';

// ===== 无代码（异常终止但响应为 500）=====
assert age >= 18;
```

**等价于 `if + exit`**：

```javascript
if (!(age >= 18)) {
    exit 400, '年龄必须 >= 18'
}
```

### 业务校验常用模式

#### 方式1：if + exit（最常用）

```javascript
var count = db.selectInt("select count(1) from sys_user where is_del = 0 and username = #{username} ?{id, and id != #{id}}");
if (count > 0) {
    exit 0, '登录名称已存在';
}
```

#### 方式2：assert 一行式

```javascript
assert app_name != null && app_name != '' : 0, '应用名称不能为空'
assert app_key != null && app_key != '' : 0, 'AppKey 不能为空'

if (!id || id == '') {
    exit 0, 'id 不能为空'
}
```

#### 方式3：JSON 元数据校验（自动）

在 `.ms` 文件头部声明：

```json
{
  "parameters": [
    {"name":"id","required":true,"error":"id必填"},
    {"name":"age","validateType":"pattern","expression":"^\\d+$","error":"age必须为数字"}
  ]
}
```

参数校验失败时自动返回错误，不会执行脚本。

