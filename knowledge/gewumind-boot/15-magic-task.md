## magic-api Task（定时任务）

`task` 是 magic-api 的**定时调度脚本**，cron 表达式触发，自动在后台跑，**不需要 HTTP 入口**。

---

### 跟 api / function 的区别

| 字段 | api | function | task |
|---|---|---|---|
| `method` | POST/GET/... | ❌ | ❌ |
| `options[]`（含 permission） | ✓ | ❌ | ❌ |
| `requestBody` / `responseBody` | ✓ | ❌ | ❌ |
| `parameters[]` | ✓ | ✓ | ❌（无参数） |
| `cron` | ❌ | ❌ | **✓（必填）** |
| `enabled` | ❌ | ❌ | **✓（默认 `false`，必须显式为 `true`）** |
| `description` | ❌ | ✓ | ✓ |
| `path` | URL path | 函数调用名 | 任务标识（任意字符串） |

**关键差异**：
- api 由前端 HTTP 触发
- function 由其他 .ms 函数名调用
- task 由 **cron 调度器**自动触发（无人调用，0 外部入口）

---

### 真实 meta 结构

```json
{
  "id": "task-xxx",
  "name": "清理过期日志",
  "path": "/cleanOldLogs",                  // 任务标识（任意，不参与调用）
  "groupId": "...",
  "script": "...",                          // magic-script
  "cron": "0 0 2 * * ?",                    // 必填，cron 表达式
  "enabled": true,                           // ⚠️ 默认 false！必须显式写 true，否则任务注册了但永不执行
  "description": "每天凌晨2点清理30天前的 sys_oper_log",
  "createTime": 1700000000000,
  "updateTime": null
}
================================
db.update("DELETE FROM sys_oper_log WHERE create_date < DATE_SUB(NOW(), INTERVAL 30 DAY)")
log.info("已清理 30 天前的 oper_log")
return "done"
```

**存储位置**：`data/magic-api/task/{group}/{name}.ms` + `group.json`（跟 api/function 一样）

---

### 适用场景

- **定期清理数据**：清理 30 天前的日志、清理临时文件、清理过期 session
- **定期同步**：从第三方 API 拉数据同步到本地（每 5 分钟拉一次汇率）
- **定期发通知**：每天早上 9 点给所有管理员发"今日待办"
- **定期统计**：每天凌晨生成日报、周报、月报（生成 row 存到 sys_report）
- **定期备份**：每周日凌晨 3 点备份核心表
- **定期缓存预热**：每 10 分钟刷新首页热数据缓存

**反例（不要用 task）**：
- 需要外部触发 → 用 `api`（HTTP 触发）
- 业务逻辑复用 → 用 `function`（被其他 .ms 调）
- 用户主动执行 → 用 `api`（加按钮）

---

### cron 表达式速查

| 表达式 | 含义 |
|---|---|
| `0 0 0 * * ?` | 每天 0 点 |
| `0 0/5 * * * ?` | 每 5 分钟 |
| `0 0 8 ? * MON-FRI` | 工作日早 8 点 |
| `0 0 2 1 * ?` | 每月 1 号凌晨 2 点 |
| `0 30 23 * * ?` | 每天 23:30 |
| `0 0 0/1 * * ?` | 每 1 小时整点 |

