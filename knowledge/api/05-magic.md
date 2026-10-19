## http 模块（HTTP 客户端）+ magic 模块（跨接口调用）

### http 模块 — 调用外部 HTTP 服务（1.1.0+）

链式调用的 HTTP 客户端：

```javascript
import http;
return http.connect('http://localhost:9999/sql/select')
    .param('p1', 'v1')           // URL 参数
    .param({ p2: 2, p3: 3 })     // 批量 URL 参数
    .data('f1', 'v1')            // 表单参数
    .data({ f2: 2 })             // 批量表单参数
    .header('h1', 'v1')          // header
    .header({ h2: 'v2' })
    .body({ id: 1, name: 'x' })  // 请求 body
    .contentType('application/json')
    .post()                       // 触发请求：get() / post() / put() / delete()
    .getBody();                   // 拿结果（自动 JSON parse）
```

**返回 ResponseEntity，常用方法**：

| 方法 | 用途 |
|---|---|
| `.getBody()` | 获取响应 body（自动解析 JSON） |
| `.getString()` | 获取响应 body 字符串 |
| `.getHeaders()` | 获取响应头 Map |
| `.getStatus()` | 获取 HTTP 状态码 |
| `.execute()` | 通用执行方法 |

### magic 模块 — 跨 magic-api 接口调用

调用 magic-api 自己注册的其他接口：

```javascript
import magic;

// 调用另一个 .ms 接口，获取带 wrapper 的完整响应
magic.call('get', '/execute/sql', { message: 'Hello' });
// → { code: 200, message: 'success', data: ..., timestamp: ..., executeTime: ... }

// 调用另一个接口，直接获取 data（不带 wrapper）
magic.execute('get', '/execute/sql', { message: 'Hello' });
// → <return value of the .ms script>
```

### 跨 .ms 文件 import（推荐方式）

可以直接 import 其它 .ms 函数，作为本地变量使用：

```javascript
// 5.3.1调用函数.ms — 导入 function 类型 .ms
import '@/test/add' as add;
return add(1, 2);                          // 3

// 5.3.2调用其他接口.ms — 导入 api 类型 .ms
import '@get:/base/module/assert' as test;
return test();                              // 调用 GET /base/module/assert

// 调用 POST 接口
import '@post:/system/menu/save' as MenuSave;
return MenuSave({ name: '新菜单', url: '/system/test' });
```

### Spring Bean 集成（5.3.3使用Spring中的Bean.ms）

直接导入 Spring 容器中的 Bean：

```javascript
import 'org.springframework.core.env.Environment' as env;
return env.getProperty('magic-api.web');

import 'cn.dev33.satoken.stp.StpUtil' as StpUtil;
var userId = StpUtil.getLoginId();
```

## 何时用哪个？

| 场景 | 用法 |
|---|---|
| 调用其他 .ms 文件 / 接口 | `import '@{method}:{path}'` |
| 调用外部 REST API | `import http;` |
| 调用 Spring Bean（Sa-Token 等）| `import 'full.class.Name'` |
| 调用其他魔法函数 | `import '@/path/file'` |

