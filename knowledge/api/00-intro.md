## magic-api 简介

magic-api 是基于 Java 的接口快速开发框架，UI 界面编写接口自动映射为 HTTP 接口，无需 Controller/Service/Dao/Mapper/VO。

**核心特性**：
- 多数据库：MySQL、MariaDB、Oracle、DB2、PostgreSQL、SQLServer
- 非关系型：Redis、MongoDB
- 多数据源（运行时动态添加）
- SQL 缓存（自定义）
- Swagger 接口文档
- 基于 magic-script 动态编译，实时发布无需重启
- 数据库事务、SQL 拼接占位符
- 文件上传/下载/图片输出
- 脚本历史版本对比与恢复
- 自定义工具类、模块包、类型扩展

**快速开始**：
```xml
<dependency>
    <groupId>org.ssssssss</groupId>
    <artifactId>magic-api-spring-boot-starter</artifactId>
    <version>latest</version>
</dependency>
```
```properties
server.port=9999
magic-api.web=/magic/web
magic-api.resource.location=/data/${app.lang:zh}/magic-api
```
访问 `http://localhost:9999/magic/web` 即可使用。

### 项目集成约定

本项目 magic-api 版本为 2.2.2，已经在 `backend/src/main/resources/application.yml` 中配置：

```yaml
magic-api:
  web: /magic/web
  prefix: "/"
  resource:
    location: file:./data/${app.lang:zh}/magic-api
  page:
    page: current
    size: size
  response-code:
    success: 200
    invalid: 400
    exception: 500
```

**关键约定**：
- 资源文件统一存放在项目根目录的 `data/{zh,en}/magic-api/`（由 `app.lang` 选择，中文默认）
- `.ms` 文件路径 = URL 路径（结合组路径拼接）
- 内置 `admin` 用户使用 `sa-token` 鉴权（MagicAPIConfig 中已关闭 magic-api 自带登录拦截）
- 所有前端 API 调用统一经过 Vite 代理（`/api` 前缀自动剥离）

### 文件结构

```
data/zh/magic-api/
├── api/                    # 业务 REST API（前后端分离使用）
│   ├── 数据演示/            # 演示用 API（学习参考）
│   └── 系统管理/            # 真实业务 API
├── function/               # 公共函数（被 .ms 文件 import 使用）
├── server/                 # 服务管理（WS/TCP/SSE 服务端）
├── task/                   # 定时任务
├── subscriber/             # 事件订阅
└── workflow/               # 工作流
```

每个 `.ms` 文件 = **JSON 元数据** + `=========` 分隔符 + **magic-script 脚本体**：

```json
{
  "id": "uuid",
  "name": "列表",
  "path": "/list",
  "method": "POST",
  "groupId": "uuid",
  "options": [{ "name": "permission", "value": "user:view" }],
  "requestBody": "{ }"
}
================================
return db.page("""SELECT * FROM sys_user WHERE is_del = 0""")
```

### URL 拼接规则

`.ms` 文件的最终 URL 由父级 `group.json` 的 `path` + 文件自身 `path` 拼接而成：

```
group.json                path      → URL 段
api/系统管理/group.json   /system
  ├ 用户管理/group.json   /user
  │   └ 列表.ms          /list      → /system/user/list
```

### 默认响应包装

所有正常返回的脚本会自动被 wrapper 包装成：

```json
{
  "code": 200,
  "message": "success",
  "data": <脚本 return 值>,
  "timestamp": 1703000000000,
  "executeTime": 18
}
```

`exit 200, 'msg', data` 或 `exit 500, 'msg'` 可自定义 code/message。

