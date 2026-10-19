## response 模块

```javascript
import response;
```

| 方法 | 说明 |
|---|---|
| `response.json(value)` | 自定义 JSON 响应（不被 `wrapper` 自动包装） |
| `response.page(total, list)` | 分页响应 `{total, list}`，不被 wrapper 包装 |
| `response.download(bytes, filename)` | 文件下载响应 |
| `response.image(bytes, mimeType)` | 输出图片 |
| `response.text(str)` | 输出纯文本 |
| `response.addHeader(k, v)` | 设置响应头 |
| `response.setHeader(k, v)` | 设置响应头 |
| `response.addCookie(k, v, opts?)` | 设置 Cookie |
| `response.addCookies(cookies, opts?)` | 批量设置 Cookie |
| `response.end()` | 取消默认 JSON 输出 |

### response.json() — 自定义 JSON

跳过默认 wrapper，直接返回 JSON（不会自动套 `{code, data, ...}`）：

```javascript
import response;
return response.json({
    success: true,
    message: '执行成功',
    extra: 'extra field'
});
```

### response.page() — 模拟分页

```javascript
import response;
var total = 100;
var list = db.select('select * from sys_user limit 20');
return response.page(total, list);
// → { total: 100, list: [...] }
```

### response.download() — 文件下载

```javascript
import response;

// 文本下载
return response.download('中文测试内容', 'str.txt');

// 二进制文件
return response.download(byteArray, 'report.pdf');
```

### response.image() — 图片输出

```javascript
import 'java.awt.image.BufferedImage' as BufferedImage;
import 'java.awt.Color' as Color;
import 'java.io.ByteArrayOutputStream' as ByteArrayOutputStream;
import 'javax.imageio.ImageIO' as ImageIO;
import response;

var image = new BufferedImage(200, 69, BufferedImage.TYPE_INT_RGB);
var g = image.getGraphics();
// ... 画图 ...
var baos = new ByteArrayOutputStream();
ImageIO.write(image, "png", baos);
return response.image(baos.toByteArray(), 'image/png');
```

### response.setHeader / addCookie

```javascript
import response;
response.setHeader('X-Token', 'xxx');
response.addCookie('name', 'value', {
    path: '/',
    httpOnly: true,
    maxAge: 3600
});
```

### response.end() — 取消默认输出

```javascript
import response;
response.end();   // 不输出任何内容
```

## 自定义 code 与 exit

想要自定义 `code` / `message`，直接用 `exit`：

```javascript
// 自定义响应码
exit 200, 'success', { userId: 123 }

// 错误响应（前端会显示 res.message）
exit 500, '该应用名已存在'
exit 400, '参数错误'

// 业务校验失败
if (db.selectInt('select count(1) from sys_user where username = #{username}') > 0) {
    exit 0, '登录名称已存在'
}
```

**注意**：业务校验失败时通常用 `exit 0, 'msg'`（code=0），由前端 request.js 拦截器统一弹 `res.message`。

## 何时用 response.json() vs return obj？

| 场景 | 用法 |
|---|---|
| 默认分页/列表 | `return db.page(...)` 即可，wrapper 自动处理 |
| 标准列表（非分页） | `return { list: [...], total: N }` 即可 |
| 文件下载 | `return response.download(...)` |
| 自定义 JSON 不需要 wrapper | `return response.json(...)` |
| 二维码/验证码 | `return response.image(...)` |
| 用户自定义 code | `exit 200, 'msg', { data }` |

