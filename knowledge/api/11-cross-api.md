## 跨接口调用完整指南

### 1. 同 magic-api 工程内调用其他 .ms

**文件式 import**（推荐）：

```javascript
// 引用 api 类型 .ms（HTTP 接口）
import '@get:/sys/user/info' as UserInfo;
import '@post:/sys/user/save' as UserSave;
import '@delete:/sys/user/delete' as UserDelete;

// 引用 function 类型 .ms（纯函数）
import '@/common/uuid' as uuid;
import '@/common/format-date' as formatDate;

// 调用
return UserInfo({ id: 1 });
// → 调用 GET /sys/user/info?id=1，返回完整 wrapper 响应
return UserSave({ id: 1, name: 'xxx' });
// → 调用 POST /sys/user/save body={id:1,name:'xxx'}
```

**函数式 import**（跨工程调用）：

```javascript
import '@get:/execute/sql' as ExecSql;
import '@post:/execute/sql' as ExecSql;
```

**命名空间**：

```javascript
// 自定义别名
import '@get:/api/v1/test' as MyApi;

// 调用时直接用别名
return MyApi({ id: 1 });
```

### 2. 通过 magic 模块调用（动态拼接路径）

```javascript
import magic;

// 调用远程接口，获取带 wrapper 的完整响应
var result = magic.call('get', '/execute/sql', { message: 'Hello' });
// → { code: 200, message: 'success', data: 'Hello', ... }

// 仅获取 data 内容
var data = magic.execute('get', '/execute/sql', { message: 'Hello' });
// → 'Hello'

// 调用其他 HTTP 方法
magic.call('post', '/execute/sql', { id: 1 });
magic.call('put', '/execute/sql', { id: 1, name: 'xxx' });
magic.call('delete', '/execute/sql', { id: 1 });
```

### 3. 调用外部 HTTP API（http 模块）

```javascript
import http;
return http.connect('http://127.0.0.1:9999/sql/select')
    .param('p1', 'v1')           // URL 参数
    .data('f1', 'v1')            // 表单参数
    .header('h1', 'v1')          // header
    .body({ id: 1, name: 'x' })  // 请求 body
    .contentType('application/json')
    .post()                       // 触发请求
    .getBody();                   // 解析 JSON

// 其他方法
.get().getBody()                  // GET
.put().getBody()                  // PUT
.delete().getBody()               // DELETE
.getString()                      // 拿字符串
.getHeaders()                     // 拿响应头
```

### 4. 调用 Spring Bean

```javascript
// Sa-Token
import 'cn.dev33.satoken.stp.StpUtil' as StpUtil;
var userId = StpUtil.getLoginId();
var token = StpUtil.getTokenValue();

// Spring Environment
import 'org.springframework.core.env.Environment' as env;
var port = env.getProperty('server.port');

// Spring Bean via @Autowired (需要 extend 自定义类)
import 'com.gewumind.boot.api.OpenAppService' as OpenAppService;
return OpenAppService.listApps();
```

### 5. 调用自定义 Java 工具类

```javascript
// Hutool
import cn.hutool.core.util.StrUtil as StrUtil;
return StrUtil.isBlank(name);
```

## 何时用哪种？

| 场景 | 推荐方式 |
|---|---|
| 调用本工程其他 .ms | `import '@{method}:{path}'`（静态、IDE 友好） |
| 调用其他 magic-api 工程的接口 | `import '@{method}:{url}'` |
| 调用外部 REST API | `import http;` |
| 调用 Spring Bean | `import 'full.Class'` |
| 路径动态拼接 | `import magic; magic.call(...)` |

