## request 模块

```javascript
import request;
```

| 方法 | 说明 |
|---|---|
| `request.getHeader(name)` | 获取单个请求头 |
| `request.getHeaders(name)` | 获取 header 数组（如多个同名 Cookie） |
| `request.getIp()` | 获取客户端 IP |
| `request.getClientIP()` | 同上（考虑反向代理） |
| `request.getMethod()` | GET / POST / ... |
| `request.getUrl()` | 完整请求 URL |
| `request.getParameter(name)` | 获取请求参数 |
| `request.getBody()` | 获取原始请求体 |
| `request.getFile(name)` | 获取单个上传文件（MultipartFile） |
| `request.getFiles(name)` | 获取文件集合（List\<MultipartFile\>） |
| `request.getValues(name)` | 获取数组参数 |
| `request.get()` | 原生 HttpServletRequest |

```javascript
import request;
var file = request.getFile('image');
var ips = request.getHeaders("X-Forwarded-For");
return {
    files: file?.getSize(),
    method: request.getMethod(),
    ip: request.getClientIP()
};
```

## 请求参数访问方式

magic-api 自动将 HTTP 请求解析为以下变量：

| 变量 | 来源 | 说明 |
|---|---|---|
| `xxx` | Query string / 表单参数 | **bare 变量**，最常用 |
| `body.xxx` | 整个请求体 | POST + JSON / form-urlencoded 都可读 |
| `header.xxx` | 请求头 | `header.token`、`header.user-agent` |
| `path.xxx` | PathVariable | `/user/{id}` 中的 id |
| `param.xxx` | 同 query | 等价于 bare 变量 |

```javascript
// 前端: $common.post('/save', { id: '1', name: 'test' }, {...})
// 请求 body: id=1&name=test (form-urlencoded)

// 方式1：bare 变量（最常用）
return db.update("UPDATE user SET name = #{name} WHERE id = #{id}");

// 方式2：body 对象
return db.update("UPDATE user SET name = #{body.name} WHERE id = #{body.id}");

// 方式3：JSON body（用 postJson 发送 JSON 时只能这样）
return body.id == null ? exit(400, 'id必填') : db.update(...);
```

### parameter / requestBody JSON 元数据

可以在 JSON 头中定义参数验证规则：

```json
{
  "parameters": [
    {"name": "id", "required": true, "dataType": "String",
     "error": "id必填"},
    {"name": "age", "validateType": "pattern", "expression": "^\\d+$",
     "error": "age必须为数字"},
    {"name": "phone", "validateType": "expression",
     "expression": "phone.length() == 11",
     "error": "手机号必须 11 位"}
  ]
}
```

## 安全访问

```javascript
// body 可能为 null，先判空
var month = body == null ? null : body.month;
if (month == null) { month = '2026-07'; }

// 可选链
var ip = request?.getClientIP();
var name = body?.user?.name;   // null 时不抛异常
```