**前端** [cron.qqe2.com](https://cron.qqe2.com/) 生成 → 直接粘到 AI 工具的 `cron` 参数。

---

### 标准模式：清理任务

**用户对话**： "每天凌晨 2 点清理 30 天前的操作日志"

**AI 操作**：
1. `listTasks()` 查现有（如果有"清理"task → 检查 cron 是否相同；不重复建）
2. 不存在 → 调 `generateMagicScript`：
   ```
   kind=task
   group=定时任务
   groupPath=cron
   name=清理操作日志
   path=/cleanOperLog
   cron=0 0 2 * * ?
   description=每天凌晨2点清理30天前的 oper_log
   script=var n = db.update("DELETE FROM sys_oper_log WHERE create_date < DATE_SUB(NOW(), INTERVAL 30 DAY)")
              log.info("清理 oper_log " + n + " 条")
              return "cleaned: " + n
   ```
3. 用户点发布 → applyBundle 推到 `data/magic-api/task/定时任务/清理操作日志.ms`

**测试方法**：先设 cron 为 `0/30 * * * ? ?`（每 30 秒）观察一次，确认 log 输出正确，再改回正常 cron

---

### 标准模式：同步任务

**用户对话**： "每 10 分钟从外部 API 拉汇率同步到本地"

**AI 操作**：
```
kind=task
group=定时任务
name=同步汇率
cron=0 0/10 * * * ?     # 每 10 分钟
script=
  // 调第三方 API
  import 'utils.http' as http
  var resp = http.get("https://api.exchangerate.com/latest?base=CNY")
  var data = JSON.parse(resp.body)
  // 写入本地
  for (var k in data.rates) {
    db.update("INSERT INTO sys_exchange_rate (currency, rate, ts) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE rate=?", k, data.rates[k], data.rates[k])
  }
  log.info("同步汇率 " + Object.keys(data.rates).length + " 条")
```

---

### 暂停 / 启用 / 删除 task

**暂停**（不让它继续跑）：把 .ms 文件的 `enabled: false`
**启用**：把 `enabled: true`
**删除**：直接 `rm data/magic-api/task/定时任务/xxx.ms` + 对应 group.json 删除组

AI 工具目前**只支持新建和复刻**，暂停/启用/删除需要用户手动编辑文件。

---

### 跨 .ms 调用 task

**不推荐**：task 应该独立运行，不被其他 .ms 调。

如果你确实需要"手动触发"task 效果：
- 改成 `function`（function 接受参数，可被 API 调）
- 或者 task 里调 `db.update(...)` 改个状态标志，其他 .ms 查这个标志

---

### AI 工具调用清单

| 工具 | 用途 | 何时调 |
|---|---|---|
| `listScripts()` 过滤 type==task | 查现有 task | 新建/复刻前 |
| `generateMagicScript(kind='task', cron='...', ...)` | 写新 task | 上面"标准模式"那一节 |
| `generateMagicScript(kind='task', existingGroupPath='...')` | 复刻 task | 复用 groupId |

**关键参数（task 专属）**：
- `cron`：cron 表达式（必填）
- `enabled`：**默认 false**，必须显式为 `true`；传 `false` 暂停调度
- `path`：任务标识（任意字符串，不会被调用）
- `description`：给人看的说明

**applyBundle 行为**：task 跟 api/function 一样走 SQL + 文件 bundle，写到 `data/magic-api/task/{group}/{name}.ms`。**没有 sql 字段**（task 不写 DB），只写 .ms + group.json。

---

### 与 task 相关的配置项

| 配置 | 默认 | 说明 |
|---|---|---|
| `magic-api.task.enable` | `true` | 是否启用定时任务；为 `false` 时任务实体仍会加载，但**不会进入调度** |
| `magic-api.task.log` | `false` | 是否打印「开始执行 / 执行完毕」日志 |
| `magic-api.task.pool.size` | CPU 核数 | 调度线程池大小 |
| `magic-api.task.thread-name-prefix` | `magic-task-` | 线程名前缀，便于在日志中确认任务确实触发过 |
| `magic-api.task.shutdown.await-termination` | `false` | 关闭时是否等待任务执行完毕 |

> `enabled` 是**任务自身的 meta 字段**，不是全局配置项，没有「全局默认启用」开关——
> 每个任务的 `.ms` 都必须显式写 `"enabled": true`。

---

## 常见坑（1.0.0 实测）

### 坑 1：`log` 是模块，不是内置变量 —— 必须 `import log`

定时任务脚本里直接写 `log.info(...)` 会抛 `MagicScriptException: 对象为空`
（普通 api 脚本同理）。正确写法：

```javascript
import log          // ← 必须 import
log.info('清理完成，处理 ' + n + ' 条')
```

也可用 SLF4J：`import org.slf4j.LoggerFactory` + `LoggerFactory.getLogger('xxx')`，
但 **`import log` 是平台惯例，优先用它**。

### 坑 2：`/task/execute` 手动执行接口在嵌入部署下不可用

插件里确实有 `@PostMapping("/task/execute")`，但它是通过 magic-api 插件的
`controllerRegister()` 注册到 magic-api servlet 映射上的。作为**库嵌入**的
GewuMind Boot（`scanBasePackages` 只含 `com.gewumind.*`）中该路由 **404**。

**验证任务的可行做法**：临时把 cron 改成 `*/20 * * * * ?`，重启后端，每 20 秒
触发一次；验证完改回正式 cron 再重启。详见 `knowledge/task/05-pitfalls.md`。
