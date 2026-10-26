## magic-api Function（后端函数）

`function` 是 magic-api 的三种脚本类型之一，跟 `api`（REST）和 `task`（定时任务）并列。**核心区别：function 是被其他 .ms 通过函数名调用的，不是通过 HTTP URL**。

---

### 优先复用系统已有 function

> **gewumind-boot 系统内置了一批通用 function**。在写新 function 之前必须调 `listScripts(kind='function')` 查看已有函数，能复用的直接调用。

**系统已部署的 function 清单**：

| 函数名 | 调用方式 | 返回 | 用途 |
|--------|----------|------|------|
| `getBykey(key)` | `var v = getBykey("app.name")` | String | 从 `sys_configure` 查配置值 |
| `getBykeyAndCondition(key, condition)` | `getBykeyAndCondition("cfg_key", "is_del=0")` | String | 带条件查配置 |
| `getBykeyLikeCondition(key, condition)` | `getBykeyLikeCondition("cfg_%", "is_del=0")` | String | 模糊查配置 |
| `office()` | `var userIds = office()` | List\<String\> | 获取当前用户**可见的用户 ID 列表**（按组织权限过滤） |

**规则**：
1. **写 API 前**先调 `listScripts(kind='function')` 确认现有 function
2. **所有配置查询**必须用 `getBykey()` 族函数，而不是直接查 `sys_configure` 表
3. **所有列表 API**的 org 过滤必须用 `office()` 获取用户范围
4. 只有系统没有的 function 才新建（如 MQTT 发送、内容服务等业务相关）
5. ❌ 禁止创建与系统 function 功能重复的脚本（如自己再写一个"根据key获取数据值"）

---

### 必须创建：获取当前用户组织机构 function

> 每个项目都**必须**有一个 `获取当前用户组织机构` 的 function，供所有列表 API 查询当前用户所属组织。

```json
{
  "name": "获取当前用户组织机构",
  "path": "/getCurrentUserOffice",
  "description": "获取当前登录用户的组织机构信息",
  "parameters": [],
  "returnType": "Map<String,Object>"
}
========================
import 'cn.dev33.satoken.stp.StpUtil';

var currentUserId = StpUtil.getLoginId()
return db.selectOne("""
    select so.id, so.name, so.code, so.type, so.pid
    from sys_user su
    left join sys_office so on su.office_id = so.id
    where su.id = #{currentUserId} and su.is_del = 0
""")
```

> 在其他 .ms 中调用：`var org = getCurrentUserOffice()` → 返回 `{ id, name, code, type, pid }`。后续 API 可通过 `org.id` 作为 `office_id` 默认参数传给查询。

---

### 适用场景

**核心定位：function 就是后端 utils 工具层**。跟前端 `src/utils/` 一个性质：
- 写新 API / task 前 → `listFunctions` 看有没有现成的
- 多个 API 重复的逻辑 → 抽成 function
- 复杂缓存 / 第三方调用（mqtt/redis/smtp） → 封到 function

**例子**：
- **跨 .ms 复用代码**：多个 API 都要查 sys_configure，抽到 `function/配置中心/根据key获取数据值.ms`
- **缓存 + 复杂计算**：先 `db.cache()` 再 return，避免每次 HTTP 请求都查 DB
- **绕过 HTTP 直接调用**：在另一个 .ms 里 `var v = getBykey('xxx')` 直接拿结果，比 HTTP 快 10x
- **第三方服务封装**：`function/mqtt/发布消息.ms`、`function/smtp/发送邮件.ms`，API 调 `var ok = mqttPublish(topic, msg)`

**反例（不要用 function）**：
- 前端要调的接口 → 用 `api`（走 HTTP 才有 URL）
- 定时跑的任务 → 用 `task`（function 不会自动调度）
- 单个 API 内部逻辑 → 直接写在 API 脚本里

---

### 标准模式：创建通用函数 + 多个 API 复用

**场景**：设备状态变化时，3 个 API（设备上线、设备离线、设备告警）都要发 mqtt 通知 + 写日志。

**❌ 错误做法**：3 个 API 各自调 mqtt SDK，代码重复
**✅ 正确做法**：抽成 function，3 个 API 调用

**步骤**：
1. `listFunctions()` — 查是否已有 mqtt function（"发消息"），没就建
2. `generateMagicScript(kind='function', ...)` 创建 `function/mqtt/发布消息.ms`：
   ```
   name=发布消息
   path=/mqttPublish
   parameters=[{name:'topic',dataType:'String',...}, {name:'payload',dataType:'String',...}]
   returnType=Boolean
   script=var client = mqtt.connect('tcp://broker:1883'); client.publish(#{topic}, #{payload}); return true
   ```
3. 3 个 API 的 .ms 里统一调 `var ok = mqttPublish('device/status/online', JSON.stringify(row))`
4. 改 mqtt broker 地址 → 只改 1 个 function，不用改 3 个 API

**何时该抽 function**（自我审查清单）：
- 同样的逻辑在 ≥ 2 个 .ms 里出现 → 抽
- 第三方 SDK 调用（mqtt/redis/smtp/oss） → 必须抽
- 复杂 SQL 联表（多表 join + 缓存） → 抽
- 单次使用的工具逻辑 → 不用抽

**抽取后的好处**：
- 改 mqtt broker 不用改 3 个 API
- function 可以单测（不依赖 HTTP）
- function 内部可以加 cache 减少 DB 查询

