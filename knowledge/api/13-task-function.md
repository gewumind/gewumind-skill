## 定时任务 (Task)

### task 类型 .ms 文件

定时任务是 `task` 类型的 .ms 文件，URL path 决定 cron 表达式。

### 文件结构

```json
{
  "id": "uuid",
  "name": "清理日志",
  "path": "classpath:tasks/clean-logs.cron",
  "type": "task",
  "method": "POST",
  "options": [
    {"name": "cron", "value": "0 0 2 * * ?"}
  ]
}
================================
var count = db.update("delete from sys_login_log where create_date < date_sub(now(), interval 7 day)");
log.info('清理了{}条登录日志', count);
return count;
```

### cron 配置

| 字段 | 说明 |
|---|---|
| `options: cron` | cron 表达式（Quartz 风格） |
| `path` | 任务唯一标识（建议加 classpath: 或 file: 前缀） |

### 启用控制

```javascript
// 应用启动时通过 PasswordPolicyService 等初始化
if (env.get('task.enabled', 'false') == 'true') {
    // 注册定时任务
}
```

### task 模块

```javascript
import task;
if (!task.isEnabled()) { return; }

// 列出所有任务
var tasks = task.list();

// 暂停/恢复
task.pause('classpath:tasks/clean-logs.cron');
task.resume('classpath:tasks/clean-logs.cron');

// 立即执行
task.run('classpath:tasks/clean-logs.cron');
```

## 函数类型（function）

`function` 类型的 .ms 用于跨脚本复用的纯函数，**不暴露 HTTP 接口**。

```json
{
  "id": "uuid",
  "name": "格式化金额",
  "path": "/format-money",
  "type": "function"
}
================================
import 'java.text.DecimalFormat' as DecimalFormat;
var df = new DecimalFormat('#,##0.00');
return df.format(amount);
```

调用：

```javascript
import '@/common/format-money' as formatMoney;
var formatted = formatMoney(1234567.89);
// → "1,234,567.89"
```

## function / server / subscriber 三者区别

| 类型 | 用途 | 是否暴露 HTTP |
|---|---|---|
| `api` | REST API（前后端分离） | ✅ |
| `function` | 公共函数（被 import） | ❌ |
| `task` | 定时任务（cron 触发） | ❌ |
| `server` | WebSocket / TCP / SSE 服务 | ❌ |
| `subscriber` | 事件订阅 | ❌ |
| `workflow` | 工作流节点 | ❌ |

