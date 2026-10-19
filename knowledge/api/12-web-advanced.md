## Web 进阶：上传、Cookie、Header、Session

### Header

```javascript
import response;

// 设置响应头
response.setHeader('X-Token', 'xxx');
response.addHeader('Cache-Control', 'no-cache');

// 跨域相关
response.setHeader('Access-Control-Allow-Origin', '*');
```

### Cookie

```javascript
import response;

// 单个 Cookie
response.addCookie('token', 'abc', {
    path: '/',
    httpOnly: true,
    maxAge: 3600,         // 1 小时
    secure: true,          // HTTPS only
    sameSite: 'Lax'
});

// 批量 Cookie
response.addCookies({
    'user_id': { value: '123', maxAge: 86400 },
    'role': { value: 'admin', path: '/' }
}, { path: '/', httpOnly: true });
```

### 文件上传

```javascript
import request;

var file = request.getFile('image');
if (file == null) {
    exit 400, '请上传文件';
}

var size = file.getSize();
var name = file.getOriginalFilename();
var bytes = file.getBytes();

// 写到磁盘
import 'java.io.File' as File;
import 'java.io.FileOutputStream' as FileOutputStream;

var target = new File('/data/upload/' + name);
var fos = new FileOutputStream(target);
fos.write(bytes);
fos.close();

return { name: name, size: size, path: '/data/upload/' + name };
```

### 多文件上传

```javascript
var files = request.getFiles('images');
return {
    count: files.size(),
    totalSize: files.stream().map(f => f.getSize()).reduce((a, b) => a + b, 0)
};
```

### Session / Request 原生

```javascript
import request;

// 原生 HttpServletRequest
var rawReq = request.get();
var session = rawReq.getSession();
session.setAttribute('userId', '123');
var userId = session.getAttribute('userId');

// 检查 Session 是否有某个属性
if (session.getAttribute('loginUser') == null) {
    exit 401, '未登录';
}
```

### 自定义 JSON 响应

```javascript
import response;

// response.json 跳过 wrapper，直接返回 JSON
return response.json({
    success: true,
    message: '执行成功',
    data: { id: 1 }
});
```

### download

```javascript
import response;

// 文本下载
return response.download('中文内容', 'readme.txt');

// 二进制下载（bytes）
var bytes = [...];
return response.download(bytes, 'data.bin');
```

### 图片输出（验证码示例）

```javascript
import 'java.awt.image.BufferedImage' as BufferedImage;
import 'java.awt.Color' as Color;
import 'java.awt.Font' as Font;
import 'java.io.ByteArrayOutputStream' as ByteArrayOutputStream;
import 'java.util.Random' as Random;
import 'javax.imageio.ImageIO' as ImageIO;
import response;

var width = 200;
var height = 69;
var image = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
var g = image.getGraphics();
var random = new Random();

// 背景
g.setColor(new Color(255, 255, 255));
g.fillRect(0, 0, width, height);

// 文字（4位随机字符）
var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
var code = '';
g.setFont(new Font('Arial', Font.BOLD, 40));
for (var i = 0; i < 4; i++) {
    var c = chars.charAt(random.nextInt(chars.length()));
    code += c;
    g.setColor(new Color(0, 0, 0));
    g.drawString(c, 30 + i * 40, 50);
}

// 干扰线
for (var i = 0; i < 30; i++) {
    g.setColor(new Color(random.nextInt(255), random.nextInt(255), random.nextInt(255)));
    g.drawLine(random.nextInt(width), random.nextInt(height), random.nextInt(width), random.nextInt(height));
}

g.dispose();

var baos = new ByteArrayOutputStream();
ImageIO.write(image, 'png', baos);
return response.image(baos.toByteArray(), 'image/png');
```

### 渲染 HTML / 纯文本

```javascript
import response;
return response.text('<html><body>Hello</body></html>');
```