| 字段 | api | function | task |
|---|---|---|---|
| `method` | POST/GET/... | ❌（无） | ❌（无） |
| `options[]`（含 permission） | ✓ | ❌ | ❌ |
| `requestBody` / `responseBody` | ✓ | ❌ | ❌ |
| `headers` / `paths` | ✓ | ❌ | ❌ |
| `parameters[]`（参数） | ✓ | **✓** | ❌ |
| `description` | ❌ | **✓** | ✓ |
| `returnType` | ❌ | **✓**（"String" / "Map"） | ❌ |
| `mappingPath` | ❌ | **✓**（Java 后端方法路径） | ❌ |
| `cron` | ❌ | ❌ | **✓**（cron 表达式） |
| `path` | URL path | **函数名**（被 `name(args)` 调用） | 任务标识 |

**关键差异**：
- api.path = `/product/list` → 前端 `POST /product/list`
- function.path = `/getBykey` → 其他 .ms 里 `getBykey("xxx")`（**去掉前导 `/`**）
- task.path = `/cleanCache` → 后端 cron 调度

---

### 真实例子：复刻 gewumind-boot 已部署的 function

**`data/zh/magic-api/function/配置中心/根据key获取数据值.ms`**：

```json
{
  "properties" : { },
  "id" : "3a21cd5fcd9b4e96b870a2268088266d",
  "script" : null,
  "groupId" : "7e31035eb8d4471b9fc2923ea1d966c3",
  "name" : "根据key获取数据值",
  "createTime" : null,
  "updateTime" : 1653119091752,
  "lock" : null,
  "createBy" : null,
  "updateBy" : null,
  "path" : "/getBykey",
  "description" : null,
  "returnType" : null,
  "mappingPath" : null,
  "parameters" : [ {
    "name" : "configureKey",
    "value" : null,
    "description" : null,
    "required" : false,
    "dataType" : "String",
    "type" : "java.lang.String",
    ...
  } ]
}
================================
var configure = db.cache(`configure:${configureKey}`).selectOne("""
     select configure_value from sys_configure where configure_key = #{configureKey}
""")
return configure == null ? "" : configure.get("configureValue")
```

**调用方式**（在另一个 .ms，比如某个 API）：
```js
var v = getBykey("app.name")   // 注意：去掉了 path 的前导 /
// v == "my-app"
```

---

### AI 工作流

**新写一个 function**（用户说"加个根据 keyAndCondition 查配置的 function"）：

1. `listScripts()` — 查已部署的 function，确认 `function/配置中心/根据keyAndcondition获取数据值.ms` 是否存在
2. 不存在 → 调 `generateMagicScript`：
   ```
   kind=function
   group=配置中心
   groupPath=configure
   name=根据keyAndcondition获取数据值
   path=/getBykeyAndCondition
   script=...
   parameters=[{name:'key', dataType:'String', type:'java.lang.String', required:false, ...},
               {name:'condition', dataType:'String', type:'java.lang.String', required:false, ...}]
   returnType=String
   description=根据 key + condition 查询配置
   ```
3. 用户点发布 → applyBundle 推到 `data/zh/magic-api/function/配置中心/`
4. 已在其他 .ms 里 `getBykeyAndCondition("app.name", "is_del=0")`

**复刻已部署的 function**：
1. `listScripts()` 看到 `function/配置中心/根据key获取数据值.ms` 存在
2. 调 `generateMagicScript` 加 `existingGroupPath='/configure'`（从已部署的 group.json 读 `path` 字段）
3. 工具自动复用已部署的 `groupId` + `parentId` + `path`

**重写已部署的 function**（行为变更）：
1. `listScripts()` 看到 path 是 `/getBykey`
2. 调 `generateMagicScript` 加 `existingGroupPath='/configure'`，path 用同名（覆盖原 .ms）
3. 工具会复用 `groupId`；新生成的 `scriptId` 写到同路径（applyBundle 会覆盖原文件）

---

### AI 工具调用清单

| 工具 | 用途 | 何时调 |
|---|---|---|
| `listScripts()` | 列 api/function/task | 复刻/重写前必先调 |
| `generateMagicScript(kind='function', ...)` | 写新 function | 上面"AI 工作流"那一节 |
| `generateMagicScript(kind='api', ...)` | 写 REST API | 给前端调 |
| `generateMagicScript(kind='task', ...)` | 写定时任务 | 后端 cron |

**关键参数（function 专属）**：
- `parameters`：逗号分隔 `"key, condition"` 或数组 `[{name, dataType, ...}]`
- `path`：函数调用名（**去掉前导 / 后就是变量名**：`/getBykey` → `getBykey`）
- `returnType`：返回类型，String / Map<String,Object> 等
- `description`：给人看的说明

**applyBundle 行为**：function 走跟 api 一样的推送流程，写到 `data/zh/magic-api/function/{group}/{name}.ms`。**不需要额外的 magic-import 或权限设置**。

---

### function vs Java 后端方法（mappingPath）

老版本的 function 有 `mappingPath` 字段（指向 Java 后端方法）。magic-api v2.0+ 弱化了它，**新 function 可以不填**。`path` + script 体内 `var x = someJavaService.method()` 就行。

**老 .ms 兼容**：如果 function 调 Java 后端方法（不是 magic-script 写法），需要 `mappingPath` 指向 Java 类全限定名 + 方法名。
